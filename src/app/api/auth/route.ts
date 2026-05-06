import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/auth?shop=xxx.myshopify.com
// Starts the Shopify OAuth install flow.
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get('shop');

  // ── 1. Validate shop parameter ──
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return NextResponse.json(
      { error: 'Missing or invalid shop parameter. Must end with .myshopify.com' },
      { status: 400 }
    );
  }

  // Sanitise: only allow alphanumeric + hyphens before .myshopify.com
  const shopName = shop.replace('.myshopify.com', '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(shopName)) {
    return NextResponse.json(
      { error: 'Invalid shop domain format' },
      { status: 400 }
    );
  }

  // ── 2. Read env ──
  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES;
  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!apiKey || !scopes || !appUrl) {
    console.error('[auth] Missing env: SHOPIFY_API_KEY, SHOPIFY_SCOPES, or SHOPIFY_APP_URL');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  // ── 3. Generate state nonce ──
  const state = randomBytes(16).toString('hex');

  // ── 4. Build Shopify OAuth URL ──
  const redirectUri = `${appUrl}/api/auth/callback`;
  const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  installUrl.searchParams.set('client_id', apiKey);
  installUrl.searchParams.set('scope', scopes);
  installUrl.searchParams.set('redirect_uri', redirectUri);
  installUrl.searchParams.set('state', state);

  // ── 5. Set state cookie + redirect ──
  const response = NextResponse.redirect(installUrl.toString());

  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 600, // 10 minutes
  });

  console.log(`[auth] Starting OAuth for shop=${shop}, redirecting to Shopify`);

  return response;
}
