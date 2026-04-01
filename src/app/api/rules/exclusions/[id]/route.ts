import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  getExclusionRule,
  updateExclusionRule,
  deleteExclusionRule,
  RuleError,
} from '@/services/rule.service';

// GET /api/rules/exclusions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const rule = await getExclusionRule(tenant.storeId, params.id);
    if (!rule) return tenantError('Exclusion rule not found', 404);

    return tenantResponse({ rule });
  } catch (error) {
    console.error('[rules/exclusions/[id]/GET]', error);
    return tenantError('Failed to fetch exclusion rule', 500);
  }
}

// PUT /api/rules/exclusions/[id]
// Body: { name?, description?, whenOptionGroupSlug?, whenOptionValueSlug?, excludeOptionGroupSlug?, excludeOptionValueSlugs?, isActive?, sortOrder? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    const rule = await updateExclusionRule(tenant.storeId, params.id, {
      name: body.name,
      description: body.description,
      whenOptionGroupSlug: body.whenOptionGroupSlug,
      whenOptionValueSlug: body.whenOptionValueSlug,
      excludeOptionGroupSlug: body.excludeOptionGroupSlug,
      excludeOptionValueSlugs: body.excludeOptionValueSlugs,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    return tenantResponse({ rule });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/exclusions/[id]/PUT]', error);
    return tenantError('Failed to update exclusion rule', 500);
  }
}

// DELETE /api/rules/exclusions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await deleteExclusionRule(tenant.storeId, params.id);
    return tenantResponse({ deleted: true });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/exclusions/[id]/DELETE]', error);
    return tenantError('Failed to delete exclusion rule', 500);
  }
}
