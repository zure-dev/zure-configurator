import type {
  ProductFamilyDefinition,
  MediaResult,
  MediaItem,
  RuleCondition,
} from './types';

/**
 * Resolve the media set for a configuration using priority-based cascade.
 *
 * Priority levels (higher number wins):
 *   0  = product family default media
 *  10  = finish/colour override
 *  20  = basin/top category override
 *  30  = exact configuration override
 *
 * Multiple rules at the same priority: last match wins.
 * A higher-priority rule completely replaces the media set from lower priorities.
 */
export function resolveMedia(
  family: ProductFamilyDefinition,
  selections: Record<string, string>
): MediaResult {
  // Start with family default
  let resolvedMedia: MediaItem[] = family.defaultMediaSet ?? [];
  const appliedRules: string[] = [];
  let highestPriority = -1;

  // Sort rules by priority ascending (so higher priority processes last and wins)
  const sortedRules = [...family.mediaRules].sort(
    (a, b) => a.priority - b.priority
  );

  for (const rule of sortedRules) {
    if (!allConditionsMatch(rule.conditions, selections)) continue;

    // If this rule is at a higher or equal priority, it overrides
    if (rule.priority >= highestPriority) {
      resolvedMedia = rule.mediaSet;
      highestPriority = rule.priority;
      appliedRules.push(rule.id);
    }
  }

  // Separate hero and gallery images
  const heroImage = resolvedMedia.find((m) => m.type === 'hero') ?? resolvedMedia[0] ?? null;
  const gallery = resolvedMedia
    .filter((m) => m.type === 'gallery' || m.type === 'hero')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    heroImage,
    gallery,
    appliedRules,
  };
}

/**
 * Check if ALL conditions in a rule match the current selections.
 */
function allConditionsMatch(
  conditions: RuleCondition[],
  selections: Record<string, string>
): boolean {
  if (!conditions || conditions.length === 0) return false; // media rules must have conditions
  return conditions.every(
    (c) => selections[c.optionGroupSlug] === c.optionValueSlug
  );
}
