/**
 * Pricing Engine
 *
 * Pure functions — no database reads or writes.
 * Accepts base price, price rules, and selections as input.
 * Returns a full pricing breakdown.
 *
 * Modifier types:
 *   ADDITIVE   — adds/subtracts a fixed amount (e.g. +269.00)
 *   PERCENTAGE — adds/subtracts a percentage of the base price (e.g. +10%)
 *   ABSOLUTE   — sets the total to this exact value
 *   OVERRIDE   — replaces the base price entirely
 *
 * Conditional rules:
 *   A price rule can have a `conditions` array.
 *   ALL conditions must match for the rule to apply.
 *   e.g. "Calacatta Quartz costs +$269, but only when size is 900mm"
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PriceRule {
  id: string;
  name: string | null;
  optionGroupSlug: string;
  optionValueSlug: string;
  priceModifier: number; // Decimal from Prisma, converted to number by the API
  modifierType: 'ADDITIVE' | 'PERCENTAGE' | 'ABSOLUTE' | 'OVERRIDE';
  conditions: PriceCondition[] | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PriceCondition {
  optionGroupSlug: string;
  optionValueSlug: string;
}

export type Selections = Record<string, string>;

/** A single line in the pricing breakdown */
export interface PriceLineItem {
  ruleId: string;
  ruleName: string | null;
  optionGroupSlug: string;
  optionValueSlug: string;
  modifierType: string;
  modifier: number;    // the raw modifier value (e.g. 269 or 10)
  amount: number;      // the computed amount applied (e.g. 269.00 or 129.90 for 10% of 1299)
  description: string; // human-readable: "+$269.00 (Calacatta Quartz)"
}

/** The full pricing result */
export interface PricingResult {
  basePrice: number;
  lineItems: PriceLineItem[];
  subtotal: number;  // sum of all line item amounts
  total: number;     // basePrice + subtotal (or overridden value)
  currency: string;
}

// ──────────────────────────────────────────────
// Engine
// ──────────────────────────────────────────────

export function calculatePricing(
  basePrice: number,
  selections: Selections,
  priceRules: PriceRule[],
  currency: string = 'AUD'
): PricingResult {
  const lineItems: PriceLineItem[] = [];
  let total = basePrice;
  let overridden = false;

  // Sort by sortOrder to ensure deterministic application
  const sortedRules = [...priceRules].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const rule of sortedRules) {
    if (!rule.isActive) continue;

    // Check if this rule's trigger matches: the selected value for this group
    if (selections[rule.optionGroupSlug] !== rule.optionValueSlug) continue;

    // Check additional conditions (all must match)
    if (!conditionsMatch(rule.conditions, selections)) continue;

    // Calculate the amount
    const { amount, description } = computeModifier(rule, basePrice);

    lineItems.push({
      ruleId: rule.id,
      ruleName: rule.name,
      optionGroupSlug: rule.optionGroupSlug,
      optionValueSlug: rule.optionValueSlug,
      modifierType: rule.modifierType,
      modifier: rule.priceModifier,
      amount,
      description,
    });

    // Apply to total
    switch (rule.modifierType) {
      case 'ADDITIVE':
        total += amount;
        break;
      case 'PERCENTAGE':
        total += amount;
        break;
      case 'ABSOLUTE':
        total = rule.priceModifier;
        overridden = true;
        break;
      case 'OVERRIDE':
        total = rule.priceModifier;
        overridden = true;
        break;
    }
  }

  // Ensure total is never negative
  total = Math.max(0, round(total));

  const subtotal = round(lineItems.reduce((sum, li) => sum + li.amount, 0));

  return {
    basePrice: round(basePrice),
    lineItems,
    subtotal,
    total,
    currency,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function conditionsMatch(
  conditions: PriceCondition[] | null,
  selections: Selections
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(
    (c) => selections[c.optionGroupSlug] === c.optionValueSlug
  );
}

function computeModifier(
  rule: PriceRule,
  basePrice: number
): { amount: number; description: string } {
  switch (rule.modifierType) {
    case 'ADDITIVE': {
      const amount = round(rule.priceModifier);
      const sign = amount >= 0 ? '+' : '';
      return {
        amount,
        description: `${sign}$${Math.abs(amount).toFixed(2)} (${rule.optionValueSlug})`,
      };
    }
    case 'PERCENTAGE': {
      const amount = round(basePrice * (rule.priceModifier / 100));
      const sign = rule.priceModifier >= 0 ? '+' : '';
      return {
        amount,
        description: `${sign}${rule.priceModifier}% (${rule.optionValueSlug})`,
      };
    }
    case 'ABSOLUTE':
      return {
        amount: round(rule.priceModifier),
        description: `Set to $${round(rule.priceModifier).toFixed(2)} (${rule.optionValueSlug})`,
      };
    case 'OVERRIDE':
      return {
        amount: round(rule.priceModifier),
        description: `Override to $${round(rule.priceModifier).toFixed(2)} (${rule.optionValueSlug})`,
      };
    default:
      return { amount: 0, description: '' };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
