import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listOptionValuesByGroupSlug,
  createOptionValueByGroupSlug,
  OptionValueError,
} from '@/services/option-value.service';

// GET /api/option-values?familyId=xxx&groupSlug=stone-type
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant?.storeId) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    const groupSlug = request.nextUrl.searchParams.get('groupSlug');

    if (!familyId || !groupSlug) {
      return tenantError('familyId and groupSlug are required', 400);
    }

    const values = await listOptionValuesByGroupSlug(
      tenant.storeId,
      familyId,
      groupSlug
    );

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
// Body: { familyId, groupSlug, name, slug?, sortOrder?, isDefault?, swatchColor?, swatchImage?, thumbnailUrl?, description?, metadata? }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant?.storeId) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.familyId || !body.groupSlug || !body.name) {
      return tenantError('familyId, groupSlug and name are required', 400);
    }

    const value = await createOptionValueByGroupSlug(tenant.storeId, {
      familyId: body.familyId,
      groupSlug: body.groupSlug,
      name: body.name,
      slug: body.slug,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
      swatchColor: body.swatchColor,
      swatchImage: body.swatchImage,
      thumbnailUrl: body.thumbnailUrl,
      description: body.description,
      metadata: body.metadata,
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