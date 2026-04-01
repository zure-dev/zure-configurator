import type {
  ProductFamilyDefinition,
  ComponentResult,
  ComponentMapping,
  RuleCondition,
} from './types';

/**
 * Map a configuration to its internal component SKUs.
 * Each component map has conditions — all conditions must match
 * the current selections for the component to be included.
 */
export function mapComponents(
  family: ProductFamilyDefinition,
  selections: Record<string, string>
): ComponentResult {
  const mappings: ComponentMapping[] = [];

  for (const map of family.componentMaps) {
    if (!allConditionsMatch(map.conditions, selections)) continue;

    mappings.push({
      componentId: map.componentId,
      sku: map.componentSku,
      name: map.componentName,
      type: map.componentType,
      quantity: map.quantity,
    });
  }

  // Sort by type for consistent ordering
  const typeOrder: Record<string, number> = {
    CABINET: 1,
    STONE_TOP: 2,
    BASIN: 3,
    HANDLE: 4,
    TAP: 5,
    PLUG_WASTE: 6,
    ACCESSORY: 7,
    OTHER: 99,
  };

  mappings.sort((a, b) => {
    const orderA = typeOrder[a.type] ?? 99;
    const orderB = typeOrder[b.type] ?? 99;
    return orderA - orderB;
  });

  return { mappings };
}

function allConditionsMatch(
  conditions: RuleCondition[],
  selections: Record<string, string>
): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(
    (c) => selections[c.optionGroupSlug] === c.optionValueSlug
  );
}
