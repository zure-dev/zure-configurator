import type {
  ConfigurationInput,
  ConfigurationResult,
} from './types';
import { buildInitialAvailableOptions, validateSelections } from './validator';
import { applyExclusionRules, applyDependencyRules } from './rules';
import { calculatePricing } from './pricing';
import { resolveMedia } from './media';
import { generateSummary } from './summary';
import { mapComponents } from './components';
import { generateValidationSignature } from './version';

/**
 * Main configuration evaluator.
 *
 * This is the single entry point for the rule engine.
 * Given a product family definition, current selections, and customer context,
 * it evaluates the full pipeline and returns a complete result.
 *
 * The pipeline is deterministic: same inputs + same rules = same output, always.
 *
 * Pipeline steps:
 *   1. BUILD    — Initialize all options as available
 *   2. EXCLUDE  — Apply exclusion rules (disable specific values)
 *   3. DEPEND   — Apply dependency rules (restrict to allowed values)
 *   4. VALIDATE — Check required groups and value validity
 *   5. PRICE    — Calculate retail or trade pricing
 *   6. MEDIA    — Resolve media via priority cascade
 *   7. SUMMARY  — Generate human-readable + structured summary
 *   8. COMPONENTS — Map configuration to internal component SKUs
 *   9. SIGN     — Generate validation signature
 */
export function evaluateConfiguration(
  input: ConfigurationInput
): ConfigurationResult {
  const { productFamily, selections, customerContext } = input;

  // Step 1: Build initial available options (all enabled)
  const availableOptions = buildInitialAvailableOptions(productFamily);

  // Step 2: Apply exclusion rules
  applyExclusionRules(productFamily, selections, availableOptions);

  // Step 3: Apply dependency rules
  applyDependencyRules(productFamily, selections, availableOptions);

  // Step 4: Validate current selections against available options
  const errors = validateSelections(productFamily, selections, availableOptions);

  // Step 5: Calculate pricing (also enriches availableOptions with price deltas)
  const pricing = calculatePricing(
    productFamily,
    selections,
    customerContext,
    availableOptions
  );

  // Step 6: Resolve media
  const media = resolveMedia(productFamily, selections);

  // Step 7: Generate summary
  const summary = generateSummary(productFamily, selections, pricing);

  // Step 8: Map to components
  const components = mapComponents(productFamily, selections);

  // Build result
  const result: ConfigurationResult = {
    isValid: errors.length === 0,
    errors,
    availableOptions,
    pricing,
    media,
    summary,
    components,
  };

  return result;
}

/**
 * Quick validation-only evaluation.
 * Used when you only need to know if a configuration is valid
 * without computing pricing, media, summary, etc.
 */
export function validateConfigurationOnly(
  input: ConfigurationInput
): { isValid: boolean; errors: ConfigurationResult['errors'] } {
  const { productFamily, selections } = input;

  const availableOptions = buildInitialAvailableOptions(productFamily);
  applyExclusionRules(productFamily, selections, availableOptions);
  applyDependencyRules(productFamily, selections, availableOptions);
  const errors = validateSelections(productFamily, selections, availableOptions);

  return { isValid: errors.length === 0, errors };
}

/**
 * Generate a validation signature for a completed configuration.
 * Call this when creating a snapshot after Add to Cart.
 */
export function signConfiguration(
  input: ConfigurationInput,
  result: ConfigurationResult
): string {
  return generateValidationSignature(input, result);
}

/**
 * Compute default selections for a product family.
 * Uses the first isDefault=true value, or the first value in each required group.
 */
export function computeDefaultSelections(
  input: Pick<ConfigurationInput, 'productFamily'>
): Record<string, string> {
  const defaults: Record<string, string> = {};

  for (const group of input.productFamily.optionGroups) {
    const defaultValue = group.values.find((v) => v.isDefault);
    if (defaultValue) {
      defaults[group.slug] = defaultValue.slug;
    } else if (group.isRequired && group.values.length > 0) {
      defaults[group.slug] = group.values[0]!.slug;
    }
  }

  return defaults;
}
