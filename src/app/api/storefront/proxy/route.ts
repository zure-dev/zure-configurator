import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/storefront/proxy
// Optimized: 2 DB queries max, CDN cache 60s + stale 5min
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const shopDomain = request.nextUrl.searchParams.get('shop') ?? '';
  const productId = request.nextUrl.searchParams.get('productId') ?? '';
  const handle = request.nextUrl.searchParams.get('handle') ?? '';

  const debug = {
    shop: shopDomain, productId, handle,
    normalizedProductIds: [] as string[],
    storeFound: false, familyFoundInactive: false,
  };

  try {
    if (!shopDomain) return Response.json({ error: 'MISSING_SHOP', message: 'shop parameter is required', debug });
    if (!productId && !handle) return Response.json({ error: 'MISSING_PRODUCT', message: 'productId or handle is required', debug });

    // Query 1: Store lookup
    const store = await db.store.findUnique({ where: { shopifyDomain: shopDomain }, select: { id: true } });
    if (!store) return Response.json({ error: 'STORE_NOT_FOUND', message: `No store found for "${shopDomain}"`, debug });
    debug.storeFound = true;

    // Build product ID candidates
    const candidates: string[] = [];
    if (productId) {
      candidates.push(productId);
      if (/^\d+$/.test(productId)) candidates.push(`gid://shopify/Product/${productId}`);
      const m = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
      if (m) { const n = m[1]; if (n) candidates.push(n); }
    }
    debug.normalizedProductIds = candidates;

    // Query 2: Load full family data in ONE query (skip the separate findFirst + findUnique)
    const familySelect = {
      id: true, name: true, handle: true, basePrice: true, status: true,
      variantProfiles: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
        select: {
          id: true, name: true, slug: true,
          shopifyVariantId: true, shopifyVariantTitle: true,
          shopifySku: true, isDefault: true, isActive: true,
        },
      },
      optionGroups: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          id: true, name: true, slug: true, displayType: true,
          sortOrder: true, isRequired: true, helperText: true,
          stepNumber: true, isConditional: true, visibilityConditions: true,
          variantProfileId: true,
          values: {
            orderBy: { sortOrder: 'asc' as const },
            select: {
              id: true, name: true, slug: true, sortOrder: true,
              isDefault: true, swatchColor: true, thumbnailUrl: true,
              description: true, shopifyVariantId: true,
              shopifyPrice: true, shopifyImageUrl: true,
              productMappings: {
                orderBy: { sortOrder: 'asc' as const },
                select: {
                  id: true, shopifyVariantId: true, shopifyProductTitle: true,
                  shopifyVariantTitle: true, shopifyImageUrl: true,
                  shopifyPrice: true, quantity: true, role: true,
                },
              },
            },
          },
        },
      },
      priceRules: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
        select: { optionGroupSlug: true, optionValueSlug: true, priceModifier: true, modifierType: true, conditions: true },
      },
    };

    let fullFamily = null;

    // Try by product ID first
    if (candidates.length > 0) {
      fullFamily = await db.productFamily.findFirst({
        where: { storeId: store.id, shopifyProductId: { in: candidates } },
        select: familySelect,
      });
    }

    // Fallback to handle
    if (!fullFamily && handle) {
      fullFamily = await db.productFamily.findFirst({
        where: { storeId: store.id, OR: [{ handle }, { slug: handle }] },
        select: familySelect,
      });
    }

    if (!fullFamily) {
      return Response.json({ error: 'PRODUCT_FAMILY_NOT_FOUND', message: 'No configurator for this product.', debug });
    }

    // Check if found but not ACTIVE
    if (fullFamily.status !== 'ACTIVE') {
      debug.familyFoundInactive = true;
      return Response.json({
        error: 'FAMILY_NOT_ACTIVE',
        message: `"${fullFamily.name}" has status "${fullFamily.status}". Set to ACTIVE.`,
        debug,
      });
    }

    // Strip status from response (not customer-facing)
    const { status: _status, ...configuratorData } = fullFamily;

    return Response.json(
      { configurator: configuratorData },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/proxy]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to load configurator', debug });
  }
}
