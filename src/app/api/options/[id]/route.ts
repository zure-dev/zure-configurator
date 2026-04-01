import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  OptionGroupError,
} from '@/services/option-group.service';

// GET /api/options/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const group = await getOptionGroup(tenant.storeId, params.id);
    if (!group) return tenantError('Option group not found', 404);

    return tenantResponse({ optionGroup: group });
  } catch (error) {
    console.error('[options/[id]/GET]', error);
    return tenantError('Failed to fetch option group', 500);
  }
}

// PUT /api/options/[id]
// Body: { name?, slug?, displayType?, sortOrder?, isRequired?, helperText?, stepNumber? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    const group = await updateOptionGroup(tenant.storeId, params.id, {
      name: body.name,
      slug: body.slug,
      displayType: body.displayType,
      sortOrder: body.sortOrder,
      isRequired: body.isRequired,
      helperText: body.helperText,
      stepNumber: body.stepNumber,
    });

    return tenantResponse({ optionGroup: group });
  } catch (error) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[options/[id]/PUT]', error);
    return tenantError('Failed to update option group', 500);
  }
}

// DELETE /api/options/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await deleteOptionGroup(tenant.storeId, params.id);

    return tenantResponse({ deleted: true });
  } catch (error) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    console.error('[options/[id]/DELETE]', error);
    return tenantError('Failed to delete option group', 500);
  }
}
