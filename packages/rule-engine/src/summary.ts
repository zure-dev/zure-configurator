import type {
  ProductFamilyDefinition,
  SummaryResult,
  SummaryLine,
  PricingResult,
} from './types';

/**
 * Generate human-readable and structured summaries for a configuration.
 * Used for line item properties and order detail display.
 */
export function generateSummary(
  family: ProductFamilyDefinition,
  selections: Record<string, string>,
  pricing: PricingResult
): SummaryResult {
  const structured: SummaryLine[] = [];

  // Sort summary rules by sortOrder
  const sortedRules = [...family.summaryRules].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  for (const rule of sortedRules) {
    const selectedSlug = selections[rule.optionGroupSlug];
    if (!selectedSlug) continue;

    const group = family.optionGroups.find((g) => g.slug === rule.optionGroupSlug);
    if (!group) continue;

    const value = group.values.find((v) => v.slug === selectedSlug);
    if (!value) continue;

    // Find price delta for this selection
    const modifier = pricing.modifiers.find(
      (m) => m.optionGroupSlug === rule.optionGroupSlug && m.optionValueSlug === selectedSlug
    );

    const priceDelta = modifier && modifier.delta !== 0
      ? formatPriceDelta(modifier.delta)
      : null;

    // Apply template
    const text = applyTemplate(rule.template, {
      value: value.name,
      slug: value.slug,
      priceDelta: priceDelta ?? '',
      groupName: group.name,
    });

    structured.push({
      label: group.name,
      value: value.name,
      priceDelta,
    });
  }

  // If no summary rules exist, auto-generate from all selections
  if (structured.length === 0) {
    for (const group of family.optionGroups) {
      const selectedSlug = selections[group.slug];
      if (!selectedSlug) continue;

      const value = group.values.find((v) => v.slug === selectedSlug);
      if (!value) continue;

      const modifier = pricing.modifiers.find(
        (m) => m.optionGroupSlug === group.slug && m.optionValueSlug === selectedSlug
      );

      structured.push({
        label: group.name,
        value: value.name,
        priceDelta: modifier && modifier.delta !== 0
          ? formatPriceDelta(modifier.delta)
          : null,
      });
    }
  }

  // Build human-readable string
  const humanReadable = structured
    .map((line) => {
      if (line.priceDelta) {
        return `${line.label}: ${line.value} (${line.priceDelta})`;
      }
      return `${line.label}: ${line.value}`;
    })
    .join(' | ');

  return {
    humanReadable,
    structured,
  };
}

/**
 * Generate the line item properties object for Shopify Cart API.
 * Properties prefixed with _ are hidden from the customer.
 */
export function generateLineItemProperties(
  summary: SummaryResult,
  snapshotId: string
): Record<string, string> {
  const properties: Record<string, string> = {
    '_configuration_id': snapshotId,
  };

  for (const line of summary.structured) {
    const displayValue = line.priceDelta
      ? `${line.value} (${line.priceDelta})`
      : line.value;
    properties[line.label] = displayValue;
  }

  return properties;
}

/**
 * Apply a mustache-style template with simple variable replacement.
 */
function applyTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
}

/**
 * Format a price delta for display.
 */
function formatPriceDelta(delta: number): string {
  if (delta > 0) return `+$${delta.toFixed(2)}`;
  if (delta < 0) return `-$${Math.abs(delta).toFixed(2)}`;
  return '';
}
