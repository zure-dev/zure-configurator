import type {
  ProductFamilyDefinition,
  ValidationError,
  AvailableOption,
} from './types';

/**
 * Validate that all required option groups have a selection,
 * and that all selected values actually exist in their groups.
 */
export function validateSelections(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  availableOptions: Record<string, AvailableOption[]>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const group of family.optionGroups) {
    const selectedValue = selections[group.slug];

    // Check required groups have a selection
    if (group.isRequired && !selectedValue) {
      errors.push({
        type: 'MISSING_REQUIRED',
        optionGroupSlug: group.slug,
        message: `"${group.name}" is required`,
      });
      continue;
    }

    // If nothing selected and not required, skip further checks
    if (!selectedValue) continue;

    // Check that the selected value exists in the group
    const valueExists = group.values.some((v) => v.slug === selectedValue);
    if (!valueExists) {
      errors.push({
        type: 'INVALID_VALUE',
        optionGroupSlug: group.slug,
        optionValueSlug: selectedValue,
        message: `"${selectedValue}" is not a valid option for "${group.name}"`,
      });
      continue;
    }

    // Check that the selected value is currently available (not excluded/restricted)
    const available = availableOptions[group.slug];
    if (available) {
      const option = available.find((o) => o.slug === selectedValue);
      if (option && !option.isAvailable) {
        errors.push({
          type: 'EXCLUDED_VALUE',
          optionGroupSlug: group.slug,
          optionValueSlug: selectedValue,
          message: option.isDisabledReason
            ?? `"${option.name}" is not available with current selections`,
        });
      }
    }
  }

  return errors;
}

/**
 * Build the initial available options map (all values available).
 * This is the starting point before exclusion/dependency rules are applied.
 */
export function buildInitialAvailableOptions(
  family: ProductFamilyDefinition
): Record<string, AvailableOption[]> {
  const result: Record<string, AvailableOption[]> = {};

  for (const group of family.optionGroups) {
    result[group.slug] = group.values.map((v) => ({
      slug: v.slug,
      name: v.name,
      isAvailable: true,
      swatchColor: v.swatchColor,
      swatchImage: v.swatchImage,
      thumbnailUrl: v.thumbnailUrl,
      description: v.description,
    }));
  }

  return result;
}
