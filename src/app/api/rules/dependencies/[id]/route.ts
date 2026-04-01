import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getDependencyRule,
  updateDependencyRule,
  deleteDependencyRule,
  RuleError,
} from '@/services/rule.service';

// GET /api/rules/dependencies/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const rule = await getDependencyRule(tenant.storeId, params.id);
    if (!rule) return tenantError('Dependency rule not found', 404);

    return tenantResponse({ rule });
  } catch (error) {
    console.error('[rules/dependencies/[id]/GET]', error);
    return tenantError('Failed to fetch dependency rule', 500);
  }
}

// PUT /api/rules/dependencies/[id]
// Body: { name?, description?, whenOptionGroupSlug?, whenOptionValueSlug?, thenOptionGroupSlug?, thenOptionValueSlugs?, isActive?, sortOrder? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    const rule = await updateDependencyRule(tenant.storeId, params.id, {
      name: body.name,
      description: body.description,
      whenOptionGroupSlug: body.whenOptionGroupSlug,
      whenOptionValueSlug: body.whenOptionValueSlug,
      thenOptionGroupSlug: body.thenOptionGroupSlug,
      thenOptionValueSlugs: body.thenOptionValueSlugs,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    return tenantResponse({ rule });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/dependencies/[id]/PUT]', error);
    return tenantError('Failed to update dependency rule', 500);
  }
}

// DELETE /api/rules/dependencies/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await deleteDependencyRule(tenant.storeId, params.id);
    return tenantResponse({ deleted: true });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/dependencies/[id]/DELETE]', error);
    return tenantError('Failed to delete dependency rule', 500);
  }
}
