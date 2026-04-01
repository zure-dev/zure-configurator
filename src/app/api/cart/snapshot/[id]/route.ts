import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

// GET /api/cart/snapshot/[id]
// Retrieve a persisted configuration snapshot by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const snapshot = await db.configurationSnapshot.findUnique({
      where: { id: params.id },
      include: {
        session: {
          select: { storeId: true, productFamilyId: true, shopifyProductId: true },
        },
        cartResolution: {
          select: {
            id: true,
            shopifyVariantId: true,
            lineItemProperties: true,
            resolvedPrice: true,
            createdAt: true,
          },
        },
      },
    });

    if (!snapshot || snapshot.session.storeId !== tenant.storeId) {
      return tenantError('Snapshot not found', 404);
    }

    return tenantResponse({
      snapshot: {
        id: snapshot.id,
        productFamilyId: snapshot.productFamilyId,
        selections: snapshot.selections,
        pricingBreakdown: snapshot.pricingBreakdown,
        summaryText: snapshot.summaryText,
        summaryStructured: snapshot.summaryStructured,
        validationSignature: snapshot.validationSignature,
        createdAt: snapshot.createdAt,
        cartResolution: snapshot.cartResolution,
      },
    });
  } catch (error) {
    console.error('[cart/snapshot/[id]]', error);
    return tenantError('Failed to fetch snapshot', 500);
  }
}
