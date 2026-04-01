import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET /api/rules/pricing?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const family = await db.productFamily.findFirst({
      where: { id: familyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    const rules = await db.priceRule.findMany({
      where: { productFamilyId: familyId },
      orderBy: [{ optionGroupSlug: 'asc' }, { sortOrder: 'asc' }],
    });

    return tenantResponse({ rules });
  } catch (error) {
    console.error('[rules/pricing/GET]', error);
    return tenantError('Failed to fetch price rules', 500);
  }
}

// POST /api/rules/pricing
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, optionGroupSlug, optionValueSlug, priceModifier, modifierType, conditions, name } = body;

    if (!productFamilyId || !optionGroupSlug || !optionValueSlug || priceModifier === undefined) {
      return tenantError('Missing required fields');
    }

    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    const rule = await db.priceRule.create({
      data: {
        productFamilyId,
        name,
        optionGroupSlug,
        optionValueSlug,
        priceModifier,
        modifierType: modifierType ?? 'ADDITIVE',
        conditions,
      },
    });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'CREATE',
      entityType: 'PriceRule',
      entityId: rule.id,
      after: rule,
    });

    return tenantResponse({ rule }, 201);
  } catch (error) {
    console.error('[rules/pricing/POST]', error);
    return tenantError('Failed to create price rule', 500);
  }
}

// PUT /api/rules/pricing — bulk upsert price rules
export async function PUT(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, rules } = body;

    if (!productFamilyId || !Array.isArray(rules)) {
      return tenantError('productFamilyId and rules array required');
    }

    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    // Delete existing rules for this family and recreate
    await db.priceRule.deleteMany({ where: { productFamilyId } });

    const created = await Promise.all(
      rules.map((r: any, i: number) =>
        db.priceRule.create({
          data: {
            productFamilyId,
            name: r.name,
            optionGroupSlug: r.optionGroupSlug,
            optionValueSlug: r.optionValueSlug,
            priceModifier: r.priceModifier,
            modifierType: r.modifierType ?? 'ADDITIVE',
            conditions: r.conditions,
            sortOrder: r.sortOrder ?? i,
          },
        })
      )
    );

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'UPDATE',
      entityType: 'PriceRule',
      entityId: productFamilyId,
      metadata: { bulkCount: created.length },
    });

    return tenantResponse({ rules: created });
  } catch (error) {
    console.error('[rules/pricing/PUT]', error);
    return tenantError('Failed to update price rules', 500);
  }
}
