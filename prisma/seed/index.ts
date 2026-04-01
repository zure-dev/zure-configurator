import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Zure Configurator database...');

  // ──── Merchant & Store ────
  const merchant = await prisma.merchant.upsert({
    where: { id: 'merchant_zure' },
    update: {},
    create: {
      id: 'merchant_zure',
      name: 'Zure',
      email: 'admin@zure.com.au',
    },
  });

  const storeDomain = process.env.DEV_STORE_DOMAIN ?? 'zure-store.myshopify.com';

  const store = await prisma.store.upsert({
    where: { shopifyDomain: storeDomain },
    update: {},
    create: {
      id: 'store_zure',
      merchantId: merchant.id,
      shopifyDomain: storeDomain,
      shopifyAccessToken: 'dev-token-replace-in-production',
      shopifyPlan: 'shopify_plus',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      settings: {
        tradeTagName: 'trade',
        themeName: 'Xtra',
      },
    },
  });

  console.log(`  ✓ Merchant: ${merchant.name}`);
  console.log(`  ✓ Store: ${store.shopifyDomain}`);

  // ──── Product Family ────
  const family = await prisma.productFamily.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'zure-vanity' } },
    update: {},
    create: {
      id: 'pf_zure_vanity',
      storeId: store.id,
      name: 'Zure Vanity',
      handle: 'zure-vanity',
      slug: 'zure-vanity',
      category: 'vanities',
      description: 'Configurable bathroom vanity — 600mm to 1500mm',
      status: 'ACTIVE',
      basePrice: 1299,
      defaultMediaSet: [
        { url: '/images/vanity-default-hero.jpg', alt: 'Zure Vanity', sortOrder: 0, type: 'hero' },
        { url: '/images/vanity-default-angle.jpg', alt: 'Zure Vanity Angle', sortOrder: 1, type: 'gallery' },
      ],
    },
  });

  console.log(`  ✓ Product Family: ${family.name}`);

  // ──── Option Groups & Values ────
  const optionGroupsData = [
    {
      slug: 'vanity-size', name: 'Vanity Size', displayType: 'TILE', sortOrder: 1, stepNumber: 1,
      values: [
        { slug: '600mm', name: '600mm', sortOrder: 0, isDefault: true },
        { slug: '750mm', name: '750mm', sortOrder: 1 },
        { slug: '900mm', name: '900mm', sortOrder: 2 },
        { slug: '1200mm', name: '1200mm', sortOrder: 3 },
        { slug: '1500mm', name: '1500mm', sortOrder: 4 },
      ],
    },
    {
      slug: 'cabinet-finish', name: 'Cabinet Finish', displayType: 'SWATCH', sortOrder: 2, stepNumber: 1,
      values: [
        { slug: 'matte-white', name: 'Matte White', sortOrder: 0, isDefault: true, swatchColor: '#FFFFFF' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, swatchColor: '#1A1A1A' },
        { slug: 'woodland-oak', name: 'Woodland Oak', sortOrder: 2, swatchColor: '#8B6914' },
        { slug: 'dark-timber', name: 'Dark Timber', sortOrder: 3, swatchColor: '#3E2723' },
      ],
    },
    {
      slug: 'stone-top', name: 'Stone Top', displayType: 'TILE', sortOrder: 3, stepNumber: 2,
      values: [
        { slug: 'no-top', name: 'No Top (Cabinet Only)', sortOrder: 0 },
        { slug: 'stone-white', name: 'Stone White', sortOrder: 1, isDefault: true },
        { slug: 'calacatta-quartz', name: 'Calacatta Quartz', sortOrder: 2 },
        { slug: 'engineered-stone', name: 'Engineered Stone', sortOrder: 3 },
      ],
    },
    {
      slug: 'basin-type', name: 'Basin Type', displayType: 'THUMBNAIL', sortOrder: 4, stepNumber: 3, isRequired: false,
      values: [
        { slug: 'no-basin', name: 'No Basin', sortOrder: 0 },
        { slug: 'undermount', name: 'Undermount', sortOrder: 1, isDefault: true },
        { slug: 'above-counter-oval', name: 'Above Counter Oval', sortOrder: 2 },
        { slug: 'above-counter-rect', name: 'Above Counter Rectangle', sortOrder: 3 },
      ],
    },
    {
      slug: 'basin-position', name: 'Basin Position', displayType: 'TILE', sortOrder: 5, stepNumber: 4, isRequired: false,
      values: [
        { slug: 'centre', name: 'Centre', sortOrder: 0, isDefault: true },
        { slug: 'left', name: 'Left', sortOrder: 1 },
        { slug: 'right', name: 'Right', sortOrder: 2 },
        { slug: 'double', name: 'Double', sortOrder: 3 },
      ],
    },
    {
      slug: 'tap-holes', name: 'Tap Holes', displayType: 'RADIO', sortOrder: 6, stepNumber: 4,
      values: [
        { slug: 'no-hole', name: 'No Tap Hole', sortOrder: 0 },
        { slug: '1-hole', name: '1 Tap Hole', sortOrder: 1, isDefault: true },
        { slug: '3-holes', name: '3 Tap Holes', sortOrder: 2 },
      ],
    },
    {
      slug: 'handle-colour', name: 'Handle Colour', displayType: 'SWATCH', sortOrder: 7, stepNumber: 5,
      values: [
        { slug: 'chrome', name: 'Chrome', sortOrder: 0, isDefault: true, swatchColor: '#C0C0C0' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, swatchColor: '#1A1A1A' },
        { slug: 'brushed-nickel', name: 'Brushed Nickel', sortOrder: 2, swatchColor: '#B0A898' },
        { slug: 'brushed-gold', name: 'Brushed Gold', sortOrder: 3, swatchColor: '#CFB53B' },
      ],
    },
    {
      slug: 'plug-waste', name: 'Plug & Waste', displayType: 'DROPDOWN', sortOrder: 8, stepNumber: 6, isRequired: false,
      values: [
        { slug: 'none', name: 'None', sortOrder: 0, isDefault: true },
        { slug: 'chrome-popup', name: 'Chrome Pop-Up', sortOrder: 1 },
        { slug: 'matte-black-popup', name: 'Matte Black Pop-Up', sortOrder: 2 },
        { slug: 'brushed-nickel-popup', name: 'Brushed Nickel Pop-Up', sortOrder: 3 },
      ],
    },
  ];

  for (const groupData of optionGroupsData) {
    const { values, ...groupFields } = groupData;
    const group = await prisma.optionGroup.upsert({
      where: { productFamilyId_slug: { productFamilyId: family.id, slug: groupFields.slug } },
      update: {},
      create: {
        productFamilyId: family.id,
        isRequired: groupFields.isRequired ?? true,
        ...groupFields,
      },
    });

    for (const valueData of values) {
      await prisma.optionValue.upsert({
        where: { optionGroupId_slug: { optionGroupId: group.id, slug: valueData.slug } },
        update: {},
        create: {
          optionGroupId: group.id,
          isDefault: valueData.isDefault ?? false,
          ...valueData,
        },
      });
    }

    console.log(`  ✓ Option Group: ${group.name} (${values.length} values)`);
  }

  // ──── Dependency Rules ────
  const dependencies = [
    { name: '600mm → centre basin only', when: ['vanity-size', '600mm'], then: ['basin-position', ['centre']] },
    { name: '1200mm → all positions', when: ['vanity-size', '1200mm'], then: ['basin-position', ['centre', 'left', 'right', 'double']] },
    { name: '1500mm → all positions', when: ['vanity-size', '1500mm'], then: ['basin-position', ['centre', 'left', 'right', 'double']] },
    { name: 'No top → no basin', when: ['stone-top', 'no-top'], then: ['basin-type', ['no-basin']] },
    { name: 'No top → no tap holes', when: ['stone-top', 'no-top'], then: ['tap-holes', ['no-hole']] },
  ];

  for (const dep of dependencies) {
    await prisma.optionDependencyRule.create({
      data: {
        productFamilyId: family.id,
        name: dep.name,
        whenOptionGroupSlug: dep.when[0]!,
        whenOptionValueSlug: dep.when[1]!,
        thenOptionGroupSlug: dep.then[0] as string,
        thenOptionValueSlugs: dep.then[1] as string[],
      },
    });
  }
  console.log(`  ✓ Dependency rules: ${dependencies.length}`);

  // ──── Exclusion Rules ────
  const exclusions = [
    { name: 'Above counter oval → no 3 tap holes', when: ['basin-type', 'above-counter-oval'], exclude: ['tap-holes', ['3-holes']] },
    { name: 'Above counter rect → no 3 tap holes', when: ['basin-type', 'above-counter-rect'], exclude: ['tap-holes', ['3-holes']] },
  ];

  for (const exc of exclusions) {
    await prisma.optionExclusionRule.create({
      data: {
        productFamilyId: family.id,
        name: exc.name,
        whenOptionGroupSlug: exc.when[0]!,
        whenOptionValueSlug: exc.when[1]!,
        excludeOptionGroupSlug: exc.exclude[0] as string,
        excludeOptionValueSlugs: exc.exclude[1] as string[],
      },
    });
  }
  console.log(`  ✓ Exclusion rules: ${exclusions.length}`);

  // ──── Retail Price Rules ────
  const priceRules = [
    ['vanity-size', '750mm', 200], ['vanity-size', '900mm', 400],
    ['vanity-size', '1200mm', 700], ['vanity-size', '1500mm', 1000],
    ['stone-top', 'calacatta-quartz', 269], ['stone-top', 'engineered-stone', 349],
    ['stone-top', 'no-top', -200],
    ['basin-type', 'above-counter-oval', 199], ['basin-type', 'above-counter-rect', 229],
    ['handle-colour', 'brushed-gold', 49],
    ['plug-waste', 'chrome-popup', 59], ['plug-waste', 'matte-black-popup', 89],
    ['plug-waste', 'brushed-nickel-popup', 79],
  ];

  for (const [group, value, mod] of priceRules) {
    await prisma.priceRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: group as string,
        optionValueSlug: value as string,
        priceModifier: mod as number,
        modifierType: 'ADDITIVE',
      },
    });
  }
  console.log(`  ✓ Retail price rules: ${priceRules.length}`);

  // ──── Trade Price Rules ────
  const tradePriceRules = [
    ['vanity-size', '750mm', 150], ['vanity-size', '900mm', 300],
    ['vanity-size', '1200mm', 525], ['vanity-size', '1500mm', 750],
    ['stone-top', 'calacatta-quartz', 200], ['stone-top', 'engineered-stone', 260],
    ['basin-type', 'above-counter-oval', 149],
  ];

  for (const [group, value, mod] of tradePriceRules) {
    await prisma.tradePriceRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: group as string,
        optionValueSlug: value as string,
        priceModifier: mod as number,
        modifierType: 'ADDITIVE',
        tradeCondition: { type: 'customer_tag', value: 'trade' },
      },
    });
  }
  console.log(`  ✓ Trade price rules: ${tradePriceRules.length}`);

  // ──── Summary Rules ────
  const summaryRules = [
    ['vanity-size', 'Size: {{value}}', 1],
    ['cabinet-finish', 'Finish: {{value}}', 2],
    ['stone-top', 'Top: {{value}}', 3],
    ['basin-type', 'Basin: {{value}}', 4],
    ['basin-position', 'Position: {{value}}', 5],
    ['tap-holes', 'Tap Holes: {{value}}', 6],
    ['handle-colour', 'Handle: {{value}}', 7],
    ['plug-waste', 'Plug & Waste: {{value}}', 8],
  ];

  for (const [group, template, order] of summaryRules) {
    await prisma.summaryRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: group as string,
        template: template as string,
        sortOrder: order as number,
      },
    });
  }
  console.log(`  ✓ Summary rules: ${summaryRules.length}`);

  // ──── Components ────
  const components = [
    { sku: 'ZV-CAB-MW-600', name: 'Matte White Cabinet 600mm', type: 'CABINET' },
    { sku: 'ZV-CAB-MW-900', name: 'Matte White Cabinet 900mm', type: 'CABINET' },
    { sku: 'ZV-CAB-WO-900', name: 'Woodland Oak Cabinet 900mm', type: 'CABINET' },
    { sku: 'ZV-CAB-WO-1200', name: 'Woodland Oak Cabinet 1200mm', type: 'CABINET' },
    { sku: 'ZV-TOP-SW-600', name: 'Stone White Top 600mm', type: 'STONE_TOP' },
    { sku: 'ZV-TOP-SW-900', name: 'Stone White Top 900mm', type: 'STONE_TOP' },
    { sku: 'ZV-TOP-CAL-900', name: 'Calacatta Quartz Top 900mm', type: 'STONE_TOP' },
    { sku: 'ZV-TOP-CAL-1200', name: 'Calacatta Quartz Top 1200mm', type: 'STONE_TOP' },
    { sku: 'ZV-BAS-UM', name: 'Undermount Basin', type: 'BASIN' },
    { sku: 'ZV-BAS-ACO', name: 'Above Counter Oval Basin', type: 'BASIN' },
    { sku: 'ZV-BAS-ACR', name: 'Above Counter Rectangle Basin', type: 'BASIN' },
    { sku: 'ZV-HDL-CH', name: 'Chrome Handle', type: 'HANDLE' },
    { sku: 'ZV-HDL-MB', name: 'Matte Black Handle', type: 'HANDLE' },
    { sku: 'ZV-HDL-BN', name: 'Brushed Nickel Handle', type: 'HANDLE' },
    { sku: 'ZV-HDL-BG', name: 'Brushed Gold Handle', type: 'HANDLE' },
    { sku: 'ZV-PW-CH-POP', name: 'Chrome Pop-Up Waste', type: 'PLUG_WASTE' },
    { sku: 'ZV-PW-MB-POP', name: 'Matte Black Pop-Up Waste', type: 'PLUG_WASTE' },
    { sku: 'ZV-PW-BN-POP', name: 'Brushed Nickel Pop-Up Waste', type: 'PLUG_WASTE' },
  ];

  const componentRecords: Record<string, string> = {};
  for (const comp of components) {
    const record = await prisma.component.create({
      data: { productFamilyId: family.id, ...comp, type: comp.type as any },
    });
    componentRecords[comp.sku] = record.id;
  }
  console.log(`  ✓ Components: ${components.length}`);

  // ──── Component Maps (subset — full mapping would be extensive) ────
  const componentMaps = [
    { conditions: [{ optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }, { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' }], sku: 'ZV-CAB-WO-900', qty: 1 },
    { conditions: [{ optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }, { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'matte-white' }], sku: 'ZV-CAB-MW-900', qty: 1 },
    { conditions: [{ optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }, { optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz' }], sku: 'ZV-TOP-CAL-900', qty: 1 },
    { conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval' }], sku: 'ZV-BAS-ACO', qty: 1 },
    { conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'undermount' }], sku: 'ZV-BAS-UM', qty: 1 },
    { conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'matte-black' }], sku: 'ZV-HDL-MB', qty: 2 },
    { conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'chrome' }], sku: 'ZV-HDL-CH', qty: 2 },
    { conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'brushed-gold' }], sku: 'ZV-HDL-BG', qty: 2 },
    { conditions: [{ optionGroupSlug: 'plug-waste', optionValueSlug: 'matte-black-popup' }], sku: 'ZV-PW-MB-POP', qty: 1 },
    { conditions: [{ optionGroupSlug: 'plug-waste', optionValueSlug: 'chrome-popup' }], sku: 'ZV-PW-CH-POP', qty: 1 },
  ];

  for (const map of componentMaps) {
    const compId = componentRecords[map.sku];
    if (!compId) continue;
    await prisma.configurationToComponentMap.create({
      data: {
        productFamilyId: family.id,
        conditions: map.conditions,
        componentId: compId,
        quantity: map.qty,
      },
    });
  }
  console.log(`  ✓ Component maps: ${componentMaps.length}`);

  // ──── Rule Version Snapshot ────
  await prisma.ruleVersion.create({
    data: {
      productFamilyId: family.id,
      version: 1,
      description: 'Initial Zure vanity rule set',
      publishedAt: new Date(),
      createdBy: 'seed-script',
      snapshotData: {
        dependencies: dependencies.length,
        exclusions: exclusions.length,
        priceRules: priceRules.length,
        tradePriceRules: tradePriceRules.length,
        summaryRules: summaryRules.length,
        components: components.length,
      },
    },
  });
  console.log('  ✓ Rule version: v1 published');

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
