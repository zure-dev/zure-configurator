import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/product-families/[id]/variant-profiles
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const family = await db.productFamily.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
      select: { id: true },
    });
    if (!family) return tenantError('Product family not found', 404);

    const profiles = await db.productFamilyVariantProfile.findMany({
      where: { productFamilyId: params.id },
      orderBy: { sortOrder: 'asc' },
    });

    return tenantResponse({ variantProfiles: profiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[variant-profiles/GET]', message, error);
    return tenantError(`Failed to fetch variant profiles: ${message}`, 500);
  }
}

// ──────────────────────────────────────────────
// POST /api/product-families/[id]/variant-profiles
// Body: { name, slug?, shopifyVariantId?, shopifyVariantTitle?,
//         shopifySku?, imageUrl?, sortOrder?, isDefault? }
// OR: { action: "import-from-shopify" } to auto-import all variants
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const family = await db.productFamily.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
      select: { id: true, shopifyProductId: true },
    });
    if (!family) return tenantError('Product family not found', 404);

    const body = await request.json();

    // ── Import from Shopify ──
    if (body.action === 'import-from-shopify') {
      if (!family.shopifyProductId) {
        return tenantError('Product family is not linked to a Shopify product', 400);
      }

      const store = await db.store.findUnique({
        where: { id: tenant.storeId },
        select: { shopifyDomain: true, shopifyAccessToken: true },
      });
      if (!store || !store.shopifyAccessToken) {
        return tenantError('Store not connected to Shopify', 400);
      }

      // Fetch variants from Shopify
      const gql = `
        query GetProductVariants($id: ID!) {
          product(id: $id) {
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  image { url }
                }
              }
            }
          }
        }
      `;

      // Normalize the product ID to GID format
      let productGid = family.shopifyProductId;
      if (/^\d+$/.test(productGid)) {
        productGid = `gid://shopify/Product/${productGid}`;
      }

      const shopifyRes = await fetch(
        `https://${store.shopifyDomain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': store.shopifyAccessToken,
          },
          body: JSON.stringify({ query: gql, variables: { id: productGid } }),
        }
      );

      if (!shopifyRes.ok) {
        return tenantError('Failed to fetch variants from Shopify', 502);
      }

      const shopifyData = await shopifyRes.json();
      const variantEdges = shopifyData.data?.product?.variants?.edges ?? [];

      // Get existing profiles to avoid duplicates
      const existing = await db.productFamilyVariantProfile.findMany({
        where: { productFamilyId: params.id },
        select: { shopifyVariantId: true },
      });
      const existingIds = new Set(existing.map((p: { shopifyVariantId: string | null }) => p.shopifyVariantId));

      let sortOrder = existing.length;
      const created = [];

      for (const edge of variantEdges) {
        const node = edge.node;
        if (existingIds.has(node.id)) continue; // Skip already imported

        const slug = (node.title as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        // Check slug collision
        let finalSlug = slug;
        let suffix = 0;
        while (true) {
          const conflict = await db.productFamilyVariantProfile.findFirst({
            where: { productFamilyId: params.id, slug: finalSlug },
            select: { id: true },
          });
          if (!conflict) break;
          suffix++;
          finalSlug = `${slug}-${suffix}`;
        }

        const profile = await db.productFamilyVariantProfile.create({
          data: {
            productFamilyId: params.id,
            name: node.title,
            slug: finalSlug,
            shopifyVariantId: node.id,
            shopifyVariantTitle: node.title,
            shopifySku: node.sku ?? null,
            imageUrl: node.image?.url ?? null,
            sortOrder,
            isDefault: sortOrder === 0,
            isActive: true,
          },
        });
        created.push(profile);
        sortOrder++;
      }

      return tenantResponse({
        imported: created.length,
        variantProfiles: created,
        message: `Imported ${created.length} variant profile${created.length !== 1 ? 's' : ''} from Shopify`,
      }, 201);
    }

    // ── Manual create ──
    if (!body.name) return tenantError('name is required', 400);

    const slug = (body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).trim();

    const slugConflict = await db.productFamilyVariantProfile.findFirst({
      where: { productFamilyId: params.id, slug },
      select: { id: true },
    });
    if (slugConflict) return tenantError(`Slug "${slug}" already exists`, 400);

    const maxSort = await db.productFamilyVariantProfile.findFirst({
      where: { productFamilyId: params.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const profile = await db.productFamilyVariantProfile.create({
      data: {
        productFamilyId: params.id,
        name: body.name,
        slug,
        shopifyVariantId: body.shopifyVariantId ?? null,
        shopifyVariantTitle: body.shopifyVariantTitle ?? null,
        shopifySku: body.shopifySku ?? null,
        imageUrl: body.imageUrl ?? null,
        sortOrder: body.sortOrder ?? ((maxSort?.sortOrder ?? -1) + 1),
        isDefault: body.isDefault ?? false,
        isActive: true,
      },
    });

    return tenantResponse({ variantProfile: profile }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[variant-profiles/POST]', message, error);
    return tenantError(`Failed to create variant profile: ${message}`, 500);
  }
}
