import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { listAllRules, RuleError } from '@/services/rule.service';

// GET /api/rules?familyId=xxx
// Returns both dependency and exclusion rules for a product family
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const rules = await listAllRules(tenant.storeId, familyId);
    return tenantResponse(rules);
  } catch (error) {
    if (error instanceof RuleError) return tenantError(error.message, error.httpStatus);
    console.error('[rules/GET]', error);
    return tenantError('Failed to fetch rules', 500);
  }
}
