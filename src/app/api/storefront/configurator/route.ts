import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// CORS headers for storefront cross-origin requests
// ──────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// OPTIONS — preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ──────────────────────────────────────────────
// GET /api/storefront/configurator
//
// Query params:
//   shop       — Shopify domain (required for tenant resolution)
//   productId  — Shopify product GID or numeric ID
//   handle     — Shopify product handle (fallback)
//
// Returns customer-safe configurator data.
// Does NOT expose tokens, audit logs, or admin metadata.
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const shopDomain = request.nextUrl.searchParams.get('shop');
    const productId = request.nextUrl.searchParams.get('productId');
    const handle = request.nextUrl.searchParams.get('handle');

    if (!shopDomain) {
      return Response.json(
        { error: 'shop parameter is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!productId && !handle) {
      return Response.json(
        { error: 'productId or handle is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Resolve store
    const store = await db.store.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true },
    });

    if (!store) {
      return Response.json(
        { error: 'Store not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Resolve product family — try productId first, then handle
    let family = null;

    if (productId) {
      // Try matching by GID or numeric ID
      family = await db.productFamily.findFirst({
        where: {
          storeId: store.id,
          status: 'ACTIVE',
          OR: [
            { shopifyProductId: productId },
            { shopifyProductId: `gid://shopify/Product/${productId}` },
          ],
        },
        select: { id: true },
      });
    }

    if (!family && handle) {
      family = await db.productFamily.findFirst({
        where: {
          storeId: store.id,
          status: 'ACTIVE',
          OR: [
            { handle },
            { slug: handle },
          ],
        },
        select: { id: true },
      });
    }

    if (!family) {
      return Response.json(
        { error: 'No configurator found for this product' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Load full configurator data — customer-safe fields only
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
        { error: 'Configurator data not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    return Response.json(
      { configurator: fullFamily },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/configurator]', message, error);
    return Response.json(
      { error: 'Failed to load configurator' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
