import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/stats
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const [
      totalFamilies,
      activeFamilies,
      draftFamilies,
      linkedFamilies,
      totalGroups,
      totalValues,
      totalMappings,
      totalProfiles,
    ] = await Promise.all([
      db.productFamily.count({ where: { storeId: tenant.storeId } }),
      db.productFamily.count({ where: { storeId: tenant.storeId, status: 'ACTIVE' } }),
      db.productFamily.count({ where: { storeId: tenant.storeId, status: 'DRAFT' } }),
      db.productFamily.count({ where: { storeId: tenant.storeId, shopifyProductId: { not: null } } }),
      db.optionGroup.count({ where: { productFamily: { storeId: tenant.storeId } } }),
      db.optionValue.count({ where: { optionGroup: { productFamily: { storeId: tenant.storeId } } } }),
      db.optionValueProductMapping.count({ where: { optionValue: { optionGroup: { productFamily: { storeId: tenant.storeId } } } } }),
      db.productFamilyVariantProfile.count({ where: { productFamily: { storeId: tenant.storeId } } }),
    ]);

    // Get top families by option group count
    const topFamilies = await db.productFamily.findMany({
      where: { storeId: tenant.storeId, status: 'ACTIVE' },
      select: {
        id: true, name: true, handle: true, status: true,
        _count: { select: { optionGroups: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return tenantResponse({
      stats: {
        totalFamilies, activeFamilies, draftFamilies, linkedFamilies,
        totalGroups, totalValues, totalMappings, totalProfiles,
      },
      recentFamilies: topFamilies,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[dashboard/stats]', message, error);
    return tenantError('Failed to load dashboard stats', 500);
  }
}
