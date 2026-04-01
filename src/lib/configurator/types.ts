/**
 * Configurator Types
 *
 * These match the API response shapes from:
 *   GET /api/options?familyId=xxx
 *   POST /api/rules/evaluate
 */

export interface OptionGroup {
  id: string;
  slug: string;
  name: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText: string | null;
  stepNumber: number | null;
  values: OptionValue[];
}

export interface OptionValue {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor: string | null;
  swatchImage: string | null;
  thumbnailUrl: string | null;
  description: string | null;
}

/** Current selections: { "vanity-size": "900mm", "basin-type": "single-basin" } */
export type Selections = Record<string, string>;

/** Disabled value with reason */
export interface DisabledValue {
  slug: string;
  reason: string;
}

/** Rule that fired during evaluation */
export interface FiredRule {
  id: string;
  type: 'dependency' | 'exclusion';
  name: string | null;
  trigger: string;
  effect: string;
}

/** Response from POST /api/rules/evaluate */
export interface EvaluateResponse {
  allowed: Record<string, string[]>;
  disabled: Record<string, DisabledValue[]>;
  firedRules: FiredRule[];
  groups: Record<string, Array<{
    slug: string;
    isAllowed: boolean;
    disabledReason: string | null;
    appliedRules: string[];
  }>>;
}

/** A single line in the pricing breakdown */
export interface PriceLineItem {
  ruleId: string;
  ruleName: string | null;
  optionGroupSlug: string;
  optionValueSlug: string;
  modifierType: string;
  modifier: number;
  amount: number;
  description: string;
}

/** Response from POST /api/pricing/calculate */
export interface PricingResponse {
  basePrice: number;
  lineItems: PriceLineItem[];
  subtotal: number;
  total: number;
  currency: string;
}

/** The full state exposed by the configurator */
export interface ConfiguratorState {
  /** Product family ID being configured */
  productFamilyId: string;
  /** All option groups with their values */
  optionGroups: OptionGroup[];
  /** Current selections per group slug */
  selections: Selections;
  /** Allowed value slugs per group (from rule evaluation) */
  allowed: Record<string, string[]>;
  /** Disabled values with reasons per group */
  disabled: Record<string, DisabledValue[]>;
  /** Rules that fired in the last evaluation */
  firedRules: FiredRule[];
  /** Values that were auto-cleared because they became invalid */
  autoClearedGroups: string[];
  /** Pricing breakdown */
  pricing: PricingResponse | null;
  /** Loading states */
  isLoading: boolean;
  isEvaluating: boolean;
  isPricing: boolean;
  /** Error from the last operation */
  error: string | null;
}
