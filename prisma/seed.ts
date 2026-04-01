import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shopifyDomain = 'zure-dev-2.myshopify.com';

  const store = await prisma.store.findFirst({
    where: { shopifyDomain },
    select: { id: true, shopifyDomain: true },
  });

  if (!store) {
    throw new Error(`Store not found for domain: ${shopifyDomain}`);
  }

  console.log(`Seeding for store: ${store.id} (${store.shopifyDomain})`);

  const productFamily = await prisma.productFamily.upsert({
    where: {
      storeId_handle: {
        storeId: store.id,
        handle: 'waverton',
      },
    },
    update: {
      name: 'Waverton',
      slug: 'waverton',
      category: 'vanities',
      description: 'Waverton vanity',
      status: 'DRAFT',
      basePrice: '0',
    },
    create: {
      storeId: store.id,
      name: 'Waverton',
      handle: 'waverton',
      slug: 'waverton',
      category: 'vanities',
      description: 'Waverton vanity',
      status: 'DRAFT',
      basePrice: '0',
      defaultMediaSet: [],
    },
  });

  console.log(`Product family ready: ${productFamily.id}`);

  const groups = [
    {
      name: 'Stone Type',
      slug: 'stone-type',
      displayType: 'TILE',
      sortOrder: 0,
      isRequired: true,
      values: [
        { name: 'Carrara', slug: 'carrara', sortOrder: 0, isDefault: true },
        { name: 'Calacatta', slug: 'calacatta', sortOrder: 1, isDefault: false },
        { name: 'Ceramic', slug: 'ceramic', sortOrder: 2, isDefault: false },
      ],
    },
    {
      name: 'Vanity Size',
      slug: 'vanity-size',
      displayType: 'TILE',
      sortOrder: 1,
      isRequired: true,
      values: [
        { name: '900mm', slug: '900mm', sortOrder: 0, isDefault: false },
        { name: '1200mm', slug: '1200mm', sortOrder: 1, isDefault: true },
        { name: '1500mm', slug: '1500mm', sortOrder: 2, isDefault: false },
      ],
    },
    {
      name: 'Basin Type',
      slug: 'basin-type',
      displayType: 'TILE',
      sortOrder: 2,
      isRequired: true,
      values: [
        { name: 'Single Basin', slug: 'single-basin', sortOrder: 0, isDefault: true },
        { name: 'Double Basin', slug: 'double-basin', sortOrder: 1, isDefault: false },
      ],
    },
    {
      name: 'Handle Colour',
      slug: 'handle-colour',
      displayType: 'TILE',
      sortOrder: 3,
      isRequired: true,
      values: [
        {
          name: 'Matte Black',
          slug: 'matte-black',
          sortOrder: 0,
          isDefault: true,
          swatchColor: '#1f1f1f',
        },
        {
          name: 'Brushed Brass',
          slug: 'brushed-brass',
          sortOrder: 1,
          isDefault: false,
          swatchColor: '#c6a25a',
        },
        {
          name: 'Chrome',
          slug: 'chrome',
          sortOrder: 2,
          isDefault: false,
          swatchColor: '#c0c0c0',
        },
      ],
    },
    {
      name: 'Cabinet Finish',
      slug: 'cabinet-finish',
      displayType: 'TILE',
      sortOrder: 4,
      isRequired: true,
      values: [
        {
          name: 'Prime Oak',
          slug: 'prime-oak',
          sortOrder: 0,
          isDefault: true,
          swatchColor: '#b58b61',
        },
        {
          name: 'Walnut',
          slug: 'walnut',
          sortOrder: 1,
          isDefault: false,
          swatchColor: '#6f4e37',
        },
        {
          name: 'Matte White',
          slug: 'matte-white',
          sortOrder: 2,
          isDefault: false,
          swatchColor: '#f5f5f5',
        },
      ],
    },
  ] as const;

  for (const groupInput of groups) {
    const group = await prisma.optionGroup.upsert({
      where: {
        productFamilyId_slug: {
          productFamilyId: productFamily.id,
          slug: groupInput.slug,
        },
      },
      update: {
        name: groupInput.name,
        displayType: groupInput.displayType,
        sortOrder: groupInput.sortOrder,
        isRequired: groupInput.isRequired,
        helperText: null,
        stepNumber: null,
      },
      create: {
        productFamilyId: productFamily.id,
        name: groupInput.name,
        slug: groupInput.slug,
        displayType: groupInput.displayType,
        sortOrder: groupInput.sortOrder,
        isRequired: groupInput.isRequired,
        helperText: null,
        stepNumber: null,
      },
    });

    console.log(`Option group ready: ${group.name} (${group.id})`);

    for (const valueInput of groupInput.values) {
      const value = await prisma.optionValue.upsert({
        where: {
          optionGroupId_slug: {
            optionGroupId: group.id,
            slug: valueInput.slug,
          },
        },
        update: {
          name: valueInput.name,
          sortOrder: valueInput.sortOrder,
          isDefault: valueInput.isDefault,
          swatchColor: 'swatchColor' in valueInput ? valueInput.swatchColor ?? null : null,
          swatchImage: null,
          thumbnailUrl: null,
          description: null,
          metadata: null,
        },
        create: {
          optionGroupId: group.id,
          name: valueInput.name,
          slug: valueInput.slug,
          sortOrder: valueInput.sortOrder,
          isDefault: valueInput.isDefault,
          swatchColor: 'swatchColor' in valueInput ? valueInput.swatchColor ?? null : null,
          swatchImage: null,
          thumbnailUrl: null,
          description: null,
          metadata: null,
        },
      });

      console.log(`  Value ready: ${value.name} (${value.id})`);
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
