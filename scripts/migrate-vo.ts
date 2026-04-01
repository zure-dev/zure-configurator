/**
 * Migration Script: VO Variant Options → Zure Configurator
 *
 * This script reads a VO export file (JSON) and creates the corresponding
 * product family, option groups, values, and rules in the Zure Configurator database.
 *
 * Usage:
 *   npx tsx scripts/migrate-vo.ts --input ./vo-export.json --store store_zure --family "Zure Vanity"
 *
 * The VO export format is expected to be:
 * {
 *   "product": { "title": "...", "handle": "...", "id": "..." },
 *   "options": [
 *     {
 *       "name": "Vanity Size",
 *       "type": "buttons",
 *       "values": [
 *         { "label": "600mm", "price_modifier": 0 },
 *         { "label": "900mm", "price_modifier": 400 }
 *       ],
 *       "conditions": [...]
 *     }
 *   ]
 * }
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

interface VOExport {
  product: { title: string; handle: string; id: string };
  options: VOOption[];
}

interface VOOption {
  name: string;
  type: string;
  required?: boolean;
  values: VOValue[];
  conditions?: VOCondition[];
}

interface VOValue {
  label: string;
  price_modifier?: number;
  image_url?: string;
  swatch_color?: string;
  default?: boolean;
}

interface VOCondition {
  type: 'show' | 'hide';
  when_option: string;
  when_value: string;
  target_values?: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mapDisplayType(voType: string): string {
  const map: Record<string, string> = {
    buttons: 'TILE',
    swatches: 'SWATCH',
    dropdown: 'DROPDOWN',
    images: 'THUMBNAIL',
    radio: 'RADIO',
  };
  return map[voType] ?? 'TILE';
}

async function migrate() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const storeIndex = args.indexOf('--store');
  const familyIndex = args.indexOf('--family');

  if (inputIndex === -1 || storeIndex === -1) {
    console.error('Usage: npx tsx scripts/migrate-vo.ts --input <file> --store <store_id> [--family "Name"]');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1]!;
  const storeId = args[storeIndex + 1]!;
  const familyName = familyIndex !== -1 ? args[familyIndex + 1]! : undefined;

  console.log(`📦 Reading VO export from: ${inputFile}`);
  const voData: VOExport = JSON.parse(readFileSync(inputFile, 'utf-8'));

  console.log(`🏪 Store: ${storeId}`);
  console.log(`📋 Product: ${voData.product.title}`);
  console.log(`🔧 Options: ${voData.options.length}`);

  // Verify store exists
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  console.log(`✓ Store verified: ${store.shopifyDomain}`);

  const name = familyName ?? voData.product.title;
  const slug = slugify(name);

  // Create product family
  const family = await prisma.productFamily.create({
    data: {
      storeId,
      name,
      slug: `${slug}-migrated`,
      description: `Migrated from VO Variant Options on ${new Date().toISOString()}`,
      status: 'DRAFT',
      basePrice: 0, // Will need manual adjustment
    },
  });
  console.log(`✓ Product family created: ${family.name} (${family.id})`);

  // Track option group slugs for condition mapping
  const groupSlugMap = new Map<string, string>(); // VO name → slug

  // Create option groups + values
  for (let i = 0; i < voData.options.length; i++) {
    const voOption = voData.options[i]!;
    const groupSlug = slugify(voOption.name);
    groupSlugMap.set(voOption.name, groupSlug);

    const group = await prisma.optionGroup.create({
      data: {
        productFamilyId: family.id,
        name: voOption.name,
        slug: groupSlug,
        displayType: mapDisplayType(voOption.type) as any,
        sortOrder: i,
        stepNumber: i + 1,
        isRequired: voOption.required ?? true,
      },
    });

    for (let j = 0; j < voOption.values.length; j++) {
      const voValue = voOption.values[j]!;
      const valueSlug = slugify(voValue.label);

      await prisma.optionValue.create({
        data: {
          optionGroupId: group.id,
          name: voValue.label,
          slug: valueSlug,
          sortOrder: j,
          isDefault: voValue.default ?? (j === 0),
          swatchColor: voValue.swatch_color,
          thumbnailUrl: voValue.image_url,
        },
      });

      // Create price rule if modifier exists
      if (voValue.price_modifier && voValue.price_modifier !== 0) {
        await prisma.priceRule.create({
          data: {
            productFamilyId: family.id,
            optionGroupSlug: groupSlug,
            optionValueSlug: valueSlug,
            priceModifier: voValue.price_modifier,
            modifierType: 'ADDITIVE',
          },
        });
      }
    }

    console.log(`  ✓ Option: ${voOption.name} (${voOption.values.length} values, ${mapDisplayType(voOption.type)})`);
  }

  // Convert VO conditions to dependency/exclusion rules
  let depCount = 0;
  let excCount = 0;

  for (const voOption of voData.options) {
    if (!voOption.conditions) continue;

    for (const condition of voOption.conditions) {
      const whenGroupSlug = groupSlugMap.get(condition.when_option);
      const targetGroupSlug = groupSlugMap.get(voOption.name);

      if (!whenGroupSlug || !targetGroupSlug) {
        console.warn(`  ⚠ Skipping condition: cannot resolve "${condition.when_option}" → "${voOption.name}"`);
        continue;
      }

      const whenValueSlug = slugify(condition.when_value);
      const targetValueSlugs = condition.target_values?.map(slugify) ?? [];

      if (condition.type === 'show' && targetValueSlugs.length > 0) {
        await prisma.optionDependencyRule.create({
          data: {
            productFamilyId: family.id,
            name: `VO migration: ${condition.when_option}=${condition.when_value} → show ${voOption.name}`,
            whenOptionGroupSlug: whenGroupSlug,
            whenOptionValueSlug: whenValueSlug,
            thenOptionGroupSlug: targetGroupSlug,
            thenOptionValueSlugs: targetValueSlugs,
          },
        });
        depCount++;
      } else if (condition.type === 'hide' && targetValueSlugs.length > 0) {
        await prisma.optionExclusionRule.create({
          data: {
            productFamilyId: family.id,
            name: `VO migration: ${condition.when_option}=${condition.when_value} → hide ${voOption.name}`,
            whenOptionGroupSlug: whenGroupSlug,
            whenOptionValueSlug: whenValueSlug,
            excludeOptionGroupSlug: targetGroupSlug,
            excludeOptionValueSlugs: targetValueSlugs,
          },
        });
        excCount++;
      }
    }
  }

  console.log(`  ✓ Dependency rules: ${depCount}`);
  console.log(`  ✓ Exclusion rules: ${excCount}`);

  // Summary
  console.log('\n✅ Migration complete!');
  console.log(`   Family ID: ${family.id}`);
  console.log(`   Status: DRAFT (review before activating)`);
  console.log('\n⚠️  Manual steps required:');
  console.log('   1. Set the correct base price');
  console.log('   2. Review and adjust imported rules');
  console.log('   3. Add media rules (not exported from VO)');
  console.log('   4. Add summary rules');
  console.log('   5. Add component mappings');
  console.log('   6. Link to Shopify product');
  console.log('   7. Test thoroughly before activating');
}

migrate()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
