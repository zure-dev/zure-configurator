import { NextRequest } from 'next/server';
import { getTenantFromStorefront, tenantResponse, tenantError } from '@/lib/tenant';
import { evaluateSessionConfiguration } from '@/services/configuration.service';

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromStorefront(request);
    if (!tenant) return tenantError('Store not found', 401);

    const body = await request.json();
    const { sessionId, selections, customerContext } = body;

    if (!sessionId || !selections) {
      return tenantError('sessionId and selections are required');
    }

    const result = await evaluateSessionConfiguration({
      sessionId,
      selections,
      customerContext: customerContext ?? { isTradeCustomer: false },
    });

    return tenantResponse(result);
  } catch (error) {
    console.error('[configure/validate]', error);
    return tenantError('Failed to validate configuration', 500);
  }
}
