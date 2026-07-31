import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function corsHeaders(cacheControl?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (cacheControl) headers['Cache-Control'] = cacheControl;
  return headers;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const shopDomain = request.nextUrl.searchParams.get('shop') ?? '';
  const productId = request.nextUrl.searchParams.get('productId') ?? '';
  const handle = request.nextUrl.searchParams.get('handle') ?? '';

  const debug = {
    shop: shopDomain, productId, handle,
    normalizedProductIds: [] as string[],
    storeFound: false, familySearched: false, familyFoundInactive: false,
  };

  try {
    if (!shopDomain) return Response.json({ error: 'MISSING_SHOP', message: 'shop parameter is required', debug }, { status: 400, headers: corsHeaders() });
    if (!productId && !handle) return Response.json({ error: 'MISSING_PRODUCT', message: 'productId or handle is required', debug }, { status: 400, headers: corsHeaders() });

    const store = await db.store.findUnique({ where: { shopifyDomain: shopDomain }, select: { id: true } });
    if (!store) return Response.json({ error: 'STORE_NOT_FOUND', message: `No store found for "${shopDomain}"`, debug }, { status: 404, headers: corsHeaders() });
    debug.storeFound = true;

    const candidates: string[] = [];
    if (productId) {
      candidates.push(productId);
      if (/^\d+$/.test(productId)) candidates.push(`gid://shopify/Product/${productId}`);
      const m = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
      if (m) { const n = m[1]; if (n) candidates.push(n); }
    }
    debug.normalizedProductIds = candidates;
    debug.familySearched = true;

    // Single query: load full family data directly (saves a DB round trip)
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

    if (candidates.length > 0) {
      fullFamily = await db.productFamily.findFirst({
        where: { storeId: store.id, shopifyProductId: { in: candidates } },
        select: familySelect,
      });
    }

    if (!fullFamily && handle) {
      fullFamily = await db.productFamily.findFirst({
        where: { storeId: store.id, OR: [{ handle }, { slug: handle }] },
        select: familySelect,
      });
    }

    if (!fullFamily) {
      return Response.json({ error: 'PRODUCT_FAMILY_NOT_FOUND', message: 'No configurator for this product.', debug }, { status: 404, headers: corsHeaders() });
    }

    if (fullFamily.status !== 'ACTIVE') {
      debug.familyFoundInactive = true;
      return Response.json({
        error: 'FAMILY_NOT_ACTIVE',
        message: `"${fullFamily.name}" has status "${fullFamily.status}". Set to ACTIVE.`,
        debug,
      }, { status: 404, headers: corsHeaders() });
    }

    const { status: _status, ...configuratorData } = fullFamily;

    return Response.json(
      { configurator: configuratorData },
      { status: 200, headers: corsHeaders('public, s-maxage=60, stale-while-revalidate=300') }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/configurator]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to load configurator', debug }, { status: 500, headers: corsHeaders() });
  }
}
