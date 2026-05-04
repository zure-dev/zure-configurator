import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyWebhookHmac, webhookResponse } from '@/lib/webhooks';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { valid, shop, body } = await verifyWebhookHmac(request);

  if (!valid) {
    console.error('[webhook/orders-create] Invalid HMAC');
    return webhookResponse(401);
  }

  try {
    const order = JSON.parse(body);
    const orderId = String(order.id);
    const orderName = order.name ?? `#${order.order_number}`;

    // Find line items with _configuration_id property
    const lineItems = order.line_items ?? [];

    for (const lineItem of lineItems) {
      const properties = lineItem.properties ?? [];
      const configProp = properties.find(
        (p: { name: string }) => p.name === '_configuration_id'
      );

      if (!configProp) continue;

      const snapshotId = configProp.value;

      // Find the cart resolution record for this snapshot
      const cartResolution = await db.cartResolutionRecord.findFirst({
        where: { snapshotId },
        include: { snapshot: true },
      });

      if (!cartResolution) {
        console.warn(
          `[webhook/orders-create] No cart resolution found for snapshot ${snapshotId}`
        );
        continue;
      }

      // Create or update the order resolution record
      const existingOrder = await db.orderResolutionRecord.findUnique({
        where: { cartResolutionId: cartResolution.id },
      });

      if (existingOrder) {
        await db.orderResolutionRecord.update({
          where: { id: existingOrder.id },
          data: {
            shopifyOrderId: orderId,
            shopifyOrderName: orderName,
            shopifyLineItemId: String(lineItem.id),
          },
        });
      } else {
        await db.orderResolutionRecord.create({
          data: {
            cartResolutionId: cartResolution.id,
            shopifyOrderId: orderId,
            shopifyOrderName: orderName,
            shopifyLineItemId: String(lineItem.id),
            componentSkus: cartResolution.snapshot.componentMappings as Prisma.InputJsonValue,
          },
        });
      }

      console.log(
        `[webhook/orders-create] Linked order ${orderName} to snapshot ${snapshotId}`
      );
    }

    return webhookResponse(200);
  } catch (error) {
    console.error('[webhook/orders-create]', error);
    // Return 200 to prevent Shopify retries for parse errors
    return webhookResponse(200);
  }
}
