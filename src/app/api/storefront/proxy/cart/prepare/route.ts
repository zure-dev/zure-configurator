import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveConfiguration, ResolverError } from '@/services/configuration-resolver';

export const dynamic = 'force-dynamic';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shop = body.shop || request.nextUrl.searchParams.get('shop') || '';
    const { productFamilyId, variantProfileId, selections } = body;

    if (!shop) return Response.json({ error: 'MISSING_SHOP', message: 'shop is required' }, { headers: corsHeaders() });
    if (!productFamilyId) return Response.json({ error: 'MISSING_FAMILY', message: 'productFamilyId is required' }, { headers: corsHeaders() });
    if (!selections || typeof selections !== 'object') return Response.json({ error: 'MISSING_SELECTIONS', message: 'selections is required' }, { headers: corsHeaders() });

    const store = await db.store.findUnique({ where: { shopifyDomain: shop }, select: { id: true } });
    if (!store) return Response.json({ error: 'STORE_NOT_FOUND', message: `No store for "${shop}"` }, { headers: corsHeaders() });

    const result = await resolveConfiguration({ productFamilyId, storeId: store.id, variantProfileId: variantProfileId ?? null, selections });

    if (result.lineItems.length === 0) {
      return Response.json({ error: 'NO_LINE_ITEMS', message: 'No line items resolved. Check product mappings.', warnings: result.warnings }, { headers: corsHeaders() });
    }

    const shopifyItems = result.lineItems.map((item) => ({
      id: parseInt(item.shopifyVariantId, 10) || item.shopifyVariantId,
      quantity: item.quantity,
      properties: item.properties,
    }));

    return Response.json({ lineItems: result.lineItems, shopifyItems, totalPrice: result.totalPrice, configurationSummary: result.configurationSummary, familyName: result.familyName, profileName: result.profileName, warnings: result.warnings }, { headers: corsHeaders() });
  } catch (error: unknown) {
    if (error instanceof ResolverError) return Response.json({ error: error.code, message: error.message }, { headers: corsHeaders() });
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[proxy/cart/prepare]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to prepare cart' }, { headers: corsHeaders() });
  }
}
