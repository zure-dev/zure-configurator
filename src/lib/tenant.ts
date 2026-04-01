import { NextRequest } from 'next/server';
import { db } from './db';

export interface TenantContext {
  storeId: string;
  shopifyDomain: string;
  merchantId: string;
}

/**
 * Extract tenant context from an authenticated admin request.
 *
 * Resolution order:
 *   1. x-shopify-shop-domain header (set by App Bridge in production)
 *   2. ?shop= query parameter (set by Shopify when loading the app)
 *   3. DEV_STORE_DOMAIN env var (local development fallback ONLY)
 *
 * The dev fallback only activates when NODE_ENV !== 'production' AND
 * neither header nor query param provided a shop domain. This means:
 *   - Production: always requires real Shopify auth signals
 *   - Development: works in a plain browser at localhost:3000
 */
export async function getTenantFromSession(
  request: NextRequest
): Promise<TenantContext | null> {
  // 1. Try header (production: App Bridge sets this)
  let shopifyDomain = request.headers.get('x-shopify-shop-domain');

  // 2. Try query param (Shopify loads app with ?shop=)
  if (!shopifyDomain) {
    shopifyDomain = request.nextUrl.searchParams.get('shop');
  }

  // 3. Dev fallback — only in non-production, only when no real auth signal
  if (!shopifyDomain && process.env.NODE_ENV !== 'production') {
    shopifyDomain = process.env.DEV_STORE_DOMAIN ?? null;
    if (shopifyDomain) {
      console.log(`[tenant] Dev fallback → ${shopifyDomain}`);
    }
  }

  if (!shopifyDomain) return null;

  const store = await db.store.findUnique({
    where: { shopifyDomain },
    select: { id: true, shopifyDomain: true, merchantId: true },
  });

  if (!store) return null;

  return {
    storeId: store.id,
    shopifyDomain: store.shopifyDomain,
    merchantId: store.merchantId,
  };
}

/**
 * Extract tenant context from a storefront request.
 * Storefront requests come with the shop domain in a header.
 * Same dev fallback applies.
 */
export async function getTenantFromStorefront(
  request: NextRequest
): Promise<TenantContext | null> {
  let shopifyDomain = request.headers.get('x-shop-domain');

  if (!shopifyDomain && process.env.NODE_ENV !== 'production') {
    shopifyDomain = process.env.DEV_STORE_DOMAIN ?? null;
  }

  if (!shopifyDomain) return null;

  const store = await db.store.findUnique({
    where: { shopifyDomain },
    select: { id: true, shopifyDomain: true, merchantId: true },
  });

  if (!store) return null;

  return {
    storeId: store.id,
    shopifyDomain: store.shopifyDomain,
    merchantId: store.merchantId,
  };
}

/**
 * Ensure a query is scoped to a specific store.
 * Use this in every service method to prevent cross-tenant data access.
 */
export function scopeToStore(storeId: string) {
  return { storeId } as const;
}

/**
 * Create a JSON response with consistent structure
 */
export function tenantResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function tenantError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
