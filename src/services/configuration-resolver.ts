import { db } from '@/lib/db';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ResolverInput {
  productFamilyId: string;
  storeId: string;
  variantProfileId?: string | null;
  selections: Record<string, string>;
}

export interface ResolvedLineItem {
  shopifyVariantId: string;
  quantity: number;
  title: string;
  sku: string | null;
  price: string | null;
  imageUrl: string | null;
  sourceGroupSlug: string;
  sourceValueSlug: string;
  role: string | null;
  properties: Record<string, string>;
}

export interface ResolverOutput {
  lineItems: ResolvedLineItem[];
  totalPrice: number;
  configurationSummary: Record<string, string>;
  warnings: string[];
  familyName: string;
  profileName: string | null;
}

export class ResolverError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ResolverError';
    this.code = code;
  }
}

// ──────────────────────────────────────────────
// Resolver
// ──────────────────────────────────────────────

export async function resolveConfiguration(input: ResolverInput): Promise<ResolverOutput> {
  const { productFamilyId, storeId, variantProfileId, selections } = input;

  const family = await db.productFamily.findFirst({
    where: { id: productFamilyId, storeId },
    select: {
      id: true, name: true, basePrice: true,
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true, slug: true,
          isRequired: true, isConditional: true,
          visibilityConditions: true, variantProfileId: true,
          values: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true, name: true, slug: true,
              shopifyProductId: true, shopifyVariantId: true,
              shopifyProductTitle: true, shopifyVariantTitle: true,
              shopifySku: true, shopifyImageUrl: true, shopifyPrice: true,
              productMappings: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  shopifyProductId: true, shopifyVariantId: true,
                  shopifyProductTitle: true, shopifyVariantTitle: true,
                  shopifySku: true, shopifyImageUrl: true, shopifyPrice: true,
                  quantity: true, role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!family) throw new ResolverError('Product family not found', 'FAMILY_NOT_FOUND');

  let profileName: string | null = null;
  if (variantProfileId) {
    const profile = await db.productFamilyVariantProfile.findUnique({
      where: { id: variantProfileId },
      select: { name: true },
    });
    profileName = profile?.name ?? null;
  }

  const applicableGroups = family.optionGroups.filter((g: any) => {
    if (!g.variantProfileId) return true;
    return g.variantProfileId === variantProfileId;
  });

  const visibleGroups = applicableGroups.filter((g: any) => {
    if (!g.isConditional) return true;
    return evaluateConditions(g.visibilityConditions, selections);
  });

  const warnings: string[] = [];
  for (const group of visibleGroups) {
    if (group.isRequired && !selections[group.slug]) {
      throw new ResolverError(`Required option "${group.name}" has no selection`, 'MISSING_REQUIRED');
    }
  }

  const lineItems: ResolvedLineItem[] = [];
  const configurationSummary: Record<string, string> = {};
  const configJson: Record<string, string> = {};

  for (const group of visibleGroups) {
    const selectedSlug = selections[group.slug];
    if (!selectedSlug) continue;

    const value = group.values.find((v: any) => v.slug === selectedSlug);
    if (!value) { warnings.push(`Value "${selectedSlug}" not found in group "${group.name}"`); continue; }

    configurationSummary[group.name] = value.name;
    configJson[group.slug] = value.slug;

    if (value.productMappings.length > 0) {
      for (const mapping of value.productMappings) {
        if (!mapping.shopifyVariantId) { warnings.push(`Mapping in "${value.name}" has no variant ID, skipping`); continue; }
        lineItems.push({
          shopifyVariantId: normalizeVariantId(mapping.shopifyVariantId),
          quantity: mapping.quantity,
          title: [mapping.shopifyProductTitle, mapping.shopifyVariantTitle].filter(Boolean).join(' — '),
          sku: mapping.shopifySku ?? null,
          price: mapping.shopifyPrice != null ? String(mapping.shopifyPrice) : null,
          imageUrl: mapping.shopifyImageUrl ?? null,
          sourceGroupSlug: group.slug, sourceValueSlug: value.slug,
          role: mapping.role ?? 'component',
          properties: { _zure_family: family.name, _zure_profile: profileName ?? '', _zure_group: group.name, _zure_value: value.name, _zure_role: mapping.role ?? 'component' },
        });
      }
    } else if (value.shopifyVariantId) {
      lineItems.push({
        shopifyVariantId: normalizeVariantId(value.shopifyVariantId),
        quantity: 1,
        title: [value.shopifyProductTitle, value.shopifyVariantTitle].filter(Boolean).join(' — '),
        sku: value.shopifySku ?? null,
        price: value.shopifyPrice != null ? String(value.shopifyPrice) : null,
        imageUrl: value.shopifyImageUrl ?? null,
        sourceGroupSlug: group.slug, sourceValueSlug: value.slug,
        role: 'component',
        properties: { _zure_family: family.name, _zure_profile: profileName ?? '', _zure_group: group.name, _zure_value: value.name, _zure_role: 'component' },
      });
    }
  }

  const deduped = deduplicateLineItems(lineItems);
  const configString = JSON.stringify(configJson);
  for (const item of deduped) { item.properties._zure_configuration = configString; }

  let totalPrice = 0;
  for (const item of deduped) { if (item.price) totalPrice += parseFloat(item.price) * item.quantity; }

  return { lineItems: deduped, totalPrice, configurationSummary, warnings, familyName: family.name, profileName };
}

function normalizeVariantId(vid: string): string {
  const match = vid.match(/gid:\/\/shopify\/ProductVariant\/(\d+)/);
  if (match) { const n = match[1]; if (n) return n; }
  return vid;
}

function deduplicateLineItems(items: ResolvedLineItem[]): ResolvedLineItem[] {
  const map = new Map<string, ResolvedLineItem>();
  for (const item of items) {
    const existing = map.get(item.shopifyVariantId);
    if (existing) { existing.quantity += item.quantity; } else { map.set(item.shopifyVariantId, { ...item }); }
  }
  return Array.from(map.values());
}

interface ConditionRow { sourceGroupSlug: string; sourceValueSlug: string; operator: string; connector: string | null; }

function evaluateConditions(conditions: unknown, selections: Record<string, string>): boolean {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
  const rows = conditions as ConditionRow[];
  const segments: ConditionRow[][] = []; let current: ConditionRow[] = [];
  for (const cond of rows) { current.push(cond); if (cond.connector === 'OR' || cond.connector === null || cond.connector === undefined) { segments.push(current); current = []; } }
  if (current.length > 0) segments.push(current);
  for (const segment of segments) {
    let allPass = true;
    for (const rule of segment) {
      const selected = selections[rule.sourceGroupSlug];
      if (rule.operator === 'equals' && selected !== rule.sourceValueSlug) { allPass = false; break; }
      if (rule.operator === 'not_equals' && selected === rule.sourceValueSlug) { allPass = false; break; }
    }
    if (allPass) return true;
  }
  return false;
}
