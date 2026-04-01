/**
 * Configurator State Manager
 *
 * Pure reducer + action creators for managing configurator state.
 * No React dependency — can be used with useReducer, Zustand, or anything.
 *
 * State flow:
 *   1. INIT        — load option groups, set defaults
 *   2. SELECT      — user picks a value → optimistic update → trigger evaluation
 *   3. EVALUATE    — API returns allowed/disabled → apply to state
 *   4. AUTO_CLEAR  — if a selected value is now disabled, clear it
 *   5. RE-EVALUATE — cleared selection changes the input → evaluate again
 */

import type {
  OptionGroup,
  Selections,
  DisabledValue,
  FiredRule,
  EvaluateResponse,
  PricingResponse,
  ConfiguratorState,
} from './types';

// ──────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────

export type ConfiguratorAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; productFamilyId: string; optionGroups: OptionGroup[] }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'SELECT'; groupSlug: string; valueSlug: string }
  | { type: 'CLEAR_SELECTION'; groupSlug: string }
  | { type: 'EVALUATE_START' }
  | { type: 'EVALUATE_SUCCESS'; result: EvaluateResponse; autoClearedGroups: string[] }
  | { type: 'EVALUATE_ERROR'; error: string }
  | { type: 'PRICING_START' }
  | { type: 'PRICING_SUCCESS'; pricing: PricingResponse }
  | { type: 'PRICING_ERROR'; error: string }
  | { type: 'RESET' };

// ──────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────

export const initialState: ConfiguratorState = {
  productFamilyId: '',
  optionGroups: [],
  selections: {},
  allowed: {},
  disabled: {},
  firedRules: [],
  autoClearedGroups: [],
  pricing: null,
  isLoading: false,
  isEvaluating: false,
  isPricing: false,
  error: null,
};

// ──────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────

export function configuratorReducer(
  state: ConfiguratorState,
  action: ConfiguratorAction
): ConfiguratorState {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, isLoading: true, error: null };

    case 'INIT_SUCCESS': {
      const defaults = buildDefaults(action.optionGroups);
      // Build initial allowed map (everything allowed before first evaluation)
      const allowed: Record<string, string[]> = {};
      for (const group of action.optionGroups) {
        allowed[group.slug] = group.values.map((v) => v.slug);
      }

      return {
        ...state,
        productFamilyId: action.productFamilyId,
        optionGroups: action.optionGroups,
        selections: defaults,
        allowed,
        disabled: {},
        firedRules: [],
        autoClearedGroups: [],
        isLoading: false,
        error: null,
      };
    }

    case 'INIT_ERROR':
      return { ...state, isLoading: false, error: action.error };

    case 'SELECT':
      return {
        ...state,
        selections: { ...state.selections, [action.groupSlug]: action.valueSlug },
        autoClearedGroups: [], // clear previous auto-clear notices
      };

    case 'CLEAR_SELECTION': {
      const next = { ...state.selections };
      delete next[action.groupSlug];
      return { ...state, selections: next };
    }

    case 'EVALUATE_START':
      return { ...state, isEvaluating: true };

    case 'EVALUATE_SUCCESS':
      return {
        ...state,
        allowed: action.result.allowed,
        disabled: action.result.disabled,
        firedRules: action.result.firedRules,
        autoClearedGroups: action.autoClearedGroups,
        isEvaluating: false,
        error: null,
      };

    case 'EVALUATE_ERROR':
      return { ...state, isEvaluating: false, error: action.error };

    case 'PRICING_START':
      return { ...state, isPricing: true };

    case 'PRICING_SUCCESS':
      return { ...state, pricing: action.pricing, isPricing: false };

    case 'PRICING_ERROR':
      return { ...state, isPricing: false, error: action.error };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Build default selections from option groups.
 * Uses the first isDefault=true value, or the first value if none is default.
 */
export function buildDefaults(groups: OptionGroup[]): Selections {
  const defaults: Selections = {};
  for (const group of groups) {
    const defaultValue = group.values.find((v) => v.isDefault);
    if (defaultValue) {
      defaults[group.slug] = defaultValue.slug;
    } else if (group.values.length > 0) {
      defaults[group.slug] = group.values[0]!.slug;
    }
  }
  return defaults;
}

/**
 * Given the current selections and the evaluation result,
 * determine which selections need to be auto-cleared because
 * they are no longer in the allowed set.
 *
 * Returns the list of group slugs that were cleared, plus the
 * cleaned selections object.
 */
export function reconcileSelections(
  selections: Selections,
  allowed: Record<string, string[]>,
  optionGroups: OptionGroup[]
): { cleanedSelections: Selections; clearedGroups: string[] } {
  const cleaned = { ...selections };
  const clearedGroups: string[] = [];

  for (const [groupSlug, selectedValue] of Object.entries(cleaned)) {
    const groupAllowed = allowed[groupSlug];
    if (!groupAllowed) continue; // group not in evaluation (no rules affect it)

    if (!groupAllowed.includes(selectedValue)) {
      // Current selection is invalid — try to replace with a valid default
      const group = optionGroups.find((g) => g.slug === groupSlug);
      const fallback = findFallbackValue(group, groupAllowed);

      if (fallback) {
        cleaned[groupSlug] = fallback;
      } else {
        delete cleaned[groupSlug];
      }
      clearedGroups.push(groupSlug);
    }
  }

  return { cleanedSelections: cleaned, clearedGroups };
}

/**
 * Find the best fallback value for a group when the current selection is invalid.
 * Priority: isDefault value (if still allowed) → first allowed value → null
 */
function findFallbackValue(
  group: OptionGroup | undefined,
  allowedSlugs: string[]
): string | null {
  if (!group || allowedSlugs.length === 0) return null;

  // Try the default value first
  const defaultValue = group.values.find((v) => v.isDefault);
  if (defaultValue && allowedSlugs.includes(defaultValue.slug)) {
    return defaultValue.slug;
  }

  // Fall back to the first allowed value in sort order
  for (const value of group.values) {
    if (allowedSlugs.includes(value.slug)) {
      return value.slug;
    }
  }

  return null;
}

/**
 * Check if a specific value is currently disabled.
 */
export function isValueDisabled(
  state: ConfiguratorState,
  groupSlug: string,
  valueSlug: string
): boolean {
  const groupDisabled = state.disabled[groupSlug];
  if (!groupDisabled) return false;
  return groupDisabled.some((d) => d.slug === valueSlug);
}

/**
 * Get the disabled reason for a specific value, or null if not disabled.
 */
export function getDisabledReason(
  state: ConfiguratorState,
  groupSlug: string,
  valueSlug: string
): string | null {
  const groupDisabled = state.disabled[groupSlug];
  if (!groupDisabled) return null;
  const entry = groupDisabled.find((d) => d.slug === valueSlug);
  return entry?.reason ?? null;
}

/**
 * Get all allowed values for a group.
 */
export function getAllowedValues(
  state: ConfiguratorState,
  groupSlug: string
): string[] {
  return state.allowed[groupSlug] ?? [];
}
