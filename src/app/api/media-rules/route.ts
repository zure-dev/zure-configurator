import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET /api/media-rules?familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const familyId = request.nextUrl.searchParams.get('familyId');
    if (!familyId) return tenantError('familyId is required');

    const rules = await db.mediaRule.findMany({
      where: { productFamilyId: familyId },
      orderBy: { priority: 'asc' },
    });

    return tenantResponse({ rules });
  } catch (error) {
    console.error('[media-rules/GET]', error);
    return tenantError('Failed to fetch media rules', 500);
  }
}

// POST /api/media-rules
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { productFamilyId, name, priority, conditions, mediaSet } = body;

    if (!productFamilyId || !conditions?.length || !mediaSet?.length) {
      return tenantError('productFamilyId, conditions, and mediaSet are required');
    }

    const family = await db.productFamily.findFirst({
      where: { id: productFamilyId, storeId: tenant.storeId },
    });
    if (!family) return tenantError('Product family not found', 404);

    const rule = await db.mediaRule.create({
      data: {
        productFamilyId,
        name,
        priority: priority ?? 0,
        conditions,
        mediaSet,
      },
    });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'CREATE',
      entityType: 'MediaRule',
      entityId: rule.id,
      after: rule,
    });

    return tenantResponse({ rule }, 201);
  } catch (error) {
    console.error('[media-rules/POST]', error);
    return tenantError('Failed to create media rule', 500);
  }
}

// PUT /api/media-rules — update a single media rule
export async function PUT(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const body = await request.json();
    const { id, name, priority, conditions, mediaSet, isActive } = body;

    if (!id) return tenantError('id is required');

    const existing = await db.mediaRule.findUnique({
      where: { id },
      include: { productFamily: { select: { storeId: true } } },
    });

    if (!existing || existing.productFamily.storeId !== tenant.storeId) {
      return tenantError('Media rule not found', 404);
    }

    const rule = await db.mediaRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(priority !== undefined && { priority }),
        ...(conditions && { conditions }),
        ...(mediaSet && { mediaSet }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'UPDATE',
      entityType: 'MediaRule',
      entityId: id,
      before: existing,
      after: rule,
    });

    return tenantResponse({ rule });
  } catch (error) {
    console.error('[media-rules/PUT]', error);
    return tenantError('Failed to update media rule', 500);
  }
}

// DELETE /api/media-rules?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return tenantError('id is required');

    const existing = await db.mediaRule.findUnique({
      where: { id },
      include: { productFamily: { select: { storeId: true } } },
    });

    if (!existing || existing.productFamily.storeId !== tenant.storeId) {
      return tenantError('Media rule not found', 404);
    }

    await db.mediaRule.delete({ where: { id } });

    await createAuditLog({
      storeId: tenant.storeId,
      action: 'DELETE',
      entityType: 'MediaRule',
      entityId: id,
      before: existing,
    });

    return tenantResponse({ deleted: true });
  } catch (error) {
    console.error('[media-rules/DELETE]', error);
    return tenantError('Failed to delete media rule', 500);
  }
}
