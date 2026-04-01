import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listProductFamilies,
  createProductFamily,
  ProductFamilyError,
} from '@/services/product-family.service';

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
// If handle is omitted, it's auto-generated from name.
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.name) {
      return tenantError('name is required');
    }

    const family = await createProductFamily(tenant.storeId, {
      name: body.name,
      handle: body.handle ?? body.slug, // accept slug for backward compat
      category: body.category,
      description: body.description,
      shopifyProductId: body.shopifyProductId ?? body.shopify_product_id,
      basePrice: body.basePrice,
      status: body.status,
    });

    return tenantResponse({ family }, 201);
  } catch (error) {
    if (error instanceof ProductFamilyError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[product-families/POST]', error);
    return tenantError('Failed to create product family', 500);
  }
}
