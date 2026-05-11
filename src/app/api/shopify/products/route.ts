import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCTS_WITH_VARIANTS_QUERY = `
  query SearchProductsWithVariants($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                image {
                  url
                  altText
                }
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const store = await db.store.findUnique({
      where: { id: tenant.storeId },
      select: { shopifyDomain: true, shopifyAccessToken: true },
    });

    if (!store || !store.shopifyAccessToken) {
      return tenantError('Store not connected to Shopify', 400);
    }

    const searchQuery = request.nextUrl.searchParams.get('query') ?? '';
    const includeVariants = request.nextUrl.searchParams.get('includeVariants') === 'true';
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10),
      50
    );

    const graphqlQuery = includeVariants ? PRODUCTS_WITH_VARIANTS_QUERY : PRODUCTS_QUERY;

    const shopifyRes = await fetch(
      `https://${store.shopifyDomain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': store.shopifyAccessToken,
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: {
            query: searchQuery || '*',
            first: limit,
          },
        }),
      }
    );

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      console.error('[shopify/products] Shopify API error:', shopifyRes.status, errText);
      return tenantError('Failed to fetch products from Shopify', 502);
    }

    const shopifyData = await shopifyRes.json();

    if (shopifyData.errors) {
      console.error('[shopify/products] GraphQL errors:', shopifyData.errors);
      return tenantError('Shopify GraphQL error', 502);
    }

    const edges = shopifyData.data?.products?.edges ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products = edges.map((edge: any) => {
      const node = edge.node;
      const variantEdges = node.variants?.edges ?? [];

      if (includeVariants) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variants = variantEdges.map((ve: any) => {
          const v = ve.node;
          return {
            id: v.id,
            title: v.title,
            price: v.price,
            sku: v.sku ?? null,
            imageUrl: v.image?.url ?? null,
            imageAlt: v.image?.altText ?? null,
            inventoryQuantity: v.inventoryQuantity ?? null,
            selectedOptions: v.selectedOptions ?? [],
          };
        });

        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          status: node.status,
          featuredImageUrl: node.featuredImage?.url ?? null,
          featuredImageAlt: node.featuredImage?.altText ?? null,
          variants,
        };
      }

      const firstVariant = variantEdges[0]?.node;
      return {
        id: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
        featuredImageUrl: node.featuredImage?.url ?? null,
        featuredImageAlt: node.featuredImage?.altText ?? null,
        firstVariantId: firstVariant?.id ?? null,
        firstVariantPrice: firstVariant?.price ?? '0.00',
      };
    });

    return tenantResponse({ products });
  } catch (error) {
    console.error('[shopify/products]', error);
    return tenantError('Failed to search Shopify products', 500);
  }
}
