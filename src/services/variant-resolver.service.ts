/**
 * Variant Resolver
 *
 * Resolves Shopify variant IDs for cart lines using multiple data sources.
 * Checks in priority order:
 *
 *   1. OptionValue.metadata.shopifyVariantId  — direct per-value mapping
 *   2. ConfigurationToComponentMap → Component.shopifyVariantId — conditional component mapping
 *   3. LineBuilderConfig.defaultAddOnVariantId — global fallback
 *
 * This is a read-only service — no writes, no side effects.
 */

import { db } from '@/lib/db';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface VariantMapping {
  variantId: string | null;
  productId: string | null;
  sku: string | null;
  source: 'value_metadata' | 'component_map' | 'family_link' | 'fallback' | 'none';
  componentName: string | null;
}

export interface ResolveMainVariantInput {
  productFamilyId: string;
}

export interface ResolveAddOnVariantInput {
  productFamilyId: string;
  groupSlug: string;
  valueSlug: string;
  /** The full selections map — needed for conditional component mapping */
  allSelections: Record<string, string>;
  /** Value metadata (already loaded from OptionValue) */
  valueMetadata: Record<string, unknown> | null;
  /** Global fallback variant ID */
  defaultVariantId?: string | null;
}

// ──────────────────────────────────────────────
// Main product variant
// ──────────────────────────────────────────────

/**
 * Resolve the Shopify variant ID for the main configurable product.
 * This comes from ProductFamilyShopifyLink.
 */
export async function resolveMainVariant(
  input: ResolveMainVariantInput
): Promise<VariantMapping> {
  const link = await db.productFamilyShopifyLink.findUnique({
    where: { productFamilyId: input.productFamilyId },
  });

  if (!link) {
    return { variantId: null, productId: null, sku: null, source: 'none', componentName: null };
  }

  return {
    variantId: link.shopifyVariantNumericId ?? link.shopifyVariantId ?? null,
    productId: link.shopifyProductNumericId ?? link.shopifyProductId,
    sku: null,
    source: 'family_link',
    componentName: null,
  };
}

// ──────────────────────────────────────────────
// Add-on variant
// ──────────────────────────────────────────────

/**
 * Resolve the Shopify variant ID for an add-on cart line.
 * Tries multiple sources in priority order.
 */
export async function resolveAddOnVariant(
  input: ResolveAddOnVariantInput
): Promise<VariantMapping> {
  // ── 1. Check OptionValue.metadata ──
  if (input.valueMetadata) {
    const vid = input.valueMetadata.shopifyVariantId as string | undefined;
    if (vid) {
      return {
        variantId: vid,
        productId: (input.valueMetadata.shopifyProductId as string) ?? null,
        sku: (input.valueMetadata.sku as string) ?? null,
        source: 'value_metadata',
        componentName: null,
      };
    }
  }

  // ── 2. Check ConfigurationToComponentMap → Component ──
  const componentMapping = await findComponentVariant(
    input.productFamilyId,
    input.groupSlug,
    input.valueSlug,
    input.allSelections
  );
  if (componentMapping) return componentMapping;

  // ── 3. Fallback ──
  if (input.defaultVariantId) {
    return {
      variantId: input.defaultVariantId,
      productId: null,
      sku: null,
      source: 'fallback',
      componentName: null,
    };
  }

  return { variantId: null, productId: null, sku: null, source: 'none', componentName: null };
}

// ──────────────────────────────────────────────
// Component map lookup
// ──────────────────────────────────────────────

interface ComponentCondition {
  optionGroupSlug: string;
  optionValueSlug: string;
}

/**
 * Find a Component with a Shopify variant via ConfigurationToComponentMap.
 * The map uses conditions (array of {groupSlug, valueSlug}) — all must match.
 * We find maps where the current group+value is one of the conditions,
 * and ALL other conditions also match the current selections.
 */
async function findComponentVariant(
  productFamilyId: string,
  groupSlug: string,
  valueSlug: string,
  allSelections: Record<string, string>
): Promise<VariantMapping | null> {
  // Load all component maps for this family
  const maps = await db.configurationToComponentMap.findMany({
    where: { productFamilyId },
  });

  for (const map of maps) {
    const conditions = map.conditions as ComponentCondition[] | null;
    if (!conditions || conditions.length === 0) continue;

    // Check if this map's conditions include our target group+value
    const includesTarget = conditions.some(
      (c) => c.optionGroupSlug === groupSlug && c.optionValueSlug === valueSlug
    );
    if (!includesTarget) continue;

    // Check if ALL conditions match current selections
    const allMatch = conditions.every(
      (c) => allSelections[c.optionGroupSlug] === c.optionValueSlug
    );
    if (!allMatch) continue;

    // Found a match — load the component
    const component = await db.component.findUnique({
      where: { id: map.componentId },
    });

    if (component?.shopifyVariantId) {
      return {
        variantId: component.shopifyVariantId,
        productId: component.shopifyProductId ?? null,
        sku: component.sku,
        source: 'component_map',
        componentName: component.name,
      };
    }
  }

  return null;
}
