/**
 * Draft Order Service
 *
 * Creates a Shopify Draft Order from resolved cart lines.
 * Uses the Shopify Admin GraphQL API (draftOrderCreate mutation).
 *
 * PRICING STRATEGY:
 *
 *   Shopify's draftOrderCreate accepts `originalUnitPrice` on every line item.
 *   When set, this overrides the variant's default price in Shopify.
 *
 *   For variant-based lines:
 *     - We reference the real Shopify variant
 *     - We set originalUnitPrice to the configurator-computed price
 *
 *   For custom lines:
 *     - We set title + originalUnitPrice directly
 */

import { db } from '@/lib/db';
import { createShopifyClientForStore } from '@/lib/shopify';
import { createAuditLog } from '@/lib/audit';
import type { CartLine, CartLines } from '@/services/cart-line-builder.service';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateDraftOrderInput {
  storeId: string;
  snapshotId: string;
  cartLines: CartLines;
  customerEmail?: string | null;
  note?: string | null;
  shopifyCustomerId?: string | null;
  currency?: string | null;
}

export interface DraftOrderResult {
  success: boolean;
  errors: string[];
  draftOrderId: string | null;
  draftOrderName: string | null;
  invoiceUrl: string | null;
  adminUrl: string | null;
  lineItemCount: number;
  skippedLines: SkippedLine[];
  shopifyTotal: string | null;
}

export interface SkippedLine {
  title: string;
  groupSlug: string | null;
  reason: string;
}

interface ShopifyDraftLineItem {
  hasVariant: boolean;
  variantGid: string | null;
  title: string;
  quantity: number;
  price: string;
  customAttributes: Array<{ key: string; value: string }>;
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

export async function createDraftOrder(
  input: CreateDraftOrderInput
): Promise<DraftOrderResult> {
  const skippedLines: SkippedLine[] = [];

  try {
    console.log('[createDraftOrder] start');
    console.log('[createDraftOrder] storeId:', input.storeId);
    console.log('[createDraftOrder] snapshotId:', input.snapshotId);
    console.log('[createDraftOrder] configurator total:', input.cartLines.total);
    console.log('[createDraftOrder] main line variant:', input.cartLines.mainLine?.variantId ?? null);
    console.log('[createDraftOrder] add-on count:', input.cartLines.addOnLines?.length ?? 0);

    // ── 1. Check store/token before creating Shopify client ──
    const store = await db.store.findUnique({
      where: { id: input.storeId },
      select: {
        id: true,
        shopifyDomain: true,
        shopifyAccessToken: true,
      },
    });

    console.log('[createDraftOrder] store found:', !!store);
    console.log('[createDraftOrder] shopifyDomain:', store?.shopifyDomain ?? null);
    console.log('[createDraftOrder] has access token:', !!store?.shopifyAccessToken);
    console.log(
      '[createDraftOrder] token preview:',
      store?.shopifyAccessToken ? `${store.shopifyAccessToken.slice(0, 8)}...` : 'missing'
    );

    if (!store) {
      return emptyResult([`Store not found for storeId: ${input.storeId}`]);
    }

    if (!store.shopifyAccessToken) {
      return emptyResult([
        `Store ${input.storeId} has no Shopify access token. Reinstall or re-auth the app for ${store.shopifyDomain}.`,
      ]);
    }

    // ── 2. Build line items ──
    const lineItems: ShopifyDraftLineItem[] = [];

    lineItems.push(buildLineItem(input.cartLines.mainLine, 'main'));

    for (const addOn of input.cartLines.addOnLines) {
      lineItems.push(buildLineItem(addOn, 'addon'));

      if (!addOn.variantId) {
        skippedLines.push({
          title: addOn.title,
          groupSlug: addOn.groupSlug,
          reason: 'No Shopify variant mapped — created as custom line item with explicit price',
        });
      }
    }

    if (lineItems.length === 0) {
      return {
        ...emptyResult(['No line items could be built']),
        skippedLines,
      };
    }

    console.log('[createDraftOrder] built line items:', lineItems);

    // ── 3. Build note ──
    const configNote = [`Configuration: ${input.snapshotId}`, input.note ?? '']
      .filter(Boolean)
      .join('\n');

    // ── 4. Build Shopify client ──
    console.log('[createDraftOrder] creating Shopify client for store:', input.storeId);
    const shopify = await createShopifyClientForStore(input.storeId);
    console.log('[createDraftOrder] Shopify client created');

    // ── 5. Mutation ──
    const mutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const draftInput: Record<string, unknown> = {
      note: configNote,
      lineItems: lineItems.map(formatLineItemForGraphQL),
      tags: ['zure-configurator', `snapshot:${input.snapshotId}`],
      customAttributes: [
        { key: '_configuration_id', value: input.snapshotId },
        { key: '_configured_via', value: 'zure-configurator' },
      ],
    };

    if (input.customerEmail) {
      draftInput.email = input.customerEmail;
    }

    if (input.shopifyCustomerId) {
      draftInput.customerId = input.shopifyCustomerId;
    }

    console.log('[createDraftOrder] draft input:', JSON.stringify(draftInput, null, 2));
    console.log('[createDraftOrder] calling Shopify draftOrderCreate for:', store.shopifyDomain);

    const response = await shopify.graphql<{
      draftOrderCreate: {
        draftOrder: {
          id: string;
          name: string;
          invoiceUrl: string;
          totalPriceSet: {
            shopMoney: { amount: string; currencyCode: string };
          };
          lineItems: {
            edges: Array<{
              node: {
                title: string;
                quantity: number;
                originalUnitPriceSet: { shopMoney: { amount: string } };
              };
            }>;
          };
        } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { input: draftInput });

    console.log('[createDraftOrder] raw Shopify response:', JSON.stringify(response, null, 2));

    const result = response.draftOrderCreate;

    if (result.userErrors.length > 0) {
      const shopifyErrors = result.userErrors.map((e) => {
        const fieldPath = Array.isArray(e.field) ? e.field.join('.') : '';
        return fieldPath ? `${fieldPath}: ${e.message}` : e.message;
      });

      console.log('[createDraftOrder] Shopify userErrors:', shopifyErrors);

      return {
        success: false,
        errors: shopifyErrors,
        draftOrderId: null,
        draftOrderName: null,
        invoiceUrl: null,
        adminUrl: null,
        lineItemCount: lineItems.length,
        skippedLines,
        shopifyTotal: null,
      };
    }

    if (!result.draftOrder) {
      return {
        ...emptyResult(['Shopify returned no draft order and no userErrors']),
        lineItemCount: lineItems.length,
        skippedLines,
      };
    }

    const draftOrder = result.draftOrder;
    const shopifyTotal = draftOrder.totalPriceSet.shopMoney.amount;

    console.log('[createDraftOrder] Shopify total:', shopifyTotal);
    for (const edge of draftOrder.lineItems.edges) {
      const node = edge.node;
      console.log(
        `[createDraftOrder] Shopify line: ${node.title} x${node.quantity} @ $${node.originalUnitPriceSet.shopMoney.amount}`
      );
    }

    // ── 6. Build admin URL ──
    const numericId = extractNumericId(draftOrder.id);
    const adminUrl = `https://${store.shopifyDomain}/admin/draft_orders/${numericId}`;

    // ── 7. Audit ──
    await createAuditLog({
      storeId: input.storeId,
      action: 'CREATE',
      entityType: 'DraftOrder',
      entityId: draftOrder.id,
      after: {
        draftOrderId: draftOrder.id,
        draftOrderName: draftOrder.name,
        snapshotId: input.snapshotId,
        shopifyTotal,
        configuratorTotal: input.cartLines.total,
        lineItemCount: lineItems.length,
      },
    });

    return {
      success: true,
      errors: [],
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      invoiceUrl: draftOrder.invoiceUrl,
      adminUrl,
      lineItemCount: lineItems.length,
      skippedLines,
      shopifyTotal,
    };
  } catch (error) {
    console.error('[createDraftOrder] fatal error:', error);

    let message = 'Unknown Shopify API error';

    if (error instanceof Error) {
      message = error.message;
      console.error('[createDraftOrder] error message:', error.message);
      console.error('[createDraftOrder] error stack:', error.stack);

      if (error.message.includes('401')) {
        message =
          'Shopify GraphQL error: 401 Unauthorized. The stored Shopify access token is likely stale, invalid, or missing required scopes. Reinstall/re-auth the app for this store and verify write_draft_orders scope.';
      }
    }

    return {
      success: false,
      errors: [message],
      draftOrderId: null,
      draftOrderName: null,
      invoiceUrl: null,
      adminUrl: null,
      lineItemCount: input.cartLines.mainLine ? 1 + input.cartLines.addOnLines.length : 0,
      skippedLines,
      shopifyTotal: null,
    };
  }
}

// ──────────────────────────────────────────────
// Line item builder
// ──────────────────────────────────────────────

function buildLineItem(line: CartLine, role: 'main' | 'addon'): ShopifyDraftLineItem {
  const customAttributes = Object.entries(line.properties).map(([key, value]) => ({
    key,
    value,
  }));

  customAttributes.push({ key: '_line_role', value: role });
  customAttributes.push({ key: '_configurator_price', value: line.price.toFixed(2) });

  if (!line.variantId) {
    customAttributes.push({ key: '_variant_pending', value: 'true' });
  }

  const variantGid = line.variantId
    ? line.variantId.startsWith('gid://')
      ? line.variantId
      : `gid://shopify/ProductVariant/${line.variantId}`
    : null;

  return {
    hasVariant: !!variantGid,
    variantGid,
    title: line.title,
    quantity: line.quantity,
    price: line.price.toFixed(2),
    customAttributes,
  };
}

function formatLineItemForGraphQL(item: ShopifyDraftLineItem): Record<string, unknown> {
  if (item.hasVariant && item.variantGid) {
    return {
      variantId: item.variantGid,
      quantity: item.quantity,
      originalUnitPrice: item.price,
      customAttributes: item.customAttributes,
    };
  }

  return {
    title: item.title,
    quantity: item.quantity,
    originalUnitPrice: item.price,
    customAttributes: item.customAttributes,
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function extractNumericId(gid: string): string {
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1]! : gid;
}

function emptyResult(errors: string[]): DraftOrderResult {
  return {
    success: false,
    errors,
    draftOrderId: null,
    draftOrderName: null,
    invoiceUrl: null,
    adminUrl: null,
    lineItemCount: 0,
    skippedLines: [],
    shopifyTotal: null,
  };
}