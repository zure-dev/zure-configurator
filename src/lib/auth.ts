import { NextRequest } from 'next/server';
import * as jose from 'jose';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY ?? '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? '';

/**
 * Verify a Shopify session token (JWT) from App Bridge.
 * Used for admin API routes.
 */
export async function verifyShopifySessionToken(
  request: NextRequest
): Promise<{ shop: string; sub: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(SHOPIFY_API_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: `https://${extractShopFromToken(token)}`,
      audience: SHOPIFY_API_KEY,
    });

    return {
      shop: payload.dest as string,
      sub: payload.sub as string,
    };
  } catch {
    return null;
  }
}

function extractShopFromToken(token: string): string {
  try {
    const payload = jose.decodeJwt(token);
    const dest = payload.dest as string;
    return dest.replace('https://', '');
  } catch {
    return '';
  }
}

/**
 * Generate the Shopify OAuth authorization URL
 */
export function getAuthorizationUrl(shop: string, nonce: string): string {
  const scopes = process.env.SHOPIFY_SCOPES ?? '';
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange the authorization code for an access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string } | null> {
  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Validate that a shop domain is a valid Shopify store
 */
export function isValidShopDomain(shop: string): boolean {
  const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return pattern.test(shop);
}
