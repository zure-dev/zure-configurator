import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listOptionValues,
  createOptionValue,
  OptionValueError,
} from '@/services/option-value.service';

export const dynamic = 'force-dynamic';

// GET /api/option-values?optionGroupId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const optionGroupId = request.nextUrl.searchParams.get('optionGroupId');
    if (!optionGroupId) return tenantError('optionGroupId is required', 400);

    const values = await listOptionValues(tenant.storeId, optionGroupId);
    return tenantResponse({ optionValues: values });
  } catch (error) {
    if (error instanceof OptionValueError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[option-values/GET]', error);
    return tenantError('Failed to fetch option values', 500);
  }
}

// POST /api/option-values
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.optionGroupId || !body.name) {
      return tenantError('optionGroupId and name are required', 400);
    }

    const value = await createOptionValue(tenant.storeId, {
      optionGroupId: body.optionGroupId,
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

    return tenantResponse({ optionValue: value }, 201);
  } catch (error) {
    if (error instanceof OptionValueError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[option-values/POST]', error);
    return tenantError('Failed to create option value', 500);
  }
}
