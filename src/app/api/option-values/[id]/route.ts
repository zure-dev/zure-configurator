import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getOptionValue,
  updateOptionValue,
  deleteOptionValue,
  OptionValueError,
} from '@/services/option-value.service';

// GET /api/option-values/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const value = await getOptionValue(tenant.storeId, params.id);
    if (!value) return tenantError('Option value not found', 404);

    return tenantResponse({ optionValue: value });
  } catch (error) {
    if (error instanceof OptionValueError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[option-values/[id]/GET]', error);
    return tenantError('Failed to fetch option value', 500);
  }
}

// PUT /api/option-values/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    const value = await updateOptionValue(tenant.storeId, params.id, {
      name: body.name,
      slug: body.slug,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
      swatchColor: body.swatchColor,
      swatchImage: body.swatchImage,
      thumbnailUrl: body.thumbnailUrl,
      description: body.description,
      metadata: body.metadata,
      shopifyProductId: body.shopifyProductId,
      shopifyVariantId: body.shopifyVariantId,
      shopifyProductTitle: body.shopifyProductTitle,
      shopifyVariantTitle: body.shopifyVariantTitle,
      shopifySku: body.shopifySku,
      shopifyImageUrl: body.shopifyImageUrl,
      shopifyPrice: body.shopifyPrice,
    });

    return tenantResponse({ optionValue: value });
  } catch (error) {
    if (error instanceof OptionValueError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[option-values/[id]/PUT]', error);
    return tenantError('Failed to update option value', 500);
  }
}

// DELETE /api/option-values/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await deleteOptionValue(tenant.storeId, params.id);

    return tenantResponse({ deleted: true });
  } catch (error) {
    if (error instanceof OptionValueError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[option-values/[id]/DELETE]', error);
    return tenantError('Failed to delete option value', 500);
  }
}
