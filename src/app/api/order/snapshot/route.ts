import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/order/snapshot?snapshotId=xxx or ?orderId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const snapshotId = request.nextUrl.searchParams.get('snapshotId');
    const orderId = request.nextUrl.searchParams.get('orderId');

    if (!snapshotId && !orderId) {
      return tenantError('snapshotId or orderId is required');
    }

    if (snapshotId) {
      const snapshot = await db.configurationSnapshot.findUnique({
        where: { id: snapshotId },
        include: {
          session: { select: { storeId: true } },
          cartResolution: {
            include: { orderResolution: true },
          },
        },
      });

      if (!snapshot || snapshot.session.storeId !== tenant.storeId) {
        return tenantError('Snapshot not found', 404);
      }

      return tenantResponse({ snapshot });
    }

    // Lookup by Shopify order ID
    const orderResolution = await db.orderResolutionRecord.findFirst({
      where: { shopifyOrderId: orderId! },
      include: {
        cartResolution: {
          include: {
            snapshot: {
              include: { session: { select: { storeId: true } } },
            },
          },
        },
      },
    });

    if (!orderResolution || orderResolution.cartResolution.snapshot.session.storeId !== tenant.storeId) {
      return tenantError('Order resolution not found', 404);
    }

    return tenantResponse({
      orderResolution,
      snapshot: orderResolution.cartResolution.snapshot,
    });
  } catch (error) {
    console.error('[order/snapshot]', error);
    return tenantError('Failed to fetch order snapshot', 500);
  }
}
