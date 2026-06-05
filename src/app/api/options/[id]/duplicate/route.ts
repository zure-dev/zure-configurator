import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// POST /api/options/[id]/duplicate
// Duplicates an option group with all its values.
// Creates independent database records.
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    // Load the source group with values
    const source = await db.optionGroup.findUnique({
      where: { id: params.id },
      include: {
        values: { orderBy: { sortOrder: 'asc' } },
        productFamily: {
          select: { id: true, storeId: true },
        },
      },
    });

    if (!source) {
      return tenantError('Option group not found', 404);
    }

    if (source.productFamily.storeId !== tenant.storeId) {
      return tenantError('Option group not found', 404);
    }

    // Generate unique slug
    const baseSlug = `${source.slug}-copy`;
    let newSlug = baseSlug;
    let suffix = 1;

    // Check for slug collisions
    while (true) {
      const existing = await db.optionGroup.findFirst({
        where: {
          productFamilyId: source.productFamilyId,
          slug: newSlug,
        },
        select: { id: true },
      });
      if (!existing) break;
      suffix++;
      newSlug = `${baseSlug}-${suffix}`;
    }

    // Get next sort order
    const maxSort = await db.optionGroup.findFirst({
      where: { productFamilyId: source.productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (maxSort?.sortOrder ?? -1) + 1;

    // Duplicate in a transaction
    const duplicated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the new group
      const newGroup = await tx.optionGroup.create({
        data: {
          productFamilyId: source.productFamilyId,
          name: `${source.name} Copy`,
          slug: newSlug,
          displayType: source.displayType,
          sortOrder: nextSortOrder,
          isRequired: source.isRequired,
          helperText: source.helperText,
          stepNumber: source.stepNumber,
          isConditional: source.isConditional,
          visibilityConditions: source.visibilityConditions ?? Prisma.JsonNull,
        },
      });

      // Duplicate all values
      if (source.values.length > 0) {
        for (const val of source.values) {
          await tx.optionValue.create({
            data: {
              optionGroupId: newGroup.id,
              name: val.name,
              slug: val.slug,
              sortOrder: val.sortOrder,
              isDefault: val.isDefault,
              swatchColor: val.swatchColor,
              swatchImage: val.swatchImage,
              thumbnailUrl: val.thumbnailUrl,
              description: val.description,
              metadata: val.metadata ?? Prisma.JsonNull,
              shopifyProductId: val.shopifyProductId,
              shopifyVariantId: val.shopifyVariantId,
              shopifyProductTitle: val.shopifyProductTitle,
              shopifyVariantTitle: val.shopifyVariantTitle,
              shopifySku: val.shopifySku,
              shopifyImageUrl: val.shopifyImageUrl,
              shopifyPrice: val.shopifyPrice,
            },
          });
        }
      }

      // Return the new group with values
      return tx.optionGroup.findUnique({
        where: { id: newGroup.id },
        include: { values: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return tenantResponse({ optionGroup: duplicated }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/duplicate]', message, error);
    return tenantError(`Failed to duplicate option group: ${message}`, 500);
  }
}
