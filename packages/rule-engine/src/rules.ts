import type {
  ProductFamilyDefinition,
  AvailableOption,
  DependencyRuleDefinition,
  ExclusionRuleDefinition,
} from './types';

/**
 * Apply exclusion rules to the available options map.
 * When a selection matches an exclusion rule's "when" condition,
 * the specified values in the target group are disabled.
 */
export function applyExclusionRules(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  availableOptions: Record<string, AvailableOption[]>
): void {
  for (const rule of family.exclusionRules) {
    if (!doesRuleTriggerMatch(rule, selections)) continue;

    const targetGroup = availableOptions[rule.excludeOptionGroupSlug];
    if (!targetGroup) continue;

    for (const option of targetGroup) {
      if (rule.excludeOptionValueSlugs.includes(option.slug)) {
        option.isAvailable = false;
        option.isDisabledReason =
          `Not available when ${getSelectionLabel(family, rule.whenOptionGroupSlug)} is "${getValueLabel(family, rule.whenOptionGroupSlug, rule.whenOptionValueSlug)}"`;
      }
    }
  }
}

/**
 * Apply dependency rules to the available options map.
 * When a selection matches a dependency rule's "when" condition,
 * ONLY the specified values in the target group remain available.
 * All other values in that group are disabled.
 *
 * Multiple dependency rules for the same target group are UNION'd —
 * a value is available if ANY matching dependency rule includes it.
 */
export function applyDependencyRules(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  availableOptions: Record<string, AvailableOption[]>
): void {
  // Collect all active dependency rules grouped by target option group
  const rulesByTargetGroup = new Map<string, DependencyRuleDefinition[]>();

  for (const rule of family.dependencyRules) {
    if (!doesRuleTriggerMatch(rule, selections)) continue;

    const existing = rulesByTargetGroup.get(rule.thenOptionGroupSlug) ?? [];
    existing.push(rule);
    rulesByTargetGroup.set(rule.thenOptionGroupSlug, existing);
  }

  // For each target group with active dependency rules,
  // only allow values that appear in at least one matching rule
  for (const [targetGroupSlug, rules] of rulesByTargetGroup) {
    const targetGroup = availableOptions[targetGroupSlug];
    if (!targetGroup) continue;

    // Union of all allowed values from matching rules
    const allowedSlugs = new Set<string>();
    for (const rule of rules) {
      for (const slug of rule.thenOptionValueSlugs) {
        allowedSlugs.add(slug);
      }
    }

    // Disable any value NOT in the allowed set
    for (const option of targetGroup) {
      if (!allowedSlugs.has(option.slug)) {
        option.isAvailable = false;
        option.isDisabledReason =
          `Not compatible with current selections`;
      }
    }
  }
}

/**
 * Check if a rule's "when" condition matches the current selections.
 */
function doesRuleTriggerMatch(
  rule: { whenOptionGroupSlug: string; whenOptionValueSlug: string },
  selections: Record<string, string>
): boolean {
  return selections[rule.whenOptionGroupSlug] === rule.whenOptionValueSlug;
}

/**
 * Get a human-readable label for an option group.
 */
function getSelectionLabel(
  family: ProductFamilyDefinition,
  groupSlug: string
): string {
  const group = family.optionGroups.find((g) => g.slug === groupSlug);
  return group?.name ?? groupSlug;
}

/**
 * Get a human-readable label for an option value.
 */
function getValueLabel(
  family: ProductFamilyDefinition,
  groupSlug: string,
  valueSlug: string
): string {
  const group = family.optionGroups.find((g) => g.slug === groupSlug);
  if (!group) return valueSlug;
  const value = group.values.find((v) => v.slug === valueSlug);
  return value?.name ?? valueSlug;
}
