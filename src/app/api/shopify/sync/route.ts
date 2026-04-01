import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createShopifyClientForStore } from '@/lib/shopify';
import { createAuditLog } from '@/lib/audit';

// POST /api/shopify/sync — sync a Shopify product to a product family
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, shopifyProductId } = body;

    if (!productFamilyId || !shopifyProductId) {
      return tenantError('productFamilyId and shopifyProductId are required');
    }

    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    // Fetch product details from Shopify
    const shopify = await createShopifyClientForStore(tenant.storeId);

    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node {
                id
                legacyResourceId
              }
            }
          }
          legacyResourceId
        }
      }
    `;

    const data = await shopify.graphql<{
      product: {
        id: string;
        title: string;
        handle: string;
        legacyResourceId: string;
        variants: {
          edges: Array<{
            node: { id: string; legacyResourceId: string };
          }>;
        };
      };
    }>(query, { id: shopifyProductId });

    const product = data.product;
    if (!product) return tenantError('Shopify product not found', 404);

    const firstVariant = product.variants.edges[0]?.node;

    // Upsert the link
    const link = await db.productFamilyShopifyLink.upsert({
      where: { productFamilyId },
      update: {
        shopifyProductId: product.id,
        shopifyProductNumericId: product.legacyResourceId,
        shopifyVariantId: firstVariant?.id,
        shopifyVariantNumericId: firstVariant?.legacyResourceId,
        shopifyProductHandle: product.handle,
        syncedAt: new Date(),
      },
      create: {
        productFamilyId,
        shopifyProductId: product.id,
        shopifyProductNumericId: product.legacyResourceId,
        shopifyVariantId: firstVariant?.id,
        shopifyVariantNumericId: firstVariant?.legacyResourceId,
        shopifyProductHandle: product.handle,
        syncedAt: new Date(),
      },
    });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'UPDATE',
      entityType: 'ProductFamilyShopifyLink',
      entityId: link.id,
      after: link,
      metadata: { shopifyProduct: product.title },
    });

    return tenantResponse({
      link,
      shopifyProduct: {
        id: product.id,
        title: product.title,
        handle: product.handle,
      },
    });
  } catch (error) {
    console.error('[shopify/sync]', error);
    return tenantError('Failed to sync Shopify product', 500);
  }
}
