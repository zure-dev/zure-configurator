import { NextRequest } from 'next/server';
import { getTenantFromStorefront, tenantResponse, tenantError } from '@/lib/tenant';
import { prepareCartResolution } from '@/services/configuration.service';

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromStorefront(request);
    if (!tenant) return tenantError('Store not found', 401);

    const body = await request.json();
    const { sessionId, selections, customerContext } = body;

    if (!sessionId || !selections) {
      return tenantError('sessionId and selections are required');
    }

    const resolution = await prepareCartResolution({
      sessionId,
      selections,
      customerContext: customerContext ?? { isTradeCustomer: false },
    });

    if (!resolution.success) {
      return tenantResponse({
        success: false,
        errors: resolution.errors,
        message: 'Configuration is invalid. Please review your selections.',
      }, 422);
    }

    return tenantResponse({
      success: true,
      snapshotId: resolution.snapshotId,
      cartPayload: resolution.cartPayload,
      resolvedPrice: resolution.result?.pricing.totalPrice,
      summary: resolution.result?.summary.humanReadable,
    });
  } catch (error) {
    console.error('[cart/prepare]', error);
    return tenantError('Failed to prepare cart resolution', 500);
  }
}
