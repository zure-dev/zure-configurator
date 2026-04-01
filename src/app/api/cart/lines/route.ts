import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { prepareCart } from '@/services/cart.service';
import { buildCartLines } from '@/services/cart-line-builder.service';
import { resolveMainVariant, resolveAddOnVariant } from '@/services/variant-resolver.service';
import type { ResolvedSelection, LineBuilderConfig } from '@/services/cart-line-builder.service';

// POST /api/cart/lines
//
// Body: {
//   productFamilyId: string,
//   selections: { "vanity-size": "900mm", ... },
//   addOnGroupSlugs?: string[],
// }
//
// Returns:
//   success: true → mainLine, addOnLines[], total, snapshotId
//   success: false → errors[]

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, selections, addOnGroupSlugs } = body;

    if (!productFamilyId || !selections || typeof selections !== 'object') {
      return tenantError('productFamilyId and selections object are required');
    }

    // Step 1: Resolve the cart (validate + price + persist snapshot)
    const resolution = await prepareCart(tenant.storeId, {
      productFamilyId,
      selections,
    });

    if (!resolution.success || !resolution.pricing || !resolution.snapshotId) {
      return tenantResponse(resolution, 422);
    }

    // Step 2: Load product family name + option groups
    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
      select: { name: true },
    });

    const optionGroups = await db.optionGroup.findMany({
      where: { productFamilyId },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    // Step 3: Resolve main variant
    const mainVariant = await resolveMainVariant({ productFamilyId });

    // Step 4: Build resolved selections with variant mappings
    const resolvedSelections: ResolvedSelection[] = [];

    for (const group of optionGroups) {
      const selectedSlug = selections[group.slug];
      if (!selectedSlug) continue;

      const value = group.values.find((v) => v.slug === selectedSlug);
      if (!value) continue;

      const priceLineItem = resolution.pricing.lineItems.find(
        (li) => li.optionGroupSlug === group.slug && li.optionValueSlug === selectedSlug
      );

      // Resolve add-on variant for this selection
      const variantMapping = await resolveAddOnVariant({
        productFamilyId,
        groupSlug: group.slug,
        valueSlug: value.slug,
        allSelections: selections,
        valueMetadata: value.metadata as Record<string, unknown> | null,
      });

      resolvedSelections.push({
        groupSlug: group.slug,
        groupName: group.name,
        isRequired: group.isRequired,
        selectedValueSlug: value.slug,
        selectedValueName: value.name,
        priceDelta: priceLineItem?.amount ?? null,
        priceDeltaFormatted: priceLineItem && priceLineItem.amount !== 0
          ? `${priceLineItem.amount >= 0 ? '+' : ''}$${Math.abs(priceLineItem.amount).toFixed(2)}`
          : null,
        groupMetadata: null,
        valueMetadata: value.metadata as Record<string, unknown> | null,
        variantMapping,
      });
    }

    // Step 5: Build cart lines
    const config: LineBuilderConfig = {};
    if (Array.isArray(addOnGroupSlugs) && addOnGroupSlugs.length > 0) {
      config.addOnGroupSlugs = addOnGroupSlugs;
    }

    const cartLines = buildCartLines(
      resolution.snapshotId,
      mainVariant,
      resolution.pricing.basePrice,
      resolvedSelections,
      family?.name ?? 'Configured Product',
      config
    );

    return tenantResponse({
      success: true,
      ...cartLines,
      pricing: resolution.pricing,
      summary: resolution.summary,
    }, 201);
  } catch (error) {
    console.error('[cart/lines]', error);
    return tenantError('Failed to build cart lines', 500);
  }
}
