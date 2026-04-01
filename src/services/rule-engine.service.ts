/**
 * Rule Evaluation Engine
 *
 * Pure functions. No database reads or writes.
 * Accepts rules + selections as input and returns computed state.
 *
 * Evaluation order:
 * 1. Start with all values available for all groups
 * 2. Apply dependency rules (whitelist): if a trigger matches,
 *    only the listed values are allowed in the target group.
 *    Multiple matching rules for the same target group are UNIONed.
 * 3. Apply exclusion rules (blacklist): if a trigger matches,
 *    the listed values are disabled in the target group.
 * 4. Exclusions can override dependencies. If a value is allowed
 *    by a dependency rule but excluded by an exclusion rule,
 *    it ends up disabled.
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** A dependency rule as stored in the database */
export interface DependencyRule {
  id: string;
  name?: string | null;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  thenOptionGroupSlug: string;
  thenOptionValueSlugs: string[];
  isActive: boolean;
  sortOrder: number;
}

/** An exclusion rule as stored in the database */
export interface ExclusionRule {
  id: string;
  name?: string | null;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  excludeOptionGroupSlug: string;
  excludeOptionValueSlugs: string[];
  isActive: boolean;
  sortOrder: number;
}

/** All values that exist in each option group */
export interface OptionGroupValues {
  groupSlug: string;
  groupName: string;
  valueSlugs: string[];
}

/** The customer's current selections: { "vanity-size": "900mm", "basin-type": "single-basin" } */
export type Selections = Record<string, string>;

/** Per-value evaluation result */
export interface ValueState {
  slug: string;
  isAllowed: boolean;
  disabledReason: string | null;
  /** Which rule(s) affected this value */
  appliedRules: string[];
}

/** Disabled value shorthand */
export interface DisabledValue {
  slug: string;
  reason: string;
}

/** Rule that fired during evaluation */
export interface FiredRule {
  id: string;
  type: 'dependency' | 'exclusion';
  name: string | null;
  trigger: string; // "vanity-size = 900mm"
  effect: string; // "basin-type -> only [single-basin]" or "basin-type -> exclude [double-basin]"
}

/** The full evaluation result */
export interface EvaluationResult {
  /** Per-group map of every value and its computed state */
  groups: Record<string, ValueState[]>;
  /** Shorthand: only the allowed value slugs per group */
  allowed: Record<string, string[]>;
  /** Shorthand: only the disabled value slugs per group with reasons */
  disabled: Record<string, DisabledValue[]>;
  /** Rules that fired during this evaluation */
  firedRules: FiredRule[];
}

// ──────────────────────────────────────────────
// Engine
// ──────────────────────────────────────────────

export function evaluateRules(
  selections: Selections,
  dependencyRules: DependencyRule[],
  exclusionRules: ExclusionRule[],
  allGroups: OptionGroupValues[]
): EvaluationResult {
  // Build initial state: all values allowed
  const groupState: Record<string, ValueState[]> = {};

  for (const group of allGroups) {
    groupState[group.groupSlug] = group.valueSlugs.map((slug) => ({
      slug,
      isAllowed: true,
      disabledReason: null,
      appliedRules: [],
    }));
  }

  const firedRules: FiredRule[] = [];

  // Step 1: Dependency rules (whitelist)
  // Grouped by target group because multiple matching rules UNION their allowed sets
  const depByTarget = new Map<
    string,
    { allowedSlugs: Set<string>; rules: DependencyRule[] }
  >();

  for (const rule of dependencyRules) {
    if (!rule.isActive) continue;
    if (!triggerMatches(rule, selections)) continue;

    const existing = depByTarget.get(rule.thenOptionGroupSlug);

    if (existing) {
      for (const slug of rule.thenOptionValueSlugs) {
        existing.allowedSlugs.add(slug);
      }
      existing.rules.push(rule);
    } else {
      depByTarget.set(rule.thenOptionGroupSlug, {
        allowedSlugs: new Set(rule.thenOptionValueSlugs),
        rules: [rule],
      });
    }

    firedRules.push({
      id: rule.id,
      type: 'dependency',
      name: rule.name ?? null,
      trigger: `${rule.whenOptionGroupSlug} = ${rule.whenOptionValueSlug}`,
      effect: `${rule.thenOptionGroupSlug} -> only [${rule.thenOptionValueSlugs.join(', ')}]`,
    });
  }

  // Apply dependency restrictions
  for (const [targetGroupSlug, { allowedSlugs, rules }] of depByTarget) {
    const values = groupState[targetGroupSlug];
    if (!values) continue;

    for (const valueState of values) {
      if (!allowedSlugs.has(valueState.slug)) {
        valueState.isAllowed = false;
        valueState.disabledReason = 'Not compatible with current selections';
        valueState.appliedRules.push(...rules.map((r) => r.id));
      }
    }
  }

  // Step 2: Exclusion rules (blacklist)
  // Applied after dependencies and can disable values that dependencies allowed
  for (const rule of exclusionRules) {
    if (!rule.isActive) continue;
    if (!triggerMatches(rule, selections)) continue;

    const values = groupState[rule.excludeOptionGroupSlug];
    if (!values) continue;

    for (const valueState of values) {
      if (rule.excludeOptionValueSlugs.includes(valueState.slug)) {
        valueState.isAllowed = false;
        valueState.disabledReason = `Not available when ${rule.whenOptionGroupSlug} is ${rule.whenOptionValueSlug}`;
        valueState.appliedRules.push(rule.id);
      }
    }

    firedRules.push({
      id: rule.id,
      type: 'exclusion',
      name: rule.name ?? null,
      trigger: `${rule.whenOptionGroupSlug} = ${rule.whenOptionValueSlug}`,
      effect: `${rule.excludeOptionGroupSlug} -> exclude [${rule.excludeOptionValueSlugs.join(', ')}]`,
    });
  }

  // Build output
  const allowed: Record<string, string[]> = {};
  const disabled: Record<string, DisabledValue[]> = {};

  for (const [groupSlug, values] of Object.entries(groupState)) {
    const groupAllowed: string[] = [];
    const groupDisabled: DisabledValue[] = [];

    for (const value of values) {
      if (value.isAllowed) {
        groupAllowed.push(value.slug);
      } else {
        groupDisabled.push({
          slug: value.slug,
          reason: value.disabledReason ?? 'Disabled by rule',
        });
      }
    }

    allowed[groupSlug] = groupAllowed;

    if (groupDisabled.length > 0) {
      disabled[groupSlug] = groupDisabled;
    }
  }

  return {
    groups: groupState,
    allowed,
    disabled,
    firedRules,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function triggerMatches(
  rule: { whenOptionGroupSlug: string; whenOptionValueSlug: string },
  selections: Selections
): boolean {
  return selections[rule.whenOptionGroupSlug] === rule.whenOptionValueSlug;
}