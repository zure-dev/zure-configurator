import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/option-values/[id]/product-mappings
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    // Verify value belongs to this store
    const value = await db.optionValue.findUnique({
      where: { id: params.id },
      include: {
        optionGroup: {
          include: { productFamily: { select: { storeId: true } } },
        },
      },
    });

    if (!value || value.optionGroup.productFamily.storeId !== tenant.storeId) {
      return tenantError('Option value not found', 404);
    }

    const mappings = await db.optionValueProductMapping.findMany({
      where: { optionValueId: params.id },
      orderBy: { sortOrder: 'asc' },
    });

    return tenantResponse({ productMappings: mappings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[option-values/[id]/product-mappings/GET]', message, error);
    return tenantError(`Failed to fetch product mappings: ${message}`, 500);
  }
}

// ──────────────────────────────────────────────
// POST /api/option-values/[id]/product-mappings
// Body: { shopifyProductId, shopifyVariantId?, shopifyProductTitle?,
//         shopifyVariantTitle?, shopifySku?, shopifyImageUrl?,
//         shopifyPrice?, quantity?, sortOrder?, role? }
// Also accepts array: { mappings: [...] } for bulk add.
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const value = await db.optionValue.findUnique({
      where: { id: params.id },
      include: {
        optionGroup: {
          include: { productFamily: { select: { storeId: true } } },
        },
      },
    });

    if (!value || value.optionGroup.productFamily.storeId !== tenant.storeId) {
      return tenantError('Option value not found', 404);
    }

    const body = await request.json();

    // Support single or bulk
    const items: any[] = Array.isArray(body.mappings) ? body.mappings : [body];

    // Get next sort order
    const maxSort = await db.optionValueProductMapping.findFirst({
      where: { optionValueId: params.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    let nextSort = (maxSort?.sortOrder ?? -1) + 1;

    const created = [];
    for (const item of items) {
      if (!item.shopifyProductId) continue;

      const mapping = await db.optionValueProductMapping.create({
        data: {
          optionValueId: params.id,
          shopifyProductId: item.shopifyProductId,
          shopifyVariantId: item.shopifyVariantId ?? null,
          shopifyProductTitle: item.shopifyProductTitle ?? null,
          shopifyVariantTitle: item.shopifyVariantTitle ?? null,
          shopifySku: item.shopifySku ?? null,
          shopifyImageUrl: item.shopifyImageUrl ?? null,
          shopifyPrice: item.shopifyPrice != null ? parseFloat(item.shopifyPrice) : null,
          quantity: item.quantity ?? 1,
          sortOrder: item.sortOrder ?? nextSort,
          role: item.role ?? null,
        },
      });
      created.push(mapping);
      nextSort++;
    }

    return tenantResponse({ productMappings: created }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[option-values/[id]/product-mappings/POST]', message, error);
    return tenantError(`Failed to create product mapping: ${message}`, 500);
  }
}
