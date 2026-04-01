import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import {
  listDependencyRules,
  createDependencyRule,
  RuleError,
} from '@/services/rule.service';

// GET /api/rules/dependencies?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const rules = await listDependencyRules(tenant.storeId, familyId);
    return tenantResponse({ rules });
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/dependencies/GET]', error);
    return tenantError('Failed to fetch dependency rules', 500);
  }
}

// POST /api/rules/dependencies
// Body: { productFamilyId, name?, description?, whenOptionGroupSlug, whenOptionValueSlug, thenOptionGroupSlug, thenOptionValueSlugs[], isActive?, sortOrder? }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body.productFamilyId || !body.whenOptionGroupSlug || !body.whenOptionValueSlug || !body.thenOptionGroupSlug || !body.thenOptionValueSlugs?.length) {
      return tenantError('productFamilyId, whenOptionGroupSlug, whenOptionValueSlug, thenOptionGroupSlug, and thenOptionValueSlugs are required');
    }

    const rule = await createDependencyRule(tenant.storeId, {
      productFamilyId: body.productFamilyId,
      name: body.name,
      description: body.description,
      whenOptionGroupSlug: body.whenOptionGroupSlug,
      whenOptionValueSlug: body.whenOptionValueSlug,
      thenOptionGroupSlug: body.thenOptionGroupSlug,
      thenOptionValueSlugs: body.thenOptionValueSlugs,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    return tenantResponse({ rule }, 201);
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/dependencies/POST]', error);
    return tenantError('Failed to create dependency rule', 500);
  }
}
