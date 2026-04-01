import type {
  ProductFamilyDefinition,
  CustomerContext,
  PricingResult,
  PriceModifierResult,
  PriceRuleDefinition,
  TradePriceRuleDefinition,
  RuleCondition,
  AvailableOption,
} from './types';

/**
 * Calculate the total price for a configuration.
 * Applies retail or trade price rules based on customer context.
 */
export function calculatePricing(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  customerContext: CustomerContext,
  availableOptions: Record<string, AvailableOption[]>
): PricingResult {
  const isTradeCustomer = resolveTradeEligibility(family, customerContext);

  // Choose which rule set to apply
  const rules: PriceRuleDefinition[] = isTradeCustomer
    ? family.tradePriceRules.length > 0
      ? family.tradePriceRules
      : family.priceRules // fall back to retail if no trade rules
    : family.priceRules;

  const modifiers: PriceModifierResult[] = [];
  let totalPrice = family.basePrice;

  for (const [groupSlug, valueSlug] of Object.entries(selections)) {
    if (!valueSlug) continue;

    // Find matching price rules for this selection
    const matchingRules = rules.filter(
      (r) =>
        r.optionGroupSlug === groupSlug &&
        r.optionValueSlug === valueSlug &&
        conditionsMatch(r.conditions, selections)
    );

    for (const rule of matchingRules) {
      const delta = applyModifier(family.basePrice, totalPrice, rule);

      if (delta !== 0) {
        const groupName = getGroupName(family, groupSlug);
        const valueName = getValueName(family, groupSlug, valueSlug);

        modifiers.push({
          optionGroupSlug: groupSlug,
          optionValueSlug: valueSlug,
          optionGroupName: groupName,
          optionValueName: valueName,
          delta,
          type: rule.modifierType,
        });

        if (rule.modifierType === 'OVERRIDE' || rule.modifierType === 'ABSOLUTE') {
          totalPrice = rule.priceModifier;
        } else {
          totalPrice += delta;
        }
      }
    }
  }

  // Also calculate compare-at price (retail price when showing trade)
  let compareAtPrice: number | undefined;
  if (isTradeCustomer && family.tradePriceRules.length > 0) {
    const retailResult = calculateRetailPrice(family, selections);
    if (retailResult > totalPrice) {
      compareAtPrice = retailResult;
    }
  }

  // Enrich available options with price deltas for UI preview
  enrichWithPriceDeltas(family, selections, rules, availableOptions);

  return {
    basePrice: family.basePrice,
    modifiers,
    totalPrice: Math.max(0, roundPrice(totalPrice)),
    compareAtPrice: compareAtPrice ? roundPrice(compareAtPrice) : undefined,
    isTradePrice: isTradeCustomer,
  };
}

/**
 * Determine if this customer qualifies for trade pricing.
 */
function resolveTradeEligibility(
  family: ProductFamilyDefinition,
  ctx: CustomerContext
): boolean {
  if (!ctx.isTradeCustomer) return false;

  // Check if there are any trade rules that match
  for (const rule of family.tradePriceRules) {
    const tradeRule = rule as TradePriceRuleDefinition;
    if (tradeRule.tradeCondition.type === 'customer_tag') {
      if (ctx.tags?.includes(tradeRule.tradeCondition.value)) {
        return true;
      }
    }
    if (tradeRule.tradeCondition.type === 'company_location') {
      if (ctx.companyId === tradeRule.tradeCondition.value) {
        return true;
      }
    }
  }

  // If the customer is flagged as trade but no specific rules match,
  // still treat as trade if the flag is set
  return ctx.isTradeCustomer;
}

/**
 * Calculate retail-only price (used for compare-at pricing).
 */
function calculateRetailPrice(
  family: ProductFamilyDefinition,
  selections: Record<string, string>
): number {
  let total = family.basePrice;

  for (const [groupSlug, valueSlug] of Object.entries(selections)) {
    if (!valueSlug) continue;

    const matchingRules = family.priceRules.filter(
      (r) =>
        r.optionGroupSlug === groupSlug &&
        r.optionValueSlug === valueSlug &&
        conditionsMatch(r.conditions, selections)
    );

    for (const rule of matchingRules) {
      const delta = applyModifier(family.basePrice, total, rule);
      if (rule.modifierType === 'OVERRIDE' || rule.modifierType === 'ABSOLUTE') {
        total = rule.priceModifier;
      } else {
        total += delta;
      }
    }
  }

  return Math.max(0, total);
}

/**
 * Apply a single price modifier and return the delta amount.
 */
function applyModifier(
  basePrice: number,
  _currentTotal: number,
  rule: PriceRuleDefinition
): number {
  switch (rule.modifierType) {
    case 'ADDITIVE':
      return rule.priceModifier;
    case 'PERCENTAGE':
      return basePrice * (rule.priceModifier / 100);
    case 'ABSOLUTE':
    case 'OVERRIDE':
      return rule.priceModifier; // handled differently in caller
    default:
      return 0;
  }
}

/**
 * Check if a rule's additional conditions match the current selections.
 */
function conditionsMatch(
  conditions: RuleCondition[] | undefined,
  selections: Record<string, string>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(
    (c) => selections[c.optionGroupSlug] === c.optionValueSlug
  );
}

/**
 * Enrich available options with price delta previews.
 * Shows "+$269" next to an option before it's selected.
 */
function enrichWithPriceDeltas(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  rules: PriceRuleDefinition[],
  availableOptions: Record<string, AvailableOption[]>
): void {
  for (const [groupSlug, options] of Object.entries(availableOptions)) {
    for (const option of options) {
      // Find matching price rule for this option value
      const rule = rules.find(
        (r) =>
          r.optionGroupSlug === groupSlug &&
          r.optionValueSlug === option.slug
      );

      if (rule) {
        option.priceDelta = rule.modifierType === 'ADDITIVE'
          ? rule.priceModifier
          : undefined; // only show simple additive deltas in preview
      }
    }
  }
}

function getGroupName(family: ProductFamilyDefinition, slug: string): string {
  return family.optionGroups.find((g) => g.slug === slug)?.name ?? slug;
}

function getValueName(family: ProductFamilyDefinition, groupSlug: string, valueSlug: string): string {
  const group = family.optionGroups.find((g) => g.slug === groupSlug);
  return group?.values.find((v) => v.slug === valueSlug)?.name ?? valueSlug;
}

function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}
