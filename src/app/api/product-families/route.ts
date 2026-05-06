import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import {
  listProductFamilies,
  createProductFamily,
  ProductFamilyError,
} from '@/services/product-family.service';

export const dynamic = 'force-dynamic';

// GET /api/product-families — list all product families for the store
// Optional query params: ?status=ACTIVE&category=vanities
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const status = request.nextUrl.searchParams.get('status') as any ?? undefined;
    const category = request.nextUrl.searchParams.get('category') ?? undefined;

    const families = await listProductFamilies(tenant.storeId, { status, category });
    return tenantResponse({ families });
  } catch (error) {
    console.error('[product-families/GET]', error);
    return tenantError('Failed to fetch product families', 500);
  }
}

// POST /api/product-families — create a new product family
// Body: { name, handle?, category?, description?, shopifyProductId?, basePrice?, status? }
// Also accepts: { shopifyVariantId?, shopifyProductHandle? } for Shopify link creation.
// If handle is omitted, it's auto-generated from name.
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.name) {
      return tenantError('name is required');
    }

    // ── Duplicate Shopify product check ──
    const shopifyProductId = body.shopifyProductId ?? body.shopify_product_id ?? null;
    if (shopifyProductId) {
      const existing = await db.productFamily.findFirst({
        where: {
          storeId: tenant.storeId,
          shopifyProductId,
        },
        select: { id: true, name: true },
      });

      if (existing) {
        return tenantError(
          `A product family "${existing.name}" is already linked to this Shopify product`,
          409
        );
      }
    }

    const family = await createProductFamily(tenant.storeId, {
      name: body.name,
      handle: body.handle ?? body.slug, // accept slug for backward compat
      category: body.category,
      description: body.description,
      shopifyProductId,
      basePrice: body.basePrice,
      status: body.status,
    });

    // ── Create ShopifyLink record if Shopify data provided ──
    if (shopifyProductId) {
      // Extract numeric ID from GID
      const numericId = shopifyProductId.includes('/')
        ? shopifyProductId.split('/').pop() ?? null
        : null;

      await db.productFamilyShopifyLink.create({
        data: {
          productFamilyId: family.id,
          shopifyProductId,
          shopifyProductNumericId: numericId,
          shopifyVariantId: body.shopifyVariantId ?? null,
          shopifyVariantNumericId: body.shopifyVariantId?.includes('/')
            ? body.shopifyVariantId.split('/').pop() ?? null
            : null,
          shopifyProductHandle: body.shopifyProductHandle ?? body.handle ?? null,
          syncedAt: new Date(),
        },
      });
    }

    return tenantResponse({ family }, 201);
  } catch (error) {
    if (error instanceof ProductFamilyError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[product-families/POST]', error);
    return tenantError('Failed to create product family', 500);
  }
}
