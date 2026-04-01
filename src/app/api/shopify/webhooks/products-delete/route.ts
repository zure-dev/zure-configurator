import { NextRequest } from 'next/server';
import { verifyWebhookHmac, webhookResponse } from '@/lib/webhooks';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { valid, shop, body } = await verifyWebhookHmac(request);

  if (!valid) {
    console.error('[webhook/products-delete] Invalid HMAC');
    return webhookResponse(401);
  }

  try {
    const product = JSON.parse(body);
    const productId = `gid://shopify/Product/${product.id}`;

    // Find and remove the Shopify link (don't delete the family itself)
    const link = await db.productFamilyShopifyLink.findFirst({
      where: {
        OR: [
          { shopifyProductId: productId },
          { shopifyProductNumericId: String(product.id) },
        ],
      },
    });

    if (link) {
      await db.productFamilyShopifyLink.delete({ where: { id: link.id } });
      console.log(
        `[webhook/products-delete] Removed Shopify link for family ${link.productFamilyId}`
      );
    }

    return webhookResponse(200);
  } catch (error) {
    console.error('[webhook/products-delete]', error);
    return webhookResponse(200);
  }
}
