import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveConfiguration, ResolverError } from '@/services/configuration-resolver';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shop = body.shop || request.nextUrl.searchParams.get('shop') || '';
    const { productFamilyId, variantProfileId, selections } = body;

    if (!shop) return Response.json({ error: 'MISSING_SHOP', message: 'shop is required' });
    if (!productFamilyId) return Response.json({ error: 'MISSING_FAMILY', message: 'productFamilyId is required' });
    if (!selections || typeof selections !== 'object') return Response.json({ error: 'MISSING_SELECTIONS', message: 'selections is required' });

    const store = await db.store.findUnique({ where: { shopifyDomain: shop }, select: { id: true } });
    if (!store) return Response.json({ error: 'STORE_NOT_FOUND', message: `No store for "${shop}"` });

    const result = await resolveConfiguration({ productFamilyId, storeId: store.id, variantProfileId: variantProfileId ?? null, selections });

    if (result.lineItems.length === 0) {
      return Response.json({ error: 'NO_LINE_ITEMS', message: 'No line items resolved. Check product mappings.', warnings: result.warnings });
    }

    const shopifyItems = result.lineItems.map((item) => ({
      id: parseInt(item.shopifyVariantId, 10) || item.shopifyVariantId,
      quantity: item.quantity,
      properties: item.properties,
    }));

    return Response.json({ lineItems: result.lineItems, shopifyItems, totalPrice: result.totalPrice, configurationSummary: result.configurationSummary, familyName: result.familyName, profileName: result.profileName, warnings: result.warnings });
  } catch (error: unknown) {
    if (error instanceof ResolverError) return Response.json({ error: error.code, message: error.message });
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[proxy/cart/prepare]', message, error);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Failed to prepare cart' });
  }
}
