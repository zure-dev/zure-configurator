import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET /api/rules/trade-pricing?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const rules = await db.tradePriceRule.findMany({
      where: { productFamilyId: familyId },
      orderBy: [{ optionGroupSlug: 'asc' }, { sortOrder: 'asc' }],
    });

    return tenantResponse({ rules });
  } catch (error) {
    console.error('[rules/trade-pricing/GET]', error);
    return tenantError('Failed to fetch trade price rules', 500);
  }
}

// POST /api/rules/trade-pricing
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, optionGroupSlug, optionValueSlug, priceModifier, modifierType, tradeCondition, conditions, name } = body;

    if (!productFamilyId || !optionGroupSlug || !optionValueSlug || priceModifier === undefined || !tradeCondition) {
      return tenantError('Missing required fields');
    }

    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    const rule = await db.tradePriceRule.create({
      data: {
        productFamilyId,
        name,
        optionGroupSlug,
        optionValueSlug,
        priceModifier,
        modifierType: modifierType ?? 'ADDITIVE',
        tradeCondition,
        conditions,
      },
    });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'CREATE',
      entityType: 'TradePriceRule',
      entityId: rule.id,
      after: rule,
    });

    return tenantResponse({ rule }, 201);
  } catch (error) {
    console.error('[rules/trade-pricing/POST]', error);
    return tenantError('Failed to create trade price rule', 500);
  }
}

// PUT /api/rules/trade-pricing — bulk upsert
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

    await db.tradePriceRule.deleteMany({ where: { productFamilyId } });

    const created = await Promise.all(
      rules.map((r: any, i: number) =>
        db.tradePriceRule.create({
          data: {
            productFamilyId,
            name: r.name,
            optionGroupSlug: r.optionGroupSlug,
            optionValueSlug: r.optionValueSlug,
            priceModifier: r.priceModifier,
            modifierType: r.modifierType ?? 'ADDITIVE',
            tradeCondition: r.tradeCondition ?? { type: 'customer_tag', value: 'trade' },
            conditions: r.conditions,
            sortOrder: r.sortOrder ?? i,
          },
        })
      )
    );

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'UPDATE',
      entityType: 'TradePriceRule',
      entityId: productFamilyId,
      metadata: { bulkCount: created.length },
    });

    return tenantResponse({ rules: created });
  } catch (error) {
    console.error('[rules/trade-pricing/PUT]', error);
    return tenantError('Failed to update trade price rules', 500);
  }
}
