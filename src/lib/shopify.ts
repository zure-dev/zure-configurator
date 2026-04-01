import { db } from './db';

const SHOPIFY_API_VERSION = '2024-10';

interface ShopifyClientOptions {
  shopifyDomain: string;
  accessToken: string;
}

/**
 * Create a Shopify Admin API client for a specific store.
 */
export function createShopifyClient(options: ShopifyClientOptions) {
  const { shopifyDomain, accessToken } = options;
  const baseUrl = `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}`;

  async function graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${baseUrl}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }

  async function rest<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${baseUrl}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Shopify REST error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  return { graphql, rest };
}

/**
 * Create a Shopify client from a store ID (fetches credentials from DB)
 */
export async function createShopifyClientForStore(storeId: string) {
  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { shopifyDomain: true, shopifyAccessToken: true },
  });

  return createShopifyClient({
    shopifyDomain: store.shopifyDomain,
    accessToken: store.shopifyAccessToken,
  });
}
