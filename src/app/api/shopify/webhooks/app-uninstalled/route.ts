import { NextRequest } from 'next/server';
import { verifyWebhookHmac, webhookResponse } from '@/lib/webhooks';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { valid, shop } = await verifyWebhookHmac(request);

  if (!valid) {
    return webhookResponse(401);
  }

  try {
    // Mark store as uninstalled (soft delete — preserve data for re-install)
    await db.store.updateMany({
      where: { shopifyDomain: shop },
      data: {
        uninstalledAt: new Date(),
        shopifyAccessToken: '', // clear token
      },
    });

    console.log(`[webhook/app-uninstalled] Store ${shop} uninstalled`);
    return webhookResponse(200);
  } catch (error) {
    console.error('[webhook/app-uninstalled]', error);
    return webhookResponse(200);
  }
}
