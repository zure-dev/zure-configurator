import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/import-export/export?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const family = await db.productFamily.findFirst({
      where: { id: familyId, storeId: tenant.storeId },
      include: {
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { values: { orderBy: { sortOrder: 'asc' } } },
        },
        dependencyRules: true,
        exclusionRules: true,
        priceRules: true,
        tradePriceRules: true,
        mediaRules: true,
        summaryRules: true,
        components: true,
        componentMaps: true,
      },
    });

    if (!family) return tenantError('Product family not found', 404);

    const exportData = {
      _exportVersion: '1.0',
      _exportedAt: new Date().toISOString(),
      _source: tenant.shopifyDomain,
      productFamily: {
        name: family.name,
        handle: family.handle,
        slug: family.slug,
        category: family.category,
        description: family.description,
        shopifyProductId: family.shopifyProductId,
        basePrice: Number(family.basePrice),
        defaultMediaSet: family.defaultMediaSet,
        status: family.status,
      },
      optionGroups: family.optionGroups.map((g) => ({
        name: g.name,
        slug: g.slug,
        displayType: g.displayType,
        sortOrder: g.sortOrder,
        isRequired: g.isRequired,
        helperText: g.helperText,
        stepNumber: g.stepNumber,
        values: g.values.map((v) => ({
          name: v.name,
          slug: v.slug,
          sortOrder: v.sortOrder,
          isDefault: v.isDefault,
          swatchColor: v.swatchColor,
          swatchImage: v.swatchImage,
          thumbnailUrl: v.thumbnailUrl,
          description: v.description,
        })),
      })),
      dependencyRules: family.dependencyRules.map((r) => ({
        name: r.name,
        whenOptionGroupSlug: r.whenOptionGroupSlug,
        whenOptionValueSlug: r.whenOptionValueSlug,
        thenOptionGroupSlug: r.thenOptionGroupSlug,
        thenOptionValueSlugs: r.thenOptionValueSlugs,
        isActive: r.isActive,
      })),
      exclusionRules: family.exclusionRules.map((r) => ({
        name: r.name,
        whenOptionGroupSlug: r.whenOptionGroupSlug,
        whenOptionValueSlug: r.whenOptionValueSlug,
        excludeOptionGroupSlug: r.excludeOptionGroupSlug,
        excludeOptionValueSlugs: r.excludeOptionValueSlugs,
        isActive: r.isActive,
      })),
      priceRules: family.priceRules.map((r) => ({
        optionGroupSlug: r.optionGroupSlug,
        optionValueSlug: r.optionValueSlug,
        priceModifier: Number(r.priceModifier),
        modifierType: r.modifierType,
        conditions: r.conditions,
        isActive: r.isActive,
      })),
      tradePriceRules: family.tradePriceRules.map((r) => ({
        optionGroupSlug: r.optionGroupSlug,
        optionValueSlug: r.optionValueSlug,
        priceModifier: Number(r.priceModifier),
        modifierType: r.modifierType,
        tradeCondition: r.tradeCondition,
        conditions: r.conditions,
        isActive: r.isActive,
      })),
      mediaRules: family.mediaRules.map((r) => ({
        name: r.name,
        priority: r.priority,
        conditions: r.conditions,
        mediaSet: r.mediaSet,
        isActive: r.isActive,
      })),
      summaryRules: family.summaryRules.map((r) => ({
        optionGroupSlug: r.optionGroupSlug,
        template: r.template,
        sortOrder: r.sortOrder,
        includeInLineItem: r.includeInLineItem,
      })),
      components: family.components.map((c) => ({
        name: c.name,
        sku: c.sku,
        type: c.type,
      })),
      componentMaps: family.componentMaps.map((m) => ({
        conditions: m.conditions,
        componentSku: family.components.find((c) => c.id === m.componentId)?.sku,
        quantity: m.quantity,
      })),
    };

    return tenantResponse(exportData);
  } catch (error) {
    console.error('[export]', error);
    return tenantError('Export failed', 500);
  }
}
