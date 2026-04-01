import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listExclusionRules,
  createExclusionRule,
  RuleError,
} from '@/services/rule.service';

// GET /api/rules/exclusions?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const rules = await listExclusionRules(tenant.storeId, familyId);
    return tenantResponse({ rules });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/exclusions/GET]', error);
    return tenantError('Failed to fetch exclusion rules', 500);
  }
}

// POST /api/rules/exclusions
// Body: { productFamilyId, name?, description?, whenOptionGroupSlug, whenOptionValueSlug, excludeOptionGroupSlug, excludeOptionValueSlugs[], isActive?, sortOrder? }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.productFamilyId || !body.whenOptionGroupSlug || !body.whenOptionValueSlug || !body.excludeOptionGroupSlug || !body.excludeOptionValueSlugs?.length) {
      return tenantError('productFamilyId, whenOptionGroupSlug, whenOptionValueSlug, excludeOptionGroupSlug, and excludeOptionValueSlugs are required');
    }

    const rule = await createExclusionRule(tenant.storeId, {
      productFamilyId: body.productFamilyId,
      name: body.name,
      description: body.description,
      whenOptionGroupSlug: body.whenOptionGroupSlug,
      whenOptionValueSlug: body.whenOptionValueSlug,
      excludeOptionGroupSlug: body.excludeOptionGroupSlug,
      excludeOptionValueSlugs: body.excludeOptionValueSlugs,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    return tenantResponse({ rule }, 201);
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/exclusions/POST]', error);
    return tenantError('Failed to create exclusion rule', 500);
  }
}
