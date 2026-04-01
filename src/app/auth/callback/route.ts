import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, isValidShopDomain } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate params
  if (!shop || !code || !state) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  // TODO: Validate state/nonce against stored session value

  try {
    // Exchange code for access token
    const tokenResult = await exchangeCodeForToken(shop, code);
    if (!tokenResult) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    // Upsert merchant and store
    const existingStore = await db.store.findUnique({
      where: { shopifyDomain: shop },
    });

    if (existingStore) {
      // Re-install — update token and clear uninstalled flag
      await db.store.update({
        where: { id: existingStore.id },
        data: {
          shopifyAccessToken: tokenResult.access_token,
          uninstalledAt: null,
          installedAt: new Date(),
        },
      });
    } else {
      // New install — create merchant + store
      const merchant = await db.merchant.create({
        data: {
          name: shop.replace('.myshopify.com', ''),
          stores: {
            create: {
              shopifyDomain: shop,
              shopifyAccessToken: tokenResult.access_token,
              currency: 'AUD',
            },
          },
        },
      });
    }

    // Redirect to the app within Shopify admin
    const appUrl = process.env.SHOPIFY_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY ?? ''}`
    );
  } catch (error) {
    console.error('[auth/callback]', error);
    return NextResponse.json({ error: 'Installation failed' }, { status: 500 });
  }
}
