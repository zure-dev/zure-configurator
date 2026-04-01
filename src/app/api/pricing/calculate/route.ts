import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { calculatePricing } from '@/services/pricing-engine.service';
import type { PriceRule } from '@/services/pricing-engine.service';

// POST /api/pricing/calculate
// Body: { productFamilyId, selections: { "vanity-size": "900mm", ... } }
//
// Returns: { basePrice, lineItems, subtotal, total, currency }
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, selections } = body;

    if (!productFamilyId || !selections || typeof selections !== 'object') {
      return tenantError('productFamilyId and selections object are required');
    }

    // Load product family for base price and currency
    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
      include: { store: { select: { currency: true } } },
    });
    if (!family) return tenantError('Product family not found', 404);

    // Load active price rules
    const dbRules = await db.priceRule.findMany({
      where: { productFamilyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Convert Prisma Decimals to numbers for the pure engine
    const priceRules: PriceRule[] = dbRules.map((r) => ({
      id: r.id,
      name: r.name,
      optionGroupSlug: r.optionGroupSlug,
      optionValueSlug: r.optionValueSlug,
      priceModifier: Number(r.priceModifier),
      modifierType: r.modifierType as PriceRule['modifierType'],
      conditions: r.conditions as PriceRule['conditions'],
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    }));

    const result = calculatePricing(
      Number(family.basePrice),
      selections,
      priceRules,
      family.store.currency
    );

    return tenantResponse(result);
  } catch (error) {
    console.error('[pricing/calculate]', error);
    return tenantError('Failed to calculate pricing', 500);
  }
}
