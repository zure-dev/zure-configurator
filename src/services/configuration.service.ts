import { db } from '@/lib/db';
import {
  evaluateConfiguration,
  signConfiguration,
  computeDefaultSelections,
  generateLineItemProperties,
} from '@zure/rule-engine';
import type {
  ProductFamilyDefinition,
  ConfigurationInput,
  ConfigurationResult,
  CustomerContext,
} from '@zure/rule-engine';
import { createHash } from 'crypto';

/**
 * Load a ProductFamilyDefinition from the database.
 * This transforms the relational data into the flat structure the rule engine expects.
 */
export async function loadProductFamilyDefinition(
  productFamilyId: string
): Promise<ProductFamilyDefinition | null> {
  const family = await db.productFamily.findUnique({
    where: { id: productFamilyId },
    include: {
      optionGroups: {
        where: {},
        orderBy: { sortOrder: 'asc' },
        include: {
          values: { orderBy: { sortOrder: 'asc' } },
        },
      },
      dependencyRules: { where: { isActive: true } },
      exclusionRules: { where: { isActive: true } },
      priceRules: { where: { isActive: true } },
      tradePriceRules: { where: { isActive: true } },
      mediaRules: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      summaryRules: { orderBy: { sortOrder: 'asc' } },
      componentMaps: true,
    },
  });

  if (!family) return null;

  // Get the latest published rule version
  const latestVersion = await db.ruleVersion.findFirst({
    where: { productFamilyId, publishedAt: { not: null } },
    orderBy: { version: 'desc' },
  });

  // Transform into rule engine format
  const definition: ProductFamilyDefinition = {
    id: family.id,
    name: family.name,
    slug: family.slug,
    basePrice: Number(family.basePrice),
    defaultMediaSet: (family.defaultMediaSet as any[]) ?? [],
    ruleVersionId: latestVersion?.id ?? 'draft',
    optionGroups: family.optionGroups.map((g) => ({
      slug: g.slug,
      name: g.name,
      displayType: g.displayType,
      sortOrder: g.sortOrder,
      isRequired: g.isRequired,
      helperText: g.helperText ?? undefined,
      stepNumber: g.stepNumber ?? undefined,
      values: g.values.map((v) => ({
        slug: v.slug,
        name: v.name,
        sortOrder: v.sortOrder,
        isDefault: v.isDefault,
        swatchColor: v.swatchColor ?? undefined,
        swatchImage: v.swatchImage ?? undefined,
        thumbnailUrl: v.thumbnailUrl ?? undefined,
        description: v.description ?? undefined,
        metadata: (v.metadata as Record<string, unknown>) ?? undefined,
      })),
    })),
    dependencyRules: family.dependencyRules.map((r) => ({
      id: r.id,
      name: r.name ?? undefined,
      whenOptionGroupSlug: r.whenOptionGroupSlug,
      whenOptionValueSlug: r.whenOptionValueSlug,
      thenOptionGroupSlug: r.thenOptionGroupSlug,
      thenOptionValueSlugs: r.thenOptionValueSlugs,
    })),
    exclusionRules: family.exclusionRules.map((r) => ({
      id: r.id,
      name: r.name ?? undefined,
      whenOptionGroupSlug: r.whenOptionGroupSlug,
      whenOptionValueSlug: r.whenOptionValueSlug,
      excludeOptionGroupSlug: r.excludeOptionGroupSlug,
      excludeOptionValueSlugs: r.excludeOptionValueSlugs,
    })),
    priceRules: family.priceRules.map((r) => ({
      id: r.id,
      optionGroupSlug: r.optionGroupSlug,
      optionValueSlug: r.optionValueSlug,
      priceModifier: Number(r.priceModifier),
      modifierType: r.modifierType as any,
      conditions: (r.conditions as any[]) ?? undefined,
    })),
    tradePriceRules: family.tradePriceRules.map((r) => ({
      id: r.id,
      optionGroupSlug: r.optionGroupSlug,
      optionValueSlug: r.optionValueSlug,
      priceModifier: Number(r.priceModifier),
      modifierType: r.modifierType as any,
      tradeCondition: r.tradeCondition as any,
      conditions: (r.conditions as any[]) ?? undefined,
    })),
    mediaRules: family.mediaRules.map((r) => ({
      id: r.id,
      name: r.name ?? undefined,
      priority: r.priority,
      conditions: r.conditions as any[],
      mediaSet: r.mediaSet as any[],
    })),
    summaryRules: family.summaryRules.map((r) => ({
      optionGroupSlug: r.optionGroupSlug,
      template: r.template,
      sortOrder: r.sortOrder,
      includeInLineItem: r.includeInLineItem,
    })),
    componentMaps: await loadComponentMapsWithDetails(family.id),
  };

  return definition;
}

/**
 * Load component maps with full component details joined.
 */
async function loadComponentMapsWithDetails(productFamilyId: string) {
  const maps = await db.configurationToComponentMap.findMany({
    where: { productFamilyId },
  });

  const componentIds = maps.map((m) => m.componentId);
  const components = await db.component.findMany({
    where: { id: { in: componentIds } },
  });
  const componentMap = new Map(components.map((c) => [c.id, c]));

  return maps.map((m) => {
    const comp = componentMap.get(m.componentId);
    return {
      id: m.id,
      conditions: m.conditions as any[],
      componentId: m.componentId,
      componentSku: comp?.sku ?? '',
      componentName: comp?.name ?? '',
      componentType: comp?.type ?? 'OTHER',
      quantity: m.quantity,
    };
  });
}

/**
 * Start a new configuration session.
 */
export async function startConfigurationSession(params: {
  storeId: string;
  productFamilyId: string;
  shopifyProductId?: string;
  customerIdent?: string;
  isTradeCustomer?: boolean;
}) {
  const definition = await loadProductFamilyDefinition(params.productFamilyId);
  if (!definition) throw new Error('Product family not found');

  const defaults = computeDefaultSelections({ productFamily: definition });

  const session = await db.configurationSession.create({
    data: {
      storeId: params.storeId,
      productFamilyId: params.productFamilyId,
      shopifyProductId: params.shopifyProductId,
      customerIdent: params.customerIdent,
      isTradeCustomer: params.isTradeCustomer ?? false,
      selections: defaults,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  // Evaluate with defaults
  const input: ConfigurationInput = {
    productFamily: definition,
    selections: defaults,
    customerContext: {
      isTradeCustomer: params.isTradeCustomer ?? false,
    },
  };

  const initialResult = evaluateConfiguration(input);

  return {
    session,
    definition,
    defaults,
    initialResult,
  };
}

/**
 * Evaluate a configuration for an existing session.
 */
export async function evaluateSessionConfiguration(params: {
  sessionId: string;
  selections: Record<string, string>;
  customerContext: CustomerContext;
}) {
  const session = await db.configurationSession.findUniqueOrThrow({
    where: { id: params.sessionId },
  });

  const definition = await loadProductFamilyDefinition(session.productFamilyId);
  if (!definition) throw new Error('Product family not found');

  const input: ConfigurationInput = {
    productFamily: definition,
    selections: params.selections,
    customerContext: params.customerContext,
  };

  const result = evaluateConfiguration(input);

  // Update session with latest selections
  await db.configurationSession.update({
    where: { id: params.sessionId },
    data: {
      selections: params.selections,
      resolvedPrice: result.pricing.totalPrice,
      isTradeCustomer: params.customerContext.isTradeCustomer,
    },
  });

  return result;
}

/**
 * Prepare a cart resolution — called when customer clicks Add to Cart.
 * Server-side validation, snapshot creation, component mapping.
 */
export async function prepareCartResolution(params: {
  sessionId: string;
  selections: Record<string, string>;
  customerContext: CustomerContext;
}) {
  const session = await db.configurationSession.findUniqueOrThrow({
    where: { id: params.sessionId },
  });

  const definition = await loadProductFamilyDefinition(session.productFamilyId);
  if (!definition) throw new Error('Product family not found');

  const input: ConfigurationInput = {
    productFamily: definition,
    selections: params.selections,
    customerContext: params.customerContext,
  };

  // Full evaluation
  const result = evaluateConfiguration(input);

  // Server-side validation — NEVER trust client
  if (!result.isValid) {
    return {
      success: false,
      errors: result.errors,
      result: null,
      snapshot: null,
    };
  }

  // Generate proper SHA-256 signature
  const signaturePayload = JSON.stringify({
    familyId: definition.id,
    ruleVersion: definition.ruleVersionId,
    selections: params.selections,
    totalPrice: result.pricing.totalPrice,
    isTradePrice: result.pricing.isTradePrice,
    componentCount: result.components.mappings.length,
    timestamp: Date.now(),
  });
  const validationSignature = `sha256:${createHash('sha256').update(signaturePayload).digest('hex')}`;

  // Create snapshot
  const snapshot = await db.configurationSnapshot.create({
    data: {
      sessionId: session.id,
      productFamilyId: session.productFamilyId,
      ruleVersionId: definition.ruleVersionId,
      selections: Object.fromEntries(
        Object.entries(params.selections).map(([groupSlug, valueSlug]) => {
          const group = definition.optionGroups.find((g) => g.slug === groupSlug);
          const value = group?.values.find((v) => v.slug === valueSlug);
          return [groupSlug, { slug: valueSlug, name: value?.name ?? valueSlug }];
        })
      ),
      pricingBreakdown: result.pricing,
      mediaState: result.media,
      componentMappings: result.components.mappings,
      tradeState: result.pricing.isTradePrice ? { isTradePrice: true } : undefined,
      summaryText: result.summary.humanReadable,
      summaryStructured: result.summary.structured,
      validationSignature,
    },
  });

  // Get Shopify variant ID for cart
  const shopifyLink = await db.productFamilyShopifyLink.findUnique({
    where: { productFamilyId: session.productFamilyId },
  });

  const variantId = shopifyLink?.shopifyVariantNumericId ?? shopifyLink?.shopifyVariantId ?? '';

  // Generate line item properties
  const lineItemProperties = generateLineItemProperties(result.summary, snapshot.id);

  // Create cart resolution record
  const cartResolution = await db.cartResolutionRecord.create({
    data: {
      snapshotId: snapshot.id,
      shopifyVariantId: variantId,
      lineItemProperties: lineItemProperties,
      resolvedPrice: result.pricing.totalPrice,
    },
  });

  // Mark session as resolved
  await db.configurationSession.update({
    where: { id: session.id },
    data: {
      status: 'RESOLVED',
      resolvedPrice: result.pricing.totalPrice,
    },
  });

  return {
    success: true,
    errors: [],
    result,
    snapshot,
    cartPayload: {
      variantId,
      quantity: 1,
      properties: lineItemProperties,
    },
    snapshotId: snapshot.id,
    cartResolutionId: cartResolution.id,
  };
}

/**
 * Resolve a product family from a Shopify product ID.
 */
export async function resolveProductFamilyByShopifyId(
  storeId: string,
  shopifyProductId: string
): Promise<string | null> {
  const link = await db.productFamilyShopifyLink.findFirst({
    where: {
      shopifyProductId,
      productFamily: { storeId },
    },
    select: { productFamilyId: true },
  });

  return link?.productFamilyId ?? null;
}
