import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listOptionGroups,
  listAllOptionGroups,
  createOptionGroup,
  OptionGroupError,
} from '@/services/option-group.service';

// GET /api/options?familyId=xxx
// Returns groups for a specific product family
//
// GET /api/options
// Returns all option groups for the current store
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) {
      return tenantError('Unauthorized', 401);
    }

    const familyId = request.nextUrl.searchParams.get('familyId');

    if (familyId) {
      const groups = await listOptionGroups(tenant.storeId, familyId);
      return tenantResponse({ optionGroups: groups });
    }

    const groups = await listAllOptionGroups(tenant.storeId);
    return tenantResponse({ optionGroups: groups });
  } catch (error) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }

    console.error('[options/GET]', error);
    return tenantError('Failed to fetch option groups', 500);
  }
}

// POST /api/options
// Body:
// {
//   productFamilyId: string,
//   name: string,
//   slug?: string,
//   displayType?: string,
//   sortOrder?: number,
//   isRequired?: boolean,
//   helperText?: string,
//   stepNumber?: number
// }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) {
      return tenantError('Unauthorized', 401);
    }

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
    });

    return tenantResponse({ optionGroup: group }, 201);
  } catch (error) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }

    console.error('[options/POST]', error);
    return tenantError('Failed to create option group', 500);
  }
}