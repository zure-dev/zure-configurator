import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? '';

/**
 * Verify that a webhook request actually came from Shopify.
 * Uses HMAC-SHA256 with timing-safe comparison.
 */
export async function verifyWebhookHmac(
  request: NextRequest
): Promise<{ valid: boolean; topic: string; shop: string; body: string }> {
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic') ?? '';
  const shop = request.headers.get('x-shopify-shop-domain') ?? '';

  if (!hmacHeader) {
    return { valid: false, topic, shop, body: '' };
  }

  const body = await request.text();
  const calculatedHmac = createHmac('sha256', SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  const hmacBuffer = Buffer.from(hmacHeader, 'base64');
  const calculatedBuffer = Buffer.from(calculatedHmac, 'base64');

  if (hmacBuffer.length !== calculatedBuffer.length) {
    return { valid: false, topic, shop, body };
  }

  const valid = timingSafeEqual(hmacBuffer, calculatedBuffer);

  return { valid, topic, shop, body };
}

/**
 * Standard webhook response helper
 */
export function webhookResponse(status: number = 200) {
  return new Response(null, { status });
}
