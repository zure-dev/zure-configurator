import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function verifyProfile(storeId: string, profileId: string) {
  const profile = await db.productFamilyVariantProfile.findUnique({
    where: { id: profileId },
    include: { productFamily: { select: { storeId: true } } },
  });
  if (!profile) return null;
  if (profile.productFamily.storeId !== storeId) return null;
  return profile;
}

// GET /api/variant-profiles/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const profile = await verifyProfile(tenant.storeId, params.id);
    if (!profile) return tenantError('Variant profile not found', 404);

    return tenantResponse({ variantProfile: profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return tenantError(`Failed to fetch variant profile: ${message}`, 500);
  }
}

// PUT /api/variant-profiles/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const existing = await verifyProfile(tenant.storeId, params.id);
    if (!existing) return tenantError('Variant profile not found', 404);

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;

    const updated = await db.productFamilyVariantProfile.update({
      where: { id: params.id },
      data: updateData,
    });

    return tenantResponse({ variantProfile: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return tenantError(`Failed to update variant profile: ${message}`, 500);
  }
}

// DELETE /api/variant-profiles/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const existing = await verifyProfile(tenant.storeId, params.id);
    if (!existing) return tenantError('Variant profile not found', 404);

    // Unlink option groups (set variantProfileId to null, don't delete them)
    await db.optionGroup.updateMany({
      where: { variantProfileId: params.id },
      data: { variantProfileId: null },
    });

    await db.productFamilyVariantProfile.delete({ where: { id: params.id } });

    return tenantResponse({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return tenantError(`Failed to delete variant profile: ${message}`, 500);
  }
}
