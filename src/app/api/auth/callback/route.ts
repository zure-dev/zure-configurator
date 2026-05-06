import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';

// ──────────────────────────────────────────────
// GET /api/auth/callback?code=...&hmac=...&shop=...&state=...
// Handles the Shopify OAuth callback after merchant approves.
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  // ── 1. Validate required params ──
  if (!shop || !code || !state || !hmac) {
    console.error('[auth/callback] Missing required query parameters');
    return NextResponse.json(
      { error: 'Missing required query parameters' },
      { status: 400 }
    );
  }

  if (!shop.endsWith('.myshopify.com')) {
    return NextResponse.json(
      { error: 'Invalid shop domain' },
      { status: 400 }
    );
  }

  // ── 2. Validate state cookie (CSRF protection) ──
  const storedState = request.cookies.get('shopify_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    console.error('[auth/callback] State mismatch', {
      received: state,
      stored: storedState ?? 'missing',
    });
    return NextResponse.json(
      { error: 'State validation failed. Please restart the install process.' },
      { status: 403 }
    );
  }

  // ── 3. Validate HMAC ──
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    console.error('[auth/callback] Missing SHOPIFY_API_SECRET env');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (!verifyCallbackHmac(searchParams, hmac, apiSecret)) {
    console.error('[auth/callback] HMAC validation failed');
    return NextResponse.json(
      { error: 'HMAC validation failed' },
      { status: 403 }
    );
  }

  // ── 4. Exchange code for access token ──
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    console.error('[auth/callback] Missing SHOPIFY_API_KEY env');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  let accessToken: string;

  try {
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[auth/callback] Token exchange failed:', tokenResponse.status, errBody);
      return NextResponse.json(
        { error: 'Failed to obtain access token from Shopify' },
        { status: 502 }
      );
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('[auth/callback] No access_token in Shopify response:', tokenData);
      return NextResponse.json(
        { error: 'Shopify did not return an access token' },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('[auth/callback] Token exchange error:', err);
    return NextResponse.json(
      { error: 'Network error during token exchange' },
      { status: 502 }
    );
  }

  // ── 5. Upsert store record in Prisma ──
  // Store requires a Merchant parent. Find-or-create a Merchant
  // keyed on the shop domain (one merchant per store for now).
  try {
    const shopName = shop.replace('.myshopify.com', '');

    // Check if a store already exists for this domain
    const existingStore = await db.store.findUnique({
      where: { shopifyDomain: shop },
    });

    if (existingStore) {
      // Re-install: update token and clear uninstalledAt
      await db.store.update({
        where: { shopifyDomain: shop },
        data: {
          shopifyAccessToken: accessToken,
          uninstalledAt: null,
          installedAt: new Date(),
        },
      });
    } else {
      // First install: create Merchant + Store
      const merchant = await db.merchant.create({
        data: {
          name: shopName,
        },
      });

      await db.store.create({
        data: {
          merchantId: merchant.id,
          shopifyDomain: shop,
          shopifyAccessToken: accessToken,
          currency: 'AUD',
          timezone: 'Australia/Sydney',
        },
      });
    }

    console.log(`[auth/callback] Store upserted for shop=${shop}`);
  } catch (err) {
    console.error('[auth/callback] Database upsert failed:', err);
    return NextResponse.json(
      { error: 'Failed to save store credentials' },
      { status: 500 }
    );
  }

  // ── 6. Clear state cookie and redirect to admin ──
  const appUrl = process.env.SHOPIFY_APP_URL ?? '';
  const redirectUrl = `${appUrl}/product-families?shop=${encodeURIComponent(shop)}`;

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set('shopify_oauth_state', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0, // delete the cookie
  });

  return response;
}

// ──────────────────────────────────────────────
// HMAC validation for OAuth callback
// ──────────────────────────────────────────────

function verifyCallbackHmac(
  searchParams: URLSearchParams,
  receivedHmac: string,
  secret: string
): boolean {
  // Build the message from all query params except hmac, sorted alphabetically
  const params = new URLSearchParams();

  for (const [key, value] of searchParams.entries()) {
    if (key !== 'hmac') {
      params.set(key, value);
    }
  }

  // Sort by key
  const sortedParams = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  );

  const message = sortedParams.toString();
  const computedHmac = createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // Timing-safe comparison using Node built-in
  try {
    const a = Buffer.from(computedHmac, 'hex');
    const b = Buffer.from(receivedHmac, 'hex');

    if (a.length !== b.length || a.length === 0) {
      return false;
    }

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
