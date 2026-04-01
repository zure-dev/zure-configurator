import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { prepareCart } from '@/services/cart.service';

// POST /api/cart/resolve
//
// Body: {
//   productFamilyId: string,
//   selections: { "vanity-size": "900mm", "stone-top": "calacatta-quartz", ... }
// }
//
// Returns:
//   success: true → snapshotId, shopify payload, pricing breakdown, summary
//   success: false → errors array explaining what's wrong
//
// This is the final server-side validation + persistence step.
// Call this when the customer clicks "Add to Cart".
// The frontend should then use the returned shopify.properties
// to call Shopify's Cart API (/cart/add.js).

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, selections } = body;

    if (!productFamilyId || !selections || typeof selections !== 'object') {
      return tenantError('productFamilyId and selections object are required');
    }

    const result = await prepareCart(tenant.storeId, {
      productFamilyId,
      selections,
    });

    if (!result.success) {
      return tenantResponse(result, 422);
    }

    return tenantResponse(result, 201);
  } catch (error) {
    console.error('[cart/resolve]', error);
    return tenantError('Failed to resolve cart', 500);
  }
}
