/**
 * Cart Line Builder
 *
 * Pure function — no DB reads or writes.
 *
 * Takes a resolved configuration and splits it into:
 *   - mainLine: the core configurable product (required option groups)
 *   - addOnLines: separate cart lines for optional add-ons
 *
 * Each line includes a resolved Shopify variant ID when available.
 */

import type { VariantMapping } from './variant-resolver.service';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ResolvedSelection {
  groupSlug: string;
  groupName: string;
  isRequired: boolean;
  selectedValueSlug: string;
  selectedValueName: string;
  priceDelta: number | null;
  priceDeltaFormatted: string | null;
  groupMetadata?: Record<string, unknown> | null;
  valueMetadata?: Record<string, unknown> | null;
  /** Resolved Shopify variant for this selection (populated by the API route) */
  variantMapping?: VariantMapping | null;
}

export interface LineBuilderConfig {
  addOnGroupSlugs?: string[];
  skipValuePrefixes?: string[];
  defaultAddOnVariantId?: string | null;
}

/** A single Shopify cart line */
export interface CartLine {
  lineType: 'main' | 'addon';
  variantId: string | null;
  quantity: number;
  properties: Record<string, string>;
  price: number;
  title: string;
  includedGroups: string[];
  /** How the variant ID was resolved */
  variantSource: string;
  /** For add-ons: the group slug this add-on belongs to */
  groupSlug: string | null;
  /** For add-ons: the selected value slug */
  selectedValueSlug: string | null;
  /** SKU from component mapping (if resolved) */
  sku: string | null;
}

export interface CartLines {
  mainLine: CartLine;
  addOnLines: CartLine[];
  total: number;
  snapshotId: string;
}

// ──────────────────────────────────────────────
// Default config
// ──────────────────────────────────────────────

const DEFAULT_CONFIG: Required<LineBuilderConfig> = {
  addOnGroupSlugs: [],
  skipValuePrefixes: ['none', 'no-'],
  defaultAddOnVariantId: null,
};

// ──────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────

export function buildCartLines(
  snapshotId: string,
  mainVariant: VariantMapping | null,
  basePrice: number,
  resolvedSelections: ResolvedSelection[],
  /** Product family name for the _addon_for linkage */
  productFamilyName: string,
  config?: LineBuilderConfig
): CartLines {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const mainGroups: ResolvedSelection[] = [];
  const addOnGroups: ResolvedSelection[] = [];

  for (const sel of resolvedSelections) {
    if (classifySelection(sel, cfg) === 'addon') {
      addOnGroups.push(sel);
    } else {
      mainGroups.push(sel);
    }
  }

  // ── Build main line ──
  const mainProperties: Record<string, string> = {
    '_configuration_id': snapshotId,
  };

  let mainPrice = basePrice;

  for (const sel of mainGroups) {
    const display = sel.priceDeltaFormatted
      ? `${sel.selectedValueName} (${sel.priceDeltaFormatted})`
      : sel.selectedValueName;
    mainProperties[sel.groupName] = display;

    if (sel.priceDelta) {
      mainPrice += sel.priceDelta;
    }
  }

  mainPrice = round(Math.max(0, mainPrice));

  // Build a stable title from the key selections (first 3 main groups)
  const mainTitleParts = mainGroups.slice(0, 3).map((s) => s.selectedValueName);
  const mainTitle = mainTitleParts.join(' / ');

  const mainLine: CartLine = {
    lineType: 'main',
    variantId: mainVariant?.variantId ?? null,
    quantity: 1,
    properties: mainProperties,
    price: mainPrice,
    title: mainTitle,
    includedGroups: mainGroups.map((s) => s.groupSlug),
    variantSource: mainVariant?.source ?? 'none',
    groupSlug: null,
    selectedValueSlug: null,
    sku: null,
  };

  // ── Build add-on lines ──
  const addOnLines: CartLine[] = [];

  // Stable linkage: use snapshot ID + product family name (never changes)
  const addonForRef = `${productFamilyName} [${snapshotId.slice(-8)}]`;

  for (const sel of addOnGroups) {
    const addOnPrice = round(sel.priceDelta ?? 0);

    // Resolve variant ID: from variant resolver → value metadata → config fallback
    const mapping = sel.variantMapping;
    const variantId = mapping?.variantId
      ?? (sel.valueMetadata?.shopifyVariantId as string | undefined)
      ?? cfg.defaultAddOnVariantId;

    const properties: Record<string, string> = {
      '_configuration_id': snapshotId,
      '_addon_for': addonForRef,
      '_addon_group': sel.groupSlug,
      '_addon_value': sel.selectedValueSlug,
      [sel.groupName]: sel.selectedValueName,
    };

    if (sel.priceDeltaFormatted) {
      properties['Price'] = sel.priceDeltaFormatted;
    }

    addOnLines.push({
      lineType: 'addon',
      variantId: variantId ?? null,
      quantity: 1,
      properties,
      price: addOnPrice,
      title: `${sel.groupName}: ${sel.selectedValueName}`,
      includedGroups: [sel.groupSlug],
      variantSource: mapping?.source ?? (variantId ? 'value_metadata' : 'none'),
      groupSlug: sel.groupSlug,
      selectedValueSlug: sel.selectedValueSlug,
      sku: mapping?.sku ?? null,
    });
  }

  const total = round(
    mainLine.price + addOnLines.reduce((sum, line) => sum + line.price, 0)
  );

  return { mainLine, addOnLines, total, snapshotId };
}

// ──────────────────────────────────────────────
// Classification logic
// ──────────────────────────────────────────────

function classifySelection(
  sel: ResolvedSelection,
  cfg: Required<LineBuilderConfig>
): 'main' | 'addon' {
  // 1. Explicit API-level override (highest priority)
  if (cfg.addOnGroupSlugs.length > 0 && cfg.addOnGroupSlugs.includes(sel.groupSlug)) {
    if (isSkipValue(sel.selectedValueSlug, cfg.skipValuePrefixes)) return 'main';
    return 'addon';
  }

  // 2. Group metadata override
  if (sel.groupMetadata?.lineType === 'addon') {
    if (isSkipValue(sel.selectedValueSlug, cfg.skipValuePrefixes)) return 'main';
    return 'addon';
  }
  if (sel.groupMetadata?.lineType === 'main') return 'main';

  // 3. Value metadata override
  if (sel.valueMetadata?.lineType === 'addon') return 'addon';
  if (sel.valueMetadata?.lineType === 'main') return 'main';

  // 4. Required groups → main line
  if (sel.isRequired) return 'main';

  // 5. Skip values → main line (as a note, not a separate add-on)
  if (isSkipValue(sel.selectedValueSlug, cfg.skipValuePrefixes)) return 'main';

  // 6. Optional with a real selection → add-on
  return 'addon';
}

function isSkipValue(slug: string, prefixes: string[]): boolean {
  const lower = slug.toLowerCase();
  return prefixes.some((prefix) => lower === prefix || lower.startsWith(prefix));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
