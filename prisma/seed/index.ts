import {
  ComponentType,
  OptionDisplayType,
  Prisma,
  PrismaClient,
  PriceModifierType,
} from '@prisma/client';

const prisma = new PrismaClient();

type SeedOptionValue = {
  slug: string;
  name: string;
  sortOrder: number;
  isDefault?: boolean;
  swatchColor?: string | null;
};

type SeedOptionGroup = {
  slug: string;
  name: string;
  displayType: OptionDisplayType;
  sortOrder: number;
  stepNumber: number;
  isRequired?: boolean;
  values: SeedOptionValue[];
};

type SeedDependency = {
  name: string;
  whenGroup: string;
  whenValue: string;
  thenGroup: string;
  thenValues: string[];
};

type SeedExclusion = {
  name: string;
  whenGroup: string;
  whenValue: string;
  excludeGroup: string;
  excludeValues: string[];
};

type SeedPriceRule = {
  optionGroupSlug: string;
  optionValueSlug: string;
  priceModifier: number;
};

type SeedSummaryRule = {
  optionGroupSlug: string;
  template: string;
  sortOrder: number;
};

type SeedComponent = {
  sku: string;
  name: string;
  type: ComponentType;
};

type SeedComponentMap = {
  conditions: Array<{
    optionGroupSlug: string;
    optionValueSlug: string;
  }>;
  sku: string;
  qty: number;
};

async function main() {
  console.log('🌱 Seeding Zure Configurator database...');

  const merchant = await prisma.merchant.upsert({
    where: { id: 'merchant_zure' },
    update: {
      name: 'Zure',
      email: 'admin@zure.com.au',
    },
    create: {
      id: 'merchant_zure',
      name: 'Zure',
      email: 'admin@zure.com.au',
    },
  });

  const storeDomain = process.env.DEV_STORE_DOMAIN ?? 'zure-dev-2.myshopify.com';

  const store = await prisma.store.upsert({
    where: { shopifyDomain: storeDomain },
    update: {
      merchantId: merchant.id,
      shopifyPlan: 'shopify_plus',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      settings: {
        tradeTagName: 'trade',
        themeName: 'Xtra',
      },
    },
    create: {
      id: 'store_zure_dev_2',
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

  const family = await prisma.productFamily.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'zure-vanity' } },
    update: {
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

  const optionGroupsData: SeedOptionGroup[] = [
    {
      slug: 'vanity-size',
      name: 'Vanity Size',
      displayType: OptionDisplayType.TILE,
      sortOrder: 1,
      stepNumber: 1,
      values: [
        { slug: '600mm', name: '600mm', sortOrder: 0, isDefault: true },
        { slug: '750mm', name: '750mm', sortOrder: 1 },
        { slug: '900mm', name: '900mm', sortOrder: 2 },
        { slug: '1200mm', name: '1200mm', sortOrder: 3 },
        { slug: '1500mm', name: '1500mm', sortOrder: 4 },
      ],
    },
    {
      slug: 'cabinet-finish',
      name: 'Cabinet Finish',
      displayType: OptionDisplayType.SWATCH,
      sortOrder: 2,
      stepNumber: 1,
      values: [
        { slug: 'matte-white', name: 'Matte White', sortOrder: 0, isDefault: true, swatchColor: '#FFFFFF' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, swatchColor: '#1A1A1A' },
        { slug: 'woodland-oak', name: 'Woodland Oak', sortOrder: 2, swatchColor: '#8B6914' },
        { slug: 'dark-timber', name: 'Dark Timber', sortOrder: 3, swatchColor: '#3E2723' },
      ],
    },
    {
      slug: 'stone-top',
      name: 'Stone Top',
      displayType: OptionDisplayType.TILE,
      sortOrder: 3,
      stepNumber: 2,
      values: [
        { slug: 'no-top', name: 'No Top (Cabinet Only)', sortOrder: 0 },
        { slug: 'stone-white', name: 'Stone White', sortOrder: 1, isDefault: true },
        { slug: 'calacatta-quartz', name: 'Calacatta Quartz', sortOrder: 2 },
        { slug: 'engineered-stone', name: 'Engineered Stone', sortOrder: 3 },
      ],
    },
    {
      slug: 'basin-type',
      name: 'Basin Type',
      displayType: OptionDisplayType.THUMBNAIL,
      sortOrder: 4,
      stepNumber: 3,
      isRequired: false,
      values: [
        { slug: 'no-basin', name: 'No Basin', sortOrder: 0 },
        { slug: 'undermount', name: 'Undermount', sortOrder: 1, isDefault: true },
        { slug: 'above-counter-oval', name: 'Above Counter Oval', sortOrder: 2 },
        { slug: 'above-counter-rect', name: 'Above Counter Rectangle', sortOrder: 3 },
      ],
    },
    {
      slug: 'basin-position',
      name: 'Basin Position',
      displayType: OptionDisplayType.TILE,
      sortOrder: 5,
      stepNumber: 4,
      isRequired: false,
      values: [
        { slug: 'centre', name: 'Centre', sortOrder: 0, isDefault: true },
        { slug: 'left', name: 'Left', sortOrder: 1 },
        { slug: 'right', name: 'Right', sortOrder: 2 },
        { slug: 'double', name: 'Double', sortOrder: 3 },
      ],
    },
    {
      slug: 'tap-holes',
      name: 'Tap Holes',
      displayType: OptionDisplayType.RADIO,
      sortOrder: 6,
      stepNumber: 4,
      values: [
        { slug: 'no-hole', name: 'No Tap Hole', sortOrder: 0 },
        { slug: '1-hole', name: '1 Tap Hole', sortOrder: 1, isDefault: true },
        { slug: '3-holes', name: '3 Tap Holes', sortOrder: 2 },
      ],
    },
    {
      slug: 'handle-colour',
      name: 'Handle Colour',
      displayType: OptionDisplayType.SWATCH,
      sortOrder: 7,
      stepNumber: 5,
      values: [
        { slug: 'chrome', name: 'Chrome', sortOrder: 0, isDefault: true, swatchColor: '#C0C0C0' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, swatchColor: '#1A1A1A' },
        { slug: 'brushed-nickel', name: 'Brushed Nickel', sortOrder: 2, swatchColor: '#B0A898' },
        { slug: 'brushed-gold', name: 'Brushed Gold', sortOrder: 3, swatchColor: '#CFB53B' },
      ],
    },
    {
      slug: 'plug-waste',
      name: 'Plug & Waste',
      displayType: OptionDisplayType.DROPDOWN,
      sortOrder: 8,
      stepNumber: 6,
      isRequired: false,
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
      where: {
        productFamilyId_slug: {
          productFamilyId: family.id,
          slug: groupFields.slug,
        },
      },
      update: {
        name: groupFields.name,
        displayType: groupFields.displayType,
        sortOrder: groupFields.sortOrder,
        stepNumber: groupFields.stepNumber,
        isRequired: groupFields.isRequired ?? true,
      },
      create: {
        productFamilyId: family.id,
        slug: groupFields.slug,
        name: groupFields.name,
        displayType: groupFields.displayType,
        sortOrder: groupFields.sortOrder,
        stepNumber: groupFields.stepNumber,
        isRequired: groupFields.isRequired ?? true,
      },
    });

    for (const valueData of values) {
      await prisma.optionValue.upsert({
        where: {
          optionGroupId_slug: {
            optionGroupId: group.id,
            slug: valueData.slug,
          },
        },
        update: {
          name: valueData.name,
          sortOrder: valueData.sortOrder,
          isDefault: valueData.isDefault ?? false,
          swatchColor: valueData.swatchColor ?? null,
          swatchImage: null,
          thumbnailUrl: null,
          description: null,
          metadata: Prisma.JsonNull,
        },
        create: {
          optionGroupId: group.id,
          slug: valueData.slug,
          name: valueData.name,
          sortOrder: valueData.sortOrder,
          isDefault: valueData.isDefault ?? false,
          swatchColor: valueData.swatchColor ?? null,
          swatchImage: null,
          thumbnailUrl: null,
          description: null,
          metadata: Prisma.JsonNull,
        },
      });
    }

    console.log(`  ✓ Option Group: ${group.name} (${values.length} values)`);
  }

  await prisma.optionDependencyRule.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.optionExclusionRule.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.priceRule.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.tradePriceRule.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.summaryRule.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.configurationToComponentMap.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.component.deleteMany({ where: { productFamilyId: family.id } });
  await prisma.ruleVersion.deleteMany({ where: { productFamilyId: family.id } });

  const dependencies: SeedDependency[] = [
    {
      name: '600mm → centre basin only',
      whenGroup: 'vanity-size',
      whenValue: '600mm',
      thenGroup: 'basin-position',
      thenValues: ['centre'],
    },
    {
      name: '1200mm → all positions',
      whenGroup: 'vanity-size',
      whenValue: '1200mm',
      thenGroup: 'basin-position',
      thenValues: ['centre', 'left', 'right', 'double'],
    },
    {
      name: '1500mm → all positions',
      whenGroup: 'vanity-size',
      whenValue: '1500mm',
      thenGroup: 'basin-position',
      thenValues: ['centre', 'left', 'right', 'double'],
    },
    {
      name: 'No top → no basin',
      whenGroup: 'stone-top',
      whenValue: 'no-top',
      thenGroup: 'basin-type',
      thenValues: ['no-basin'],
    },
    {
      name: 'No top → no tap holes',
      whenGroup: 'stone-top',
      whenValue: 'no-top',
      thenGroup: 'tap-holes',
      thenValues: ['no-hole'],
    },
  ];

  for (const dep of dependencies) {
    await prisma.optionDependencyRule.create({
      data: {
        productFamilyId: family.id,
        name: dep.name,
        whenOptionGroupSlug: dep.whenGroup,
        whenOptionValueSlug: dep.whenValue,
        thenOptionGroupSlug: dep.thenGroup,
        thenOptionValueSlugs: dep.thenValues,
      },
    });
  }
  console.log(`  ✓ Dependency rules: ${dependencies.length}`);

  const exclusions: SeedExclusion[] = [
    {
      name: 'Above counter oval → no 3 tap holes',
      whenGroup: 'basin-type',
      whenValue: 'above-counter-oval',
      excludeGroup: 'tap-holes',
      excludeValues: ['3-holes'],
    },
    {
      name: 'Above counter rect → no 3 tap holes',
      whenGroup: 'basin-type',
      whenValue: 'above-counter-rect',
      excludeGroup: 'tap-holes',
      excludeValues: ['3-holes'],
    },
  ];

  for (const exc of exclusions) {
    await prisma.optionExclusionRule.create({
      data: {
        productFamilyId: family.id,
        name: exc.name,
        whenOptionGroupSlug: exc.whenGroup,
        whenOptionValueSlug: exc.whenValue,
        excludeOptionGroupSlug: exc.excludeGroup,
        excludeOptionValueSlugs: exc.excludeValues,
      },
    });
  }
  console.log(`  ✓ Exclusion rules: ${exclusions.length}`);

  const priceRules: SeedPriceRule[] = [
    { optionGroupSlug: 'vanity-size', optionValueSlug: '750mm', priceModifier: 200 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm', priceModifier: 400 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '1200mm', priceModifier: 700 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '1500mm', priceModifier: 1000 },
    { optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz', priceModifier: 269 },
    { optionGroupSlug: 'stone-top', optionValueSlug: 'engineered-stone', priceModifier: 349 },
    { optionGroupSlug: 'stone-top', optionValueSlug: 'no-top', priceModifier: -200 },
    { optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval', priceModifier: 199 },
    { optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-rect', priceModifier: 229 },
    { optionGroupSlug: 'handle-colour', optionValueSlug: 'brushed-gold', priceModifier: 49 },
    { optionGroupSlug: 'plug-waste', optionValueSlug: 'chrome-popup', priceModifier: 59 },
    { optionGroupSlug: 'plug-waste', optionValueSlug: 'matte-black-popup', priceModifier: 89 },
    { optionGroupSlug: 'plug-waste', optionValueSlug: 'brushed-nickel-popup', priceModifier: 79 },
  ];

  for (const rule of priceRules) {
    await prisma.priceRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: rule.optionGroupSlug,
        optionValueSlug: rule.optionValueSlug,
        priceModifier: rule.priceModifier,
        modifierType: PriceModifierType.ADDITIVE,
      },
    });
  }
  console.log(`  ✓ Retail price rules: ${priceRules.length}`);

  const tradePriceRules: SeedPriceRule[] = [
    { optionGroupSlug: 'vanity-size', optionValueSlug: '750mm', priceModifier: 150 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm', priceModifier: 300 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '1200mm', priceModifier: 525 },
    { optionGroupSlug: 'vanity-size', optionValueSlug: '1500mm', priceModifier: 750 },
    { optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz', priceModifier: 200 },
    { optionGroupSlug: 'stone-top', optionValueSlug: 'engineered-stone', priceModifier: 260 },
    { optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval', priceModifier: 149 },
  ];

  for (const rule of tradePriceRules) {
    await prisma.tradePriceRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: rule.optionGroupSlug,
        optionValueSlug: rule.optionValueSlug,
        priceModifier: rule.priceModifier,
        modifierType: PriceModifierType.ADDITIVE,
        tradeCondition: {
          type: 'customer_tag',
          value: 'trade',
        } as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`  ✓ Trade price rules: ${tradePriceRules.length}`);

  const summaryRules: SeedSummaryRule[] = [
    { optionGroupSlug: 'vanity-size', template: 'Size: {{value}}', sortOrder: 1 },
    { optionGroupSlug: 'cabinet-finish', template: 'Finish: {{value}}', sortOrder: 2 },
    { optionGroupSlug: 'stone-top', template: 'Top: {{value}}', sortOrder: 3 },
    { optionGroupSlug: 'basin-type', template: 'Basin: {{value}}', sortOrder: 4 },
    { optionGroupSlug: 'basin-position', template: 'Position: {{value}}', sortOrder: 5 },
    { optionGroupSlug: 'tap-holes', template: 'Tap Holes: {{value}}', sortOrder: 6 },
    { optionGroupSlug: 'handle-colour', template: 'Handle: {{value}}', sortOrder: 7 },
    { optionGroupSlug: 'plug-waste', template: 'Plug & Waste: {{value}}', sortOrder: 8 },
  ];

  for (const rule of summaryRules) {
    await prisma.summaryRule.create({
      data: {
        productFamilyId: family.id,
        optionGroupSlug: rule.optionGroupSlug,
        template: rule.template,
        sortOrder: rule.sortOrder,
      },
    });
  }
  console.log(`  ✓ Summary rules: ${summaryRules.length}`);

  const components: SeedComponent[] = [
    { sku: 'ZV-CAB-MW-600', name: 'Matte White Cabinet 600mm', type: ComponentType.CABINET },
    { sku: 'ZV-CAB-MW-900', name: 'Matte White Cabinet 900mm', type: ComponentType.CABINET },
    { sku: 'ZV-CAB-WO-900', name: 'Woodland Oak Cabinet 900mm', type: ComponentType.CABINET },
    { sku: 'ZV-CAB-WO-1200', name: 'Woodland Oak Cabinet 1200mm', type: ComponentType.CABINET },
    { sku: 'ZV-TOP-SW-600', name: 'Stone White Top 600mm', type: ComponentType.STONE_TOP },
    { sku: 'ZV-TOP-SW-900', name: 'Stone White Top 900mm', type: ComponentType.STONE_TOP },
    { sku: 'ZV-TOP-CAL-900', name: 'Calacatta Quartz Top 900mm', type: ComponentType.STONE_TOP },
    { sku: 'ZV-TOP-CAL-1200', name: 'Calacatta Quartz Top 1200mm', type: ComponentType.STONE_TOP },
    { sku: 'ZV-BAS-UM', name: 'Undermount Basin', type: ComponentType.BASIN },
    { sku: 'ZV-BAS-ACO', name: 'Above Counter Oval Basin', type: ComponentType.BASIN },
    { sku: 'ZV-BAS-ACR', name: 'Above Counter Rectangle Basin', type: ComponentType.BASIN },
    { sku: 'ZV-HDL-CH', name: 'Chrome Handle', type: ComponentType.HANDLE },
    { sku: 'ZV-HDL-MB', name: 'Matte Black Handle', type: ComponentType.HANDLE },
    { sku: 'ZV-HDL-BN', name: 'Brushed Nickel Handle', type: ComponentType.HANDLE },
    { sku: 'ZV-HDL-BG', name: 'Brushed Gold Handle', type: ComponentType.HANDLE },
    { sku: 'ZV-PW-CH-POP', name: 'Chrome Pop-Up Waste', type: ComponentType.PLUG_WASTE },
    { sku: 'ZV-PW-MB-POP', name: 'Matte Black Pop-Up Waste', type: ComponentType.PLUG_WASTE },
    { sku: 'ZV-PW-BN-POP', name: 'Brushed Nickel Pop-Up Waste', type: ComponentType.PLUG_WASTE },
  ];

  const componentRecords: Record<string, string> = {};
  for (const comp of components) {
    const record = await prisma.component.create({
      data: {
        productFamilyId: family.id,
        sku: comp.sku,
        name: comp.name,
        type: comp.type,
      },
    });
    componentRecords[comp.sku] = record.id;
  }
  console.log(`  ✓ Components: ${components.length}`);

  const componentMaps: SeedComponentMap[] = [
    {
      conditions: [
        { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' },
        { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' },
      ],
      sku: 'ZV-CAB-WO-900',
      qty: 1,
    },
    {
      conditions: [
        { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' },
        { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'matte-white' },
      ],
      sku: 'ZV-CAB-MW-900',
      qty: 1,
    },
    {
      conditions: [
        { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' },
        { optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz' },
      ],
      sku: 'ZV-TOP-CAL-900',
      qty: 1,
    },
    {
      conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval' }],
      sku: 'ZV-BAS-ACO',
      qty: 1,
    },
    {
      conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'undermount' }],
      sku: 'ZV-BAS-UM',
      qty: 1,
    },
    {
      conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'matte-black' }],
      sku: 'ZV-HDL-MB',
      qty: 2,
    },
    {
      conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'chrome' }],
      sku: 'ZV-HDL-CH',
      qty: 2,
    },
    {
      conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'brushed-gold' }],
      sku: 'ZV-HDL-BG',
      qty: 2,
    },
    {
      conditions: [{ optionGroupSlug: 'plug-waste', optionValueSlug: 'matte-black-popup' }],
      sku: 'ZV-PW-MB-POP',
      qty: 1,
    },
    {
      conditions: [{ optionGroupSlug: 'plug-waste', optionValueSlug: 'chrome-popup' }],
      sku: 'ZV-PW-CH-POP',
      qty: 1,
    },
  ];

  for (const map of componentMaps) {
    const compId = componentRecords[map.sku];
    if (!compId) continue;

    await prisma.configurationToComponentMap.create({
      data: {
        productFamilyId: family.id,
        conditions: map.conditions as Prisma.InputJsonValue,
        componentId: compId,
        quantity: map.qty,
      },
    });
  }
  console.log(`  ✓ Component maps: ${componentMaps.length}`);

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
      } as Prisma.InputJsonValue,
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