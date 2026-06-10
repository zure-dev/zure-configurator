import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/storefront/proxy
//
// Shopify App Proxy endpoint.
// Shopify forwards:  /apps/configurator?productId=X&handle=Y
//   →  https://your-app.com/api/storefront/proxy?shop=X&productId=X&handle=Y&signature=...
//
// The shop param is added automatically by Shopify.
// Returns JSON (Shopify App Proxy supports application/json).
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const shopDomain = request.nextUrl.searchParams.get('shop') ?? '';
  const productId = request.nextUrl.searchParams.get('productId') ?? '';
  const handle = request.nextUrl.searchParams.get('handle') ?? '';

  const debug = {
    shop: shopDomain,
    productId,
    handle,
    normalizedProductIds: [] as string[],
    storeFound: false,
    familyFoundInactive: false,
  };

  try {
    if (!shopDomain) {
      return Response.json({ error: 'MISSING_SHOP', message: 'shop parameter is required', debug });
    }

    if (!productId && !handle) {
      return Response.json({ error: 'MISSING_PRODUCT', message: 'productId or handle is required', debug });
    }

    // Resolve store
    const store = await db.store.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true },
    });

    if (!store) {
      return Response.json({ error: 'STORE_NOT_FOUND', message: `No store found for "${shopDomain}"`, debug });
    }

    debug.storeFound = true;

    // Build all possible product ID formats
    const productIdCandidates: string[] = [];
    if (productId) {
      productIdCandidates.push(productId);
      if (/^\d+$/.test(productId)) {
        productIdCandidates.push(`gid://shopify/Product/${productId}`);
      }
      const gidMatch = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
      if (gidMatch) {
        const numericPart = gidMatch[1];
        if (numericPart) productIdCandidates.push(numericPart);
      }
    }
    debug.normalizedProductIds = productIdCandidates;

    // Resolve product family
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

      if (!family) {
        const inactive = await db.productFamily.findFirst({
          where: { storeId: store.id, shopifyProductId: { in: productIdCandidates } },
          select: { id: true, status: true, name: true },
        });
        if (inactive) {
          debug.familyFoundInactive = true;
          return Response.json({
            error: 'FAMILY_NOT_ACTIVE',
            message: `"${inactive.name}" has status "${inactive.status}". Set to ACTIVE.`,
            debug,
          });
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
    }

    if (!family) {
      return Response.json({ error: 'PRODUCT_FAMILY_NOT_FOUND', message: 'No configurator for this product.', debug });
    }

    // Load configurator data
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
              },
            },
          },
        },
        priceRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            optionGroupSlug: true, optionValueSlug: true,
            priceModifier: true, modifierType: true, conditions: true,
          },
        },
      },
    });

    if (!fullFamily) {
      return Response.json({ error: 'LOAD_FAILED', message: 'Could not load configurator data', debug });
    }

    return Response.json({ configurator: fullFamily });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[storefront/proxy]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to load configurator', debug });
  }
}
