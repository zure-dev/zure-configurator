import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// POST /api/options/[id]/duplicate
// Duplicates an option group with all values + product mappings.
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const source = await db.optionGroup.findUnique({
      where: { id: params.id },
      include: {
        values: {
          orderBy: { sortOrder: 'asc' },
          include: { productMappings: { orderBy: { sortOrder: 'asc' } } },
        },
        productFamily: { select: { id: true, storeId: true } },
      },
    });

    if (!source) return tenantError('Option group not found', 404);
    if (source.productFamily.storeId !== tenant.storeId) return tenantError('Option group not found', 404);

    // Generate collision-safe slug
    const baseSlug = `${source.slug}-copy`;
    let newSlug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await db.optionGroup.findFirst({
        where: { productFamilyId: source.productFamilyId, slug: newSlug },
        select: { id: true },
      });
      if (!existing) break;
      suffix++;
      newSlug = `${baseSlug}-${suffix}`;
    }

    // Next sort order
    const maxSort = await db.optionGroup.findFirst({
      where: { productFamilyId: source.productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (maxSort?.sortOrder ?? -1) + 1;

    const duplicated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
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

      for (const val of source.values) {
        const newVal = await tx.optionValue.create({
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

        // Copy product mappings
        for (const mapping of val.productMappings) {
          await tx.optionValueProductMapping.create({
            data: {
              optionValueId: newVal.id,
              shopifyProductId: mapping.shopifyProductId,
              shopifyVariantId: mapping.shopifyVariantId,
              shopifyProductTitle: mapping.shopifyProductTitle,
              shopifyVariantTitle: mapping.shopifyVariantTitle,
              shopifySku: mapping.shopifySku,
              shopifyImageUrl: mapping.shopifyImageUrl,
              shopifyPrice: mapping.shopifyPrice,
              quantity: mapping.quantity,
              sortOrder: mapping.sortOrder,
              role: mapping.role,
            },
          });
        }
      }

      return tx.optionGroup.findUnique({
        where: { id: newGroup.id },
        include: {
          values: {
            orderBy: { sortOrder: 'asc' },
            include: { productMappings: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });
    });

    return tenantResponse({ optionGroup: duplicated }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/duplicate]', message, error);
    return tenantError(`Failed to duplicate option group: ${message}`, 500);
  }
}
