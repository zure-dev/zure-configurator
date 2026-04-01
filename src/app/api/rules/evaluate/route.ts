import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { evaluateRules } from '@/services/rule-engine.service';
import type { OptionGroupValues } from '@/services/rule-engine.service';

// POST /api/rules/evaluate
// Body: { productFamilyId, selections: { "vanity-size": "900mm", ... } }
//
// Returns: { allowed, disabled, firedRules, groups }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, selections } = body;

    if (!productFamilyId || !selections || typeof selections !== 'object') {
      return tenantError('productFamilyId and selections object are required');
    }

    // Verify family ownership
    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    // Load all option groups + values for this family
    const optionGroups = await db.optionGroup.findMany({
      where: { productFamilyId },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    // Load active rules
    const [dependencyRules, exclusionRules] = await Promise.all([
      db.optionDependencyRule.findMany({
        where: { productFamilyId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      db.optionExclusionRule.findMany({
        where: { productFamilyId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    // Build the allGroups map for the engine
    const allGroups: OptionGroupValues[] = optionGroups.map((g) => ({
      groupSlug: g.slug,
      groupName: g.name,
      valueSlugs: g.values.map((v) => v.slug),
    }));

    // Run evaluation (pure function, no DB writes)
    const result = evaluateRules(
      selections,
      dependencyRules,
      exclusionRules,
      allGroups
    );

    return tenantResponse(result);
  } catch (error) {
    console.error('[rules/evaluate]', error);
    return tenantError('Failed to evaluate rules', 500);
  }
}
