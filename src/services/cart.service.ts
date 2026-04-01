import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { evaluateRules } from '@/services/rule-engine.service';
import { calculatePricing } from '@/services/pricing-engine.service';
import type { OptionGroupValues } from '@/services/rule-engine.service';
import type { PriceRule, PricingResult } from '@/services/pricing-engine.service';
import { createHash } from 'crypto';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PrepareCartInput {
  productFamilyId: string;
  selections: Record<string, string>;
}

/** A single line in the human-readable summary */
export interface SummaryLine {
  label: string;       // "Vanity Size"
  value: string;       // "900mm"
  priceDelta: string | null; // "+$400.00" or null
}

/** The full cart-ready payload returned to the frontend */
export interface CartResolution {
  success: boolean;
  errors: string[];

  /** Persisted snapshot ID — the permanent record of this configuration */
  snapshotId: string | null;

  /** What to send to Shopify's Cart API */
  shopify: {
    variantId: string | null;
    quantity: number;
    /** Line item properties visible in checkout and order admin */
    properties: Record<string, string>;
  } | null;

  /** Pricing breakdown */
  pricing: PricingResult | null;

  /** Human-readable summary lines */
  summary: SummaryLine[];

  /** The frozen selections at time of add-to-cart */
  selections: Record<string, { slug: string; name: string }>;
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

export async function prepareCart(
  storeId: string,
  input: PrepareCartInput
): Promise<CartResolution> {
  const errors: string[] = [];

  // ── 1. Load product family ──
  const family = await db.productFamily.findFirst({
    where: { id: input.productFamilyId, storeId },
    include: {
      store: { select: { currency: true } },
      shopifyLink: true,
    },
  });

  if (!family) {
    return emptyResult(['Product family not found']);
  }

  // ── 2. Load option groups + values ──
  const optionGroups = await db.optionGroup.findMany({
    where: { productFamilyId: input.productFamilyId },
    include: { values: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });

  // ── 3. Validate all required groups have selections ──
  for (const group of optionGroups) {
    if (group.isRequired && !input.selections[group.slug]) {
      errors.push(`"${group.name}" is required`);
    }
  }

  // Validate all selection values actually exist
  for (const [groupSlug, valueSlug] of Object.entries(input.selections)) {
    const group = optionGroups.find((g) => g.slug === groupSlug);
    if (!group) {
      errors.push(`Unknown option group: ${groupSlug}`);
      continue;
    }
    const value = group.values.find((v) => v.slug === valueSlug);
    if (!value) {
      errors.push(`Unknown value "${valueSlug}" in group "${group.name}"`);
    }
  }

  if (errors.length > 0) {
    return emptyResult(errors);
  }

  // ── 4. Run rule evaluation — check for invalid combinations ──
  const [dependencyRules, exclusionRules] = await Promise.all([
    db.optionDependencyRule.findMany({
      where: { productFamilyId: input.productFamilyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.optionExclusionRule.findMany({
      where: { productFamilyId: input.productFamilyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const allGroups: OptionGroupValues[] = optionGroups.map((g) => ({
    groupSlug: g.slug,
    groupName: g.name,
    valueSlugs: g.values.map((v) => v.slug),
  }));

  const ruleResult = evaluateRules(
    input.selections,
    dependencyRules,
    exclusionRules,
    allGroups
  );

  // Check if any selected value is disabled by rules
  for (const [groupSlug, disabledValues] of Object.entries(ruleResult.disabled)) {
    const selectedValue = input.selections[groupSlug];
    if (!selectedValue) continue;
    const isDisabled = disabledValues.some((d) => d.slug === selectedValue);
    if (isDisabled) {
      const group = optionGroups.find((g) => g.slug === groupSlug);
      errors.push(`"${selectedValue}" in "${group?.name ?? groupSlug}" is not allowed with current selections`);
    }
  }

  if (errors.length > 0) {
    return emptyResult(errors);
  }

  // ── 5. Calculate pricing ──
  const dbPriceRules = await db.priceRule.findMany({
    where: { productFamilyId: input.productFamilyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const priceRules: PriceRule[] = dbPriceRules.map((r) => ({
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

  const pricing = calculatePricing(
    Number(family.basePrice),
    input.selections,
    priceRules,
    family.store.currency
  );

  // ── 6. Build human-readable selections + summary ──
  const selectionsWithNames: Record<string, { slug: string; name: string }> = {};
  const summary: SummaryLine[] = [];

  for (const group of optionGroups) {
    const selectedSlug = input.selections[group.slug];
    if (!selectedSlug) continue;

    const value = group.values.find((v) => v.slug === selectedSlug);
    if (!value) continue;

    selectionsWithNames[group.slug] = {
      slug: value.slug,
      name: value.name,
    };

    // Find price delta for this selection
    const lineItem = pricing.lineItems.find(
      (li) => li.optionGroupSlug === group.slug && li.optionValueSlug === selectedSlug
    );

    summary.push({
      label: group.name,
      value: value.name,
      priceDelta: lineItem && lineItem.amount !== 0
        ? `${lineItem.amount >= 0 ? '+' : ''}$${Math.abs(lineItem.amount).toFixed(2)}`
        : null,
    });
  }

  // ── 7. Build Shopify line item properties ──
  const properties: Record<string, string> = {};

  // Hidden property: links back to our snapshot
  properties['_configuration_id'] = ''; // will be set after snapshot creation

  // Visible properties: one per option group
  for (const line of summary) {
    const display = line.priceDelta
      ? `${line.value} (${line.priceDelta})`
      : line.value;
    properties[line.label] = display;
  }

  // ── 8. Generate validation signature ──
  const signaturePayload = JSON.stringify({
    familyId: family.id,
    selections: input.selections,
    total: pricing.total,
    timestamp: Date.now(),
  });
  const validationSignature = createHash('sha256').update(signaturePayload).digest('hex');

  // ── 9. Persist snapshot ──
  // Create a session first (required by schema)
  const session = await db.configurationSession.create({
    data: {
      storeId,
      productFamilyId: input.productFamilyId,
      shopifyProductId: family.shopifyProductId,
      selections: input.selections,
      resolvedPrice: pricing.total,
      status: 'RESOLVED',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const snapshot = await db.configurationSnapshot.create({
    data: {
      sessionId: session.id,
      productFamilyId: input.productFamilyId,
      ruleVersionId: 'live',
      selections: selectionsWithNames,
      pricingBreakdown: pricing,
      mediaState: {},
      componentMappings: [],
      summaryText: summary.map((l) =>
        l.priceDelta ? `${l.label}: ${l.value} (${l.priceDelta})` : `${l.label}: ${l.value}`
      ).join(' | '),
      summaryStructured: summary,
      validationSignature: `sha256:${validationSignature}`,
    },
  });

  // Update the _configuration_id property now that we have the snapshot ID
  properties['_configuration_id'] = snapshot.id;

  // ── 10. Persist cart resolution record ──
  const variantId = family.shopifyLink?.shopifyVariantNumericId
    ?? family.shopifyLink?.shopifyVariantId
    ?? null;

  await db.cartResolutionRecord.create({
    data: {
      snapshotId: snapshot.id,
      shopifyVariantId: variantId ?? 'pending',
      lineItemProperties: properties,
      resolvedPrice: pricing.total,
    },
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'ConfigurationSnapshot',
    entityId: snapshot.id,
    after: { snapshotId: snapshot.id, total: pricing.total },
  });

  // ── 11. Return cart-ready payload ──
  return {
    success: true,
    errors: [],
    snapshotId: snapshot.id,
    shopify: {
      variantId,
      quantity: 1,
      properties,
    },
    pricing,
    summary,
    selections: selectionsWithNames,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function emptyResult(errors: string[]): CartResolution {
  return {
    success: false,
    errors,
    snapshotId: null,
    shopify: null,
    pricing: null,
    summary: [],
    selections: {},
  };
}
