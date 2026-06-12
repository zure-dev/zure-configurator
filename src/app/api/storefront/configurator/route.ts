import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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

    let family = null;
    if (candidates.length > 0) {
      family = await db.productFamily.findFirst({ where: { storeId: store.id, status: 'ACTIVE', shopifyProductId: { in: candidates } }, select: { id: true } });
      if (!family) {
        const inactive = await db.productFamily.findFirst({ where: { storeId: store.id, shopifyProductId: { in: candidates } }, select: { id: true, status: true, name: true } });
        if (inactive) { debug.familyFoundInactive = true; return Response.json({ error: 'FAMILY_NOT_ACTIVE', message: `"${inactive.name}" has status "${inactive.status}". Set to ACTIVE.`, debug }, { status: 404, headers: corsHeaders() }); }
      }
    }
    if (!family && handle) {
      family = await db.productFamily.findFirst({ where: { storeId: store.id, status: 'ACTIVE', OR: [{ handle }, { slug: handle }] }, select: { id: true } });
    }
    if (!family) return Response.json({ error: 'PRODUCT_FAMILY_NOT_FOUND', message: 'No configurator for this product.', debug }, { status: 404, headers: corsHeaders() });

    const fullFamily = await db.productFamily.findUnique({
      where: { id: family.id },
      select: {
        id: true, name: true, handle: true, basePrice: true,
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, name: true, slug: true, displayType: true,
            sortOrder: true, isRequired: true, helperText: true,
            stepNumber: true, isConditional: true, visibilityConditions: true,
            values: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true, name: true, slug: true, sortOrder: true,
                isDefault: true, swatchColor: true, thumbnailUrl: true,
                description: true, shopifyVariantId: true,
                shopifyPrice: true, shopifyImageUrl: true,
                productMappings: {
                  orderBy: { sortOrder: 'asc' },
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
          orderBy: { sortOrder: 'asc' },
          select: { optionGroupSlug: true, optionValueSlug: true, priceModifier: true, modifierType: true, conditions: true },
        },
      },
    });

    if (!fullFamily) return Response.json({ error: 'LOAD_FAILED', message: 'Could not load configurator data', debug }, { status: 500, headers: corsHeaders() });

    return Response.json({ configurator: fullFamily }, { status: 200, headers: corsHeaders() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/configurator]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to load configurator', debug }, { status: 500, headers: corsHeaders() });
  }
}
