import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listOptionGroups,
  listAllOptionGroups,
  createOptionGroup,
  OptionGroupError,
} from '@/services/option-group.service';

export const dynamic = 'force-dynamic';

// GET /api/options?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');

    if (familyId) {
      const groups = await listOptionGroups(tenant.storeId, familyId);
      return tenantResponse({ optionGroups: groups });
    }

    const groups = await listAllOptionGroups(tenant.storeId);
    return tenantResponse({ optionGroups: groups });
  } catch (error: unknown) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/GET]', message, error);
    return tenantError(`Failed to fetch option groups: ${message}`, 500);
  }
}

// POST /api/options
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.productFamilyId || !body.name) {
      return tenantError('productFamilyId and name are required', 400);
    }

    const group = await createOptionGroup(tenant.storeId, {
      productFamilyId: body.productFamilyId,
      name: body.name,
      slug: body.slug,
      displayType: body.displayType,
      sortOrder: body.sortOrder,
      isRequired: body.isRequired,
      helperText: body.helperText,
      stepNumber: body.stepNumber,
      isConditional: body.isConditional,
      visibilityConditions: body.visibilityConditions,
    });

    return tenantResponse({ optionGroup: group }, 201);
  } catch (error: unknown) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/POST]', message, error);
    return tenantError(`Failed to create option group: ${message}`, 500);
  }
}
