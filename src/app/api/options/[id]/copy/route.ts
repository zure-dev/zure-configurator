import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// POST /api/options/[id]/copy
// Copies an option group into the server-side clipboard.
// Replaces any existing clipboard entry for this store.
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    // Load group + values
    const group = await db.optionGroup.findUnique({
      where: { id: params.id },
      include: {
        values: { orderBy: { sortOrder: 'asc' } },
        productFamily: { select: { id: true, name: true, storeId: true } },
      },
    });

    if (!group) return tenantError('Option group not found', 404);
    if (group.productFamily.storeId !== tenant.storeId) return tenantError('Option group not found', 404);

    // Serialize snapshot
    const snapshot = {
      name: group.name,
      slug: group.slug,
      displayType: group.displayType,
      sortOrder: group.sortOrder,
      isRequired: group.isRequired,
      helperText: group.helperText,
      stepNumber: group.stepNumber,
      isConditional: group.isConditional,
      visibilityConditions: group.visibilityConditions,
      values: group.values.map((v: any) => ({
        name: v.name,
        slug: v.slug,
        sortOrder: v.sortOrder,
        isDefault: v.isDefault,
        swatchColor: v.swatchColor,
        swatchImage: v.swatchImage,
        thumbnailUrl: v.thumbnailUrl,
        description: v.description,
        metadata: v.metadata,
        shopifyProductId: v.shopifyProductId,
        shopifyVariantId: v.shopifyVariantId,
        shopifyProductTitle: v.shopifyProductTitle,
        shopifyVariantTitle: v.shopifyVariantTitle,
        shopifySku: v.shopifySku,
        shopifyImageUrl: v.shopifyImageUrl,
        shopifyPrice: v.shopifyPrice != null ? String(v.shopifyPrice) : null,
      })),
    };

    // Delete existing clipboard entries for this store (keep only latest)
    await db.optionGroupClipboard.deleteMany({
      where: { storeId: tenant.storeId, isTemplate: false },
    });

    // Create clipboard entry (expires in 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const clipboard = await db.optionGroupClipboard.create({
      data: {
        storeId: tenant.storeId,
        label: group.name,
        data: snapshot,
        isTemplate: false,
        expiresAt,
      },
    });

    return tenantResponse({
      clipboardId: clipboard.id,
      label: clipboard.label,
      valueCount: group.values.length,
      message: `"${group.name}" copied to clipboard`,
    }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/copy]', message, error);
    return tenantError(`Failed to copy option group: ${message}`, 500);
  }
}
