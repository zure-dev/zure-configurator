import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { prepareCart } from '@/services/cart.service';
import { buildCartLines } from '@/services/cart-line-builder.service';
import { resolveMainVariant, resolveAddOnVariant } from '@/services/variant-resolver.service';
import { createDraftOrder } from '@/services/draft-order.service';
import type { ResolvedSelection, LineBuilderConfig } from '@/services/cart-line-builder.service';

// POST /api/draft-order/create
//
// Body: {
//   productFamilyId: string,
//   selections: { "vanity-size": "900mm", ... },
//   addOnGroupSlugs?: string[],
//   customerEmail?: string,
//   shopifyCustomerId?: string,
//   note?: string,
// }
//
// This is the full pipeline:
//   1. Validate + price + persist snapshot (via cart.service)
//   2. Resolve variant IDs (via variant-resolver.service)
//   3. Build cart lines (via cart-line-builder.service)
//   4. Create Shopify Draft Order (via draft-order.service)
//   5. Return draft order ID + invoice URL
//
// OR use a pre-existing snapshot:
//
// Body: {
//   snapshotId: string,
//   addOnGroupSlugs?: string[],
//   customerEmail?: string,
//   shopifyCustomerId?: string,
//   note?: string,
// }

export async function POST(request: NextRequest) {
  try {
    console.log('[draft-order/create] route hit');
    console.log('[draft-order/create] method:', request.method);
    console.log('[draft-order/create] url:', request.url);

    const requestShop = new URL(request.url).searchParams.get('shop');
    console.log('[draft-order/create] query shop:', requestShop);

    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');

    console.log('[draft-order/create] has cookie header:', !!cookieHeader);
    console.log('[draft-order/create] has authorization header:', !!authHeader);
    console.log(
      '[draft-order/create] authorization preview:',
      authHeader ? `${authHeader.slice(0, 20)}...` : 'missing'
    );

    const tenant = await getTenantFromSession(request);

    console.log('[draft-order/create] tenant resolved:', !!tenant);
    console.log('[draft-order/create] tenant payload:', tenant);

    if (!tenant) {
      console.log('[draft-order/create] tenant missing, returning 401');
      return tenantError('Unauthorized', 401);
    }

    const body = await request.json();

    console.log('[draft-order/create] body keys:', Object.keys(body || {}));
    console.log('[draft-order/create] has productFamilyId:', !!body.productFamilyId);
    console.log('[draft-order/create] has selections:', !!body.selections);
    console.log('[draft-order/create] has snapshotId:', !!body.snapshotId);

    const { customerEmail, shopifyCustomerId, note, addOnGroupSlugs } = body;

    let snapshotId: string;
    let productFamilyId: string;
    let selections: Record<string, string>;
    let pricingBasePrice: number;
    let pricingLineItems: Array<{
      optionGroupSlug: string;
      optionValueSlug: string;
      amount: number;
    }>;
    let familyName: string;

    // ── Path A: From scratch (selections provided) ──
    if (body.productFamilyId && body.selections) {
      console.log('[draft-order/create] using Path A: productFamilyId + selections');

      productFamilyId = body.productFamilyId;
      selections = body.selections;

      console.log('[draft-order/create] productFamilyId:', productFamilyId);
      console.log('[draft-order/create] selections:', selections);

      const resolution = await prepareCart(tenant.storeId, { productFamilyId, selections });

      console.log('[draft-order/create] prepareCart success:', resolution.success);
      console.log('[draft-order/create] prepareCart snapshotId:', resolution.snapshotId);
      console.log('[draft-order/create] prepareCart errors:', resolution.errors);
      console.log('[draft-order/create] prepareCart pricing:', resolution.pricing);

      if (!resolution.success || !resolution.pricing || !resolution.snapshotId) {
        console.log('[draft-order/create] prepareCart failed, returning 422');
        return tenantResponse(
          {
            success: false,
            errors: resolution.errors,
          },
          422
        );
      }

      snapshotId = resolution.snapshotId;
      pricingBasePrice = resolution.pricing.basePrice;
      pricingLineItems = resolution.pricing.lineItems;

      const family = await db.productFamily.findFirst({
        where: { id: productFamilyId, storeId: tenant.storeId },
        select: { name: true },
      });

      familyName = family?.name ?? 'Configured Product';

      console.log('[draft-order/create] familyName:', familyName);
      console.log('[draft-order/create] pricingBasePrice:', pricingBasePrice);
      console.log('[draft-order/create] pricingLineItems:', pricingLineItems);

      // ── Path B: From existing snapshot ──
    } else if (body.snapshotId) {
      console.log('[draft-order/create] using Path B: snapshotId');

      const snapshot = await db.configurationSnapshot.findUnique({
        where: { id: body.snapshotId },
        include: {
          session: { select: { storeId: true, productFamilyId: true } },
        },
      });

      console.log('[draft-order/create] snapshot found:', !!snapshot);

      if (!snapshot || snapshot.session.storeId !== tenant.storeId) {
        console.log('[draft-order/create] snapshot missing or store mismatch');
        return tenantError('Snapshot not found', 404);
      }

      snapshotId = snapshot.id;
      productFamilyId = snapshot.productFamilyId;

      const snapshotSelections = snapshot.selections as Record<string, { slug: string }>;
      selections = {};

      for (const [groupSlug, val] of Object.entries(snapshotSelections)) {
        selections[groupSlug] = val.slug;
      }

      const pricingData = snapshot.pricingBreakdown as {
        basePrice?: number;
        lineItems?: Array<{
          optionGroupSlug: string;
          optionValueSlug: string;
          amount: number;
        }>;
      } | null;

      pricingBasePrice = pricingData?.basePrice ?? 0;
      pricingLineItems = pricingData?.lineItems ?? [];

      const family = await db.productFamily.findFirst({
        where: { id: productFamilyId, storeId: tenant.storeId },
        select: { name: true },
      });

      familyName = family?.name ?? 'Configured Product';

      console.log('[draft-order/create] snapshotId:', snapshotId);
      console.log('[draft-order/create] productFamilyId:', productFamilyId);
      console.log('[draft-order/create] reconstructed selections:', selections);
      console.log('[draft-order/create] pricingBasePrice:', pricingBasePrice);
      console.log('[draft-order/create] pricingLineItems:', pricingLineItems);
      console.log('[draft-order/create] familyName:', familyName);
    } else {
      console.log('[draft-order/create] missing both path inputs');
      return tenantError('Either (productFamilyId + selections) or snapshotId is required');
    }

    // ── Build cart lines with variant resolution ──
    const optionGroups = await db.optionGroup.findMany({
      where: { productFamilyId },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    console.log('[draft-order/create] optionGroups count:', optionGroups.length);

    const mainVariant = await resolveMainVariant({ productFamilyId });

    console.log('[draft-order/create] mainVariant:', mainVariant);

    const resolvedSelections: ResolvedSelection[] = [];

    for (const group of optionGroups) {
      const selectedSlug = selections[group.slug];
      if (!selectedSlug) continue;

      const value = group.values.find((v) => v.slug === selectedSlug);
      if (!value) continue;

      const priceLineItem = pricingLineItems.find(
        (li) => li.optionGroupSlug === group.slug && li.optionValueSlug === selectedSlug
      );

      const variantMapping = await resolveAddOnVariant({
        productFamilyId,
        groupSlug: group.slug,
        valueSlug: value.slug,
        allSelections: selections,
        valueMetadata: value.metadata as Record<string, unknown> | null,
      });

      const resolvedSelection: ResolvedSelection = {
        groupSlug: group.slug,
        groupName: group.name,
        isRequired: group.isRequired,
        selectedValueSlug: value.slug,
        selectedValueName: value.name,
        priceDelta: priceLineItem?.amount ?? null,
        priceDeltaFormatted:
          priceLineItem && priceLineItem.amount !== 0
            ? `${priceLineItem.amount >= 0 ? '+' : ''}$${Math.abs(priceLineItem.amount).toFixed(2)}`
            : null,
        groupMetadata: null,
        valueMetadata: value.metadata as Record<string, unknown> | null,
        variantMapping,
      };

      resolvedSelections.push(resolvedSelection);
    }

    console.log('[draft-order/create] resolvedSelections:', resolvedSelections);

    const config: LineBuilderConfig = {};
    if (Array.isArray(addOnGroupSlugs) && addOnGroupSlugs.length > 0) {
      config.addOnGroupSlugs = addOnGroupSlugs;
    }

    console.log('[draft-order/create] line builder config:', config);

    const cartLines = buildCartLines(
      snapshotId,
      mainVariant,
      pricingBasePrice,
      resolvedSelections,
      familyName,
      config
    );

    console.log('[draft-order/create] cartLines:', cartLines);

    // ── Create Draft Order in Shopify ──
    console.log('[draft-order/create] calling createDraftOrder with storeId:', tenant.storeId);

    const draftResult = await createDraftOrder({
      storeId: tenant.storeId,
      snapshotId,
      cartLines,
      customerEmail,
      shopifyCustomerId,
      note,
    });

    console.log('[draft-order/create] createDraftOrder result:', draftResult);

    return tenantResponse(draftResult, draftResult.success ? 201 : 422);
  } catch (error) {
    console.error('[draft-order/create] fatal error:', error);

    if (error instanceof Error) {
      console.error('[draft-order/create] error message:', error.message);
      console.error('[draft-order/create] error stack:', error.stack);
    }

    return tenantError('Failed to create draft order', 500);
  }
}