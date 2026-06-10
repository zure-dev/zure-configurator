import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// GET /api/storefront/configurator
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const shopDomain = request.nextUrl.searchParams.get('shop') ?? '';
  const productId = request.nextUrl.searchParams.get('productId') ?? '';
  const handle = request.nextUrl.searchParams.get('handle') ?? '';

  // Build debug context (included in error responses for troubleshooting)
  const debug = {
    shop: shopDomain,
    productId,
    handle,
    normalizedProductIds: [] as string[],
    storeFound: false,
    familySearched: false,
    familyFoundInactive: false,
  };

  try {
    if (!shopDomain) {
      return Response.json(
        { error: 'MISSING_SHOP', message: 'shop parameter is required', debug },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!productId && !handle) {
      return Response.json(
        { error: 'MISSING_PRODUCT', message: 'productId or handle is required', debug },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ── Resolve store ──
    const store = await db.store.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true, shopifyDomain: true },
    });

    if (!store) {
      console.warn('[storefront/configurator] Store not found:', shopDomain);
      return Response.json(
        { error: 'STORE_NOT_FOUND', message: `No store found for domain "${shopDomain}"`, debug },
        { status: 404, headers: corsHeaders() }
      );
    }

    debug.storeFound = true;

    // ── Build all possible product ID formats to match against ──
    const productIdCandidates: string[] = [];

    if (productId) {
      // Raw value as-is
      productIdCandidates.push(productId);

      // If numeric, also try GID format
      if (/^\d+$/.test(productId)) {
        productIdCandidates.push(`gid://shopify/Product/${productId}`);
      }

      // If GID, also try numeric extraction
      const gidMatch = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
      if (gidMatch) {
        const numericPart = gidMatch[1];
        if (numericPart) productIdCandidates.push(numericPart);
      }
    }

    debug.normalizedProductIds = productIdCandidates;
    debug.familySearched = true;

    // ── Resolve product family — try productId first, then handle ──
    let family = null;

    if (productIdCandidates.length > 0) {
      family = await db.productFamily.findFirst({
        where: {
          storeId: store.id,
          status: 'ACTIVE',
          shopifyProductId: { in: productIdCandidates },
        },
        select: { id: true },
      });

      // If not found as ACTIVE, check if it exists but is DRAFT/ARCHIVED
      if (!family) {
        const inactive = await db.productFamily.findFirst({
          where: {
            storeId: store.id,
            shopifyProductId: { in: productIdCandidates },
          },
          select: { id: true, status: true, name: true },
        });
        if (inactive) {
          debug.familyFoundInactive = true;
          console.warn('[storefront/configurator] Family found but not ACTIVE:', inactive.name, inactive.status);
          return Response.json(
            {
              error: 'FAMILY_NOT_ACTIVE',
              message: `Product family "${inactive.name}" exists but has status "${inactive.status}". Set it to ACTIVE in the admin to display the configurator.`,
              debug,
            },
            { status: 404, headers: corsHeaders() }
          );
        }
      }
    }

    if (!family && handle) {
      family = await db.productFamily.findFirst({
        where: {
          storeId: store.id,
          status: 'ACTIVE',
          OR: [{ handle }, { slug: handle }],
        },
        select: { id: true },
      });

      // Same inactive check for handle lookup
      if (!family) {
        const inactive = await db.productFamily.findFirst({
          where: {
            storeId: store.id,
            OR: [{ handle }, { slug: handle }],
          },
          select: { id: true, status: true, name: true },
        });
        if (inactive) {
          debug.familyFoundInactive = true;
          return Response.json(
            {
              error: 'FAMILY_NOT_ACTIVE',
              message: `Product family "${inactive.name}" exists but has status "${inactive.status}". Set it to ACTIVE.`,
              debug,
            },
            { status: 404, headers: corsHeaders() }
          );
        }
      }
    }

    if (!family) {
      console.warn('[storefront/configurator] No family found', debug);
      return Response.json(
        {
          error: 'PRODUCT_FAMILY_NOT_FOUND',
          message: 'No configurator found for this product. Check that the product family is linked to this Shopify product and set to ACTIVE.',
          debug,
        },
        { status: 404, headers: corsHeaders() }
      );
    }

    // ── Load full configurator data ──
    const fullFamily = await db.productFamily.findUnique({
      where: { id: family.id },
      select: {
        id: true,
        name: true,
        handle: true,
        basePrice: true,
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            displayType: true,
            sortOrder: true,
            isRequired: true,
            helperText: true,
            stepNumber: true,
            isConditional: true,
            visibilityConditions: true,
            values: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                slug: true,
                sortOrder: true,
                isDefault: true,
                swatchColor: true,
                thumbnailUrl: true,
                description: true,
                shopifyVariantId: true,
                shopifyPrice: true,
                shopifyImageUrl: true,
              },
            },
          },
        },
        priceRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            optionGroupSlug: true,
            optionValueSlug: true,
            priceModifier: true,
            modifierType: true,
            conditions: true,
          },
        },
      },
    });

    if (!fullFamily) {
      return Response.json(
        { error: 'LOAD_FAILED', message: 'Configurator data could not be loaded', debug },
        { status: 500, headers: corsHeaders() }
      );
    }

    return Response.json(
      { configurator: fullFamily },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/configurator] Error:', message, error);
    return Response.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to load configurator', debug },
      { status: 500, headers: corsHeaders() }
    );
  }
}
