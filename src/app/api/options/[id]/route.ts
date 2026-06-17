import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  OptionGroupError,
} from '@/services/option-group.service';

export const dynamic = 'force-dynamic';

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/GET]', message, error);
    return tenantError(`Failed to fetch option group: ${message}`, 500);
  }
}

// PUT /api/options/[id]
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
      variantProfileId: body.variantProfileId,
      isConditional: body.isConditional,
      visibilityConditions: body.visibilityConditions,
    });

    return tenantResponse({ optionGroup: group });
  } catch (error: unknown) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/PUT]', message, error);
    return tenantError(`Failed to update option group: ${message}`, 500);
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
  } catch (error: unknown) {
    if (error instanceof OptionGroupError) {
      return tenantError(error.message, error.httpStatus);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/[id]/DELETE]', message, error);
    return tenantError(`Failed to delete option group: ${message}`, 500);
  }
}
