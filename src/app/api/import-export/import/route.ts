import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// POST /api/import-export/import — import a product family from JSON
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();

    if (!body._exportVersion || !body.productFamily) {
      return tenantError('Invalid import format. Expected export file from Zure Configurator.');
    }

    const pf = body.productFamily;

    // Check slug uniqueness
    const existing = await db.productFamily.findUnique({
      where: { storeId_slug: { storeId: tenant.storeId, slug: pf.slug } },
    });

    const slug = existing ? `${pf.slug}-imported-${Date.now()}` : pf.slug;

    // Create product family
    const family = await db.productFamily.create({
      data: {
        storeId: tenant.storeId,
        name: pf.name,
        handle: slug, // use the (possibly suffixed) slug as handle
        slug,
        category: pf.category ?? null,
        description: pf.description,
        shopifyProductId: pf.shopifyProductId ?? null,
        basePrice: pf.basePrice ?? 0,
        defaultMediaSet: pf.defaultMediaSet,
        status: 'DRAFT', // always import as draft
      },
    });

    // Import option groups + values
    for (const groupData of body.optionGroups ?? []) {
      const { values, ...groupFields } = groupData;
      const group = await db.optionGroup.create({
        data: {
          productFamilyId: family.id,
          ...groupFields,
          displayType: groupFields.displayType ?? 'TILE',
          isRequired: groupFields.isRequired ?? true,
        },
      });

      for (const v of values ?? []) {
        await db.optionValue.create({
          data: {
            optionGroupId: group.id,
            name: v.name,
            slug: v.slug,
            sortOrder: v.sortOrder ?? 0,
            isDefault: v.isDefault ?? false,
            swatchColor: v.swatchColor,
            swatchImage: v.swatchImage,
            thumbnailUrl: v.thumbnailUrl,
            description: v.description,
          },
        });
      }
    }

    // Import dependency rules
    for (const r of body.dependencyRules ?? []) {
      await db.optionDependencyRule.create({
        data: { productFamilyId: family.id, ...r, isActive: r.isActive ?? true },
      });
    }

    // Import exclusion rules
    for (const r of body.exclusionRules ?? []) {
      await db.optionExclusionRule.create({
        data: { productFamilyId: family.id, ...r, isActive: r.isActive ?? true },
      });
    }

    // Import price rules
    for (const r of body.priceRules ?? []) {
      await db.priceRule.create({
        data: { productFamilyId: family.id, ...r, isActive: r.isActive ?? true },
      });
    }

    // Import trade price rules
    for (const r of body.tradePriceRules ?? []) {
      await db.tradePriceRule.create({
        data: { productFamilyId: family.id, ...r, isActive: r.isActive ?? true },
      });
    }

    // Import media rules
    for (const r of body.mediaRules ?? []) {
      await db.mediaRule.create({
        data: { productFamilyId: family.id, ...r, isActive: r.isActive ?? true },
      });
    }

    // Import summary rules
    for (const r of body.summaryRules ?? []) {
      await db.summaryRule.create({
        data: { productFamilyId: family.id, ...r },
      });
    }

    // Import components
    const componentSkuMap: Record<string, string> = {};
    for (const c of body.components ?? []) {
      const comp = await db.component.create({
        data: { productFamilyId: family.id, ...c, type: c.type as any },
      });
      componentSkuMap[c.sku] = comp.id;
    }

    // Import component maps
    for (const m of body.componentMaps ?? []) {
      const compId = componentSkuMap[m.componentSku];
      if (!compId) continue;
      await db.configurationToComponentMap.create({
        data: {
          productFamilyId: family.id,
          conditions: m.conditions,
          componentId: compId,
          quantity: m.quantity ?? 1,
        },
      });
    }

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'IMPORT',
      entityType: 'ProductFamily',
      entityId: family.id,
      metadata: {
        source: body._source,
        exportedAt: body._exportedAt,
        originalSlug: pf.slug,
      },
    });

    return tenantResponse({
      family,
      imported: {
        optionGroups: body.optionGroups?.length ?? 0,
        dependencyRules: body.dependencyRules?.length ?? 0,
        exclusionRules: body.exclusionRules?.length ?? 0,
        priceRules: body.priceRules?.length ?? 0,
        tradePriceRules: body.tradePriceRules?.length ?? 0,
        mediaRules: body.mediaRules?.length ?? 0,
        summaryRules: body.summaryRules?.length ?? 0,
        components: body.components?.length ?? 0,
        componentMaps: body.componentMaps?.length ?? 0,
      },
    }, 201);
  } catch (error) {
    console.error('[import]', error);
    return tenantError('Import failed', 500);
  }
}
