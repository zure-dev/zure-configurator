import { NextRequest, NextResponse } from 'next/server';

// ──────────────────────────────────────────────
// Middleware: ensure shop context on all admin pages
//
// Runs BEFORE any page renders. Guarantees that ?shop=
// is in the URL so the frontend api-client always has it.
//
// Flow:
//   1. ?shop= in URL → pass through (Shopify provides this)
//   2. No ?shop= but cookie exists → redirect to add ?shop= to URL
//   3. Neither → redirect to Shopify OAuth
// ──────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip non-admin paths (API routes, storefront, static, auth itself)
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/api/auth' ||
    pathname === '/api/auth/callback'
  ) {
    return NextResponse.next();
  }

  // 1. If ?shop= is already in URL, pass through
  const shopFromUrl = searchParams.get('shop');
  if (shopFromUrl && shopFromUrl.endsWith('.myshopify.com')) {
    // Also set/refresh the cookie for future requests
    const response = NextResponse.next();
    response.cookies.set('shopify_shop', shopFromUrl, {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  // 2. No ?shop= in URL — check cookie
  const shopFromCookie = request.cookies.get('shopify_shop')?.value;

  if (shopFromCookie && shopFromCookie.endsWith('.myshopify.com')) {
    // Redirect to same page with ?shop= added
    const url = request.nextUrl.clone();
    url.searchParams.set('shop', shopFromCookie);
    return NextResponse.redirect(url);
  }

  // 3. No shop context at all — check Shopify host param
  // Shopify sometimes passes ?host= which encodes the shop domain
  const hostParam = searchParams.get('host');
  if (hostParam) {
    try {
      const decoded = Buffer.from(hostParam, 'base64').toString('utf-8');
      // decoded format: "admin.shopify.com/store/shop-name"
      const match = decoded.match(/\/store\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        const shop = `${match[1]}.myshopify.com`;
        const url = request.nextUrl.clone();
        url.searchParams.set('shop', shop);
        return NextResponse.redirect(url);
      }
    } catch {
      // Invalid base64, fall through
    }
  }

  // 4. Dev fallback
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_STORE_DOMAIN) {
    const url = request.nextUrl.clone();
    url.searchParams.set('shop', process.env.DEV_STORE_DOMAIN);
    return NextResponse.redirect(url);
  }

  // 5. No shop context available — show helpful error page
  // Return a simple HTML response instead of a JSON error
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Zure Configurator</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
  <div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px;">
    <h2 style="margin:0 0 12px;color:#1a1a2e;">Session Expired</h2>
    <p style="color:#666;margin:0 0 20px;line-height:1.5;">Please open this app from your Shopify admin:<br><strong>Apps → Zure Configurator</strong></p>
    <a href="https://admin.shopify.com" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Go to Shopify Admin</a>
  </div>
</body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

// Only run on admin page routes, not API or static
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
