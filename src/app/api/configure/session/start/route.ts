import { NextRequest } from 'next/server';
import { getTenantFromStorefront, tenantResponse, tenantError } from '@/lib/tenant';
import {
  startConfigurationSession,
  resolveProductFamilyByShopifyId,
} from '@/services/configuration.service';

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromStorefront(request);
    if (!tenant) return tenantError('Store not found', 401);

    const body = await request.json();
    const { shopifyProductId, customerIdent, isTradeCustomer } = body;

    if (!shopifyProductId) {
      return tenantError('shopifyProductId is required');
    }

    // Resolve product family from Shopify product ID
    const productFamilyId = await resolveProductFamilyByShopifyId(
      tenant.storeId,
      shopifyProductId
    );
    if (!productFamilyId) {
      return tenantError('No configurator found for this product', 404);
    }

    const { session, definition, defaults, initialResult } =
      await startConfigurationSession({
        storeId: tenant.storeId,
        productFamilyId,
        shopifyProductId,
        customerIdent,
        isTradeCustomer,
      });

    return tenantResponse({
      sessionId: session.id,
      productFamily: {
        id: definition.id,
        name: definition.name,
        basePrice: definition.basePrice,
        optionGroups: definition.optionGroups,
      },
      defaults,
      initialEvaluation: initialResult,
    });
  } catch (error) {
    console.error('[configure/session/start]', error);
    return tenantError('Failed to start configuration session', 500);
  }
}
