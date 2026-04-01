import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getProductFamily,
  updateProductFamily,
  deleteProductFamily,
  ProductFamilyError,
} from '@/services/product-family.service';

// GET /api/product-families/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const family = await getProductFamily(tenant.storeId, params.id);
    if (!family) return tenantError('Product family not found', 404);

    return tenantResponse({ family });
  } catch (error) {
    console.error('[product-families/[id]/GET]', error);
    return tenantError('Failed to fetch product family', 500);
  }
}

// PUT /api/product-families/[id]
// Body: { name?, handle?, category?, description?, shopifyProductId?, basePrice?, status?, defaultMediaSet? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    const family = await updateProductFamily(tenant.storeId, params.id, {
      name: body.name,
      handle: body.handle ?? body.slug, // accept slug for backward compat
      category: body.category,
      description: body.description,
      shopifyProductId: body.shopifyProductId ?? body.shopify_product_id,
      basePrice: body.basePrice,
      status: body.status,
      defaultMediaSet: body.defaultMediaSet,
    });

    return tenantResponse({ family });
  } catch (error) {
    if (error instanceof ProductFamilyError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[product-families/[id]/PUT]', error);
    return tenantError('Failed to update product family', 500);
  }
}

// DELETE /api/product-families/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await deleteProductFamily(tenant.storeId, params.id);

    return tenantResponse({ deleted: true });
  } catch (error) {
    if (error instanceof ProductFamilyError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[product-families/[id]/DELETE]', error);
    return tenantError('Failed to delete product family', 500);
  }
}
