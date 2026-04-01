import { NextRequest } from 'next/server';
import { verifyWebhookHmac, webhookResponse } from '@/lib/webhooks';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { valid, shop, body } = await verifyWebhookHmac(request);

  if (!valid) {
    console.error('[webhook/products-update] Invalid HMAC');
    return webhookResponse(401);
  }

  try {
    const product = JSON.parse(body);
    const productId = `gid://shopify/Product/${product.id}`;

    // Find any product family links to this product
    const link = await db.productFamilyShopifyLink.findFirst({
      where: { shopifyProductId: productId },
      include: { productFamily: { select: { storeId: true, id: true } } },
    });

    if (!link) {
      // Also check numeric ID
      const numericLink = await db.productFamilyShopifyLink.findFirst({
        where: { shopifyProductNumericId: String(product.id) },
      });
      if (!numericLink) return webhookResponse(200);
    }

    // Update the product handle and variant info if changed
    const firstVariant = product.variants?.[0];

    if (link) {
      await db.productFamilyShopifyLink.update({
        where: { id: link.id },
        data: {
          shopifyProductHandle: product.handle,
          shopifyVariantNumericId: firstVariant ? String(firstVariant.id) : undefined,
          syncedAt: new Date(),
        },
      });

      console.log(
        `[webhook/products-update] Updated link for family ${link.productFamily.id}: ${product.handle}`
      );
    }

    return webhookResponse(200);
  } catch (error) {
    console.error('[webhook/products-update]', error);
    return webhookResponse(200);
  }
}
