'use client';

// ──────────────────────────────────────────────
// Shared API client for Zure Configurator admin
//
// Automatically appends ?shop= to all API calls.
// On 401, redirects to Shopify OAuth re-auth.
// Import this in every admin page instead of bare fetch().
// ──────────────────────────────────────────────

let cachedShop: string | null = null;
let redirecting = false;

/**
 * Get the current shop domain from multiple sources.
 * Shopify always includes ?shop= when loading the app in the admin iframe.
 */
export function getShopDomain(): string {
  if (cachedShop) return cachedShop;
  if (typeof window === 'undefined') return '';

  // 1. URL query param (Shopify sets this in the iframe)
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('shop');
  if (fromUrl) {
    cachedShop = fromUrl;
    return fromUrl;
  }

  // 2. Shopify App Bridge global (if loaded)
  try {
    const appBridge = (window as any).__SHOPIFY_APP_BRIDGE_CONFIG__;
    if (appBridge?.shop) {
      cachedShop = appBridge.shop;
      return appBridge.shop;
    }
  } catch { /* ignore */ }

  // 3. Referrer-based detection (Shopify admin referrer contains the shop)
  try {
    if (document.referrer.includes('.myshopify.com')) {
      const url = new URL(document.referrer);
      const shop = url.hostname;
      if (shop.endsWith('.myshopify.com')) {
        cachedShop = shop;
        return shop;
      }
    }
  } catch { /* ignore */ }

  return '';
}

/**
 * Make an API call with shop context automatically included.
 * On 401 Unauthorized, redirects to Shopify OAuth.
 */
export function apiFetch(url: string, opts?: RequestInit): Promise<Response> {
  const shop = getShopDomain();

  // Append shop to URL if not already present
  let finalUrl = url;
  if (shop && !url.includes('shop=')) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}shop=${encodeURIComponent(shop)}`;
  }

  return fetch(finalUrl, opts).then((res) => {
    if (res.status === 401 && !redirecting) {
      redirecting = true;

      // Show user-friendly message
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:16px;background:#1a1a2e;color:#fff;text-align:center;z-index:99999;font-family:system-ui;font-size:14px;';
      banner.textContent = 'Session expired. Reconnecting to Shopify…';
      document.body.appendChild(banner);

      // Redirect to re-auth
      if (shop) {
        setTimeout(() => {
          window.location.href = `/api/auth?shop=${encodeURIComponent(shop)}`;
        }, 1000);
      } else {
        banner.textContent = 'Session expired. Please reopen the app from your Shopify admin.';
      }

      // Return a never-resolving promise since we're redirecting
      return new Promise<Response>(() => {});
    }
    return res;
  });
}

/**
 * Reset cached shop (useful after re-auth or for testing)
 */
export function resetShopCache() {
  cachedShop = null;
  redirecting = false;
}
