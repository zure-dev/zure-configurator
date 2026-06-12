import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Verify mapping belongs to this store
async function verifyMapping(storeId: string, mappingId: string) {
  const mapping = await db.optionValueProductMapping.findUnique({
    where: { id: mappingId },
    include: {
      optionValue: {
        include: {
          optionGroup: {
            include: { productFamily: { select: { storeId: true } } },
          },
        },
      },
    },
  });

  if (!mapping) return null;
  if (mapping.optionValue.optionGroup.productFamily.storeId !== storeId) return null;
  return mapping;
}

// ──────────────────────────────────────────────
// PUT /api/option-value-product-mappings/[id]
// Body: { quantity?, sortOrder?, role?, shopifyPrice? }
// ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const existing = await verifyMapping(tenant.storeId, params.id);
    if (!existing) return tenantError('Product mapping not found', 404);

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.shopifyPrice !== undefined) {
      updateData.shopifyPrice = body.shopifyPrice != null ? parseFloat(body.shopifyPrice) : null;
    }

    const updated = await db.optionValueProductMapping.update({
      where: { id: params.id },
      data: updateData,
    });

    return tenantResponse({ productMapping: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[option-value-product-mappings/[id]/PUT]', message, error);
    return tenantError(`Failed to update mapping: ${message}`, 500);
  }
}

// ──────────────────────────────────────────────
// DELETE /api/option-value-product-mappings/[id]
// ──────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const existing = await verifyMapping(tenant.storeId, params.id);
    if (!existing) return tenantError('Product mapping not found', 404);

    await db.optionValueProductMapping.delete({ where: { id: params.id } });

    return tenantResponse({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[option-value-product-mappings/[id]/DELETE]', message, error);
    return tenantError(`Failed to delete mapping: ${message}`, 500);
  }
}
