import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// POST /api/options/paste
// Body: { clipboardId, productFamilyId }
// Creates a new option group from clipboard data.
// ──────────────────────────────────────────────

interface ClipboardValue {
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor: string | null;
  swatchImage: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  metadata: unknown;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  shopifyProductTitle: string | null;
  shopifyVariantTitle: string | null;
  shopifySku: string | null;
  shopifyImageUrl: string | null;
  shopifyPrice: string | null;
}

interface ClipboardData {
  name: string;
  slug: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText: string | null;
  stepNumber: number | null;
  isConditional: boolean;
  visibilityConditions: unknown;
  values: ClipboardValue[];
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { clipboardId, productFamilyId } = body;

    if (!clipboardId || !productFamilyId) {
      return tenantError('clipboardId and productFamilyId are required', 400);
    }

    // Load clipboard entry
    const entry = await db.optionGroupClipboard.findUnique({
      where: { id: clipboardId },
    });

    if (!entry) return tenantError('Clipboard entry not found', 404);
    if (entry.storeId !== tenant.storeId) return tenantError('Clipboard entry not found', 404);

    // Check expiry
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      return tenantError('Clipboard entry has expired', 410);
    }

    // Verify target family belongs to same store
    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
      select: { id: true },
    });

    if (!family) return tenantError('Target product family not found', 404);

    // Parse clipboard data
    const data = entry.data as unknown as ClipboardData;
    if (!data || !data.name) {
      return tenantError('Invalid clipboard data', 400);
    }

    // Generate collision-safe slug
    const baseSlug = data.slug;
    let newSlug = baseSlug;
    let suffix = 0;

    while (true) {
      const existing = await db.optionGroup.findFirst({
        where: { productFamilyId, slug: newSlug },
        select: { id: true },
      });
      if (!existing) break;
      suffix++;
      newSlug = suffix === 1 ? `${baseSlug}-copy` : `${baseSlug}-copy-${suffix}`;
    }

    // Determine name (add "Copy" if slug was changed, i.e. collision occurred)
    const newName = suffix > 0 ? `${data.name} (Pasted)` : data.name;

    // Get next sort order
    const maxSort = await db.optionGroup.findFirst({
      where: { productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (maxSort?.sortOrder ?? -1) + 1;

    // Create in transaction
    const values = Array.isArray(data.values) ? data.values : [];

    const created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const newGroup = await tx.optionGroup.create({
        data: {
          productFamilyId,
          name: newName,
          slug: newSlug,
          displayType: (data.displayType as any) ?? 'TILE',
          sortOrder: nextSortOrder,
          isRequired: data.isRequired ?? true,
          helperText: data.helperText ?? null,
          stepNumber: data.stepNumber ?? null,
          isConditional: data.isConditional ?? false,
          visibilityConditions: data.visibilityConditions != null
            ? (data.visibilityConditions as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      for (const val of values) {
        await tx.optionValue.create({
          data: {
            optionGroupId: newGroup.id,
            name: val.name,
            slug: val.slug,
            sortOrder: val.sortOrder ?? 0,
            isDefault: val.isDefault ?? false,
            swatchColor: val.swatchColor ?? null,
            swatchImage: val.swatchImage ?? null,
            thumbnailUrl: val.thumbnailUrl ?? null,
            description: val.description ?? null,
            metadata: val.metadata != null
              ? (val.metadata as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            shopifyProductId: val.shopifyProductId ?? null,
            shopifyVariantId: val.shopifyVariantId ?? null,
            shopifyProductTitle: val.shopifyProductTitle ?? null,
            shopifyVariantTitle: val.shopifyVariantTitle ?? null,
            shopifySku: val.shopifySku ?? null,
            shopifyImageUrl: val.shopifyImageUrl ?? null,
            shopifyPrice: val.shopifyPrice != null ? parseFloat(val.shopifyPrice) : null,
          },
        });
      }

      return tx.optionGroup.findUnique({
        where: { id: newGroup.id },
        include: { values: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return tenantResponse({ optionGroup: created }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/paste]', message, error);
    return tenantError(`Failed to paste option group: ${message}`, 500);
  }
}
