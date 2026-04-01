import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import type { ProductFamilyStatus } from '@prisma/client';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateProductFamilyInput {
  name: string;
  handle: string;
  category?: string | null;
  description?: string | null;
  shopifyProductId?: string | null;
  basePrice?: number;
  status?: ProductFamilyStatus;
}

export interface UpdateProductFamilyInput {
  name?: string;
  handle?: string;
  category?: string | null;
  description?: string | null;
  shopifyProductId?: string | null;
  basePrice?: number;
  status?: ProductFamilyStatus;
  defaultMediaSet?: unknown;
}

export interface ListProductFamiliesOptions {
  status?: ProductFamilyStatus;
  category?: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Generate a URL-safe handle from a name.
 * "Zure Vanity 600mm" → "zure-vanity-600mm"
 */
export function generateHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ──────────────────────────────────────────────
// CRUD Operations
// ──────────────────────────────────────────────

/**
 * List all product families for a store.
 */
export async function listProductFamilies(
  storeId: string,
  options?: ListProductFamiliesOptions
) {
  const where: any = { storeId };
  if (options?.status) where.status = options.status;
  if (options?.category) where.category = options.category;

  return db.productFamily.findMany({
    where,
    include: {
      shopifyLink: true,
      _count: {
        select: {
          optionGroups: true,
          priceRules: true,
          dependencyRules: true,
          exclusionRules: true,
          mediaRules: true,
          components: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get a single product family by ID, scoped to store.
 */
export async function getProductFamily(storeId: string, familyId: string) {
  return db.productFamily.findFirst({
    where: { id: familyId, storeId },
    include: {
      shopifyLink: true,
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { values: { orderBy: { sortOrder: 'asc' } } },
      },
      dependencyRules: { where: { isActive: true } },
      exclusionRules: { where: { isActive: true } },
      priceRules: { where: { isActive: true } },
      tradePriceRules: { where: { isActive: true } },
      mediaRules: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      summaryRules: { orderBy: { sortOrder: 'asc' } },
      components: true,
      ruleVersions: { orderBy: { version: 'desc' }, take: 5 },
    },
  });
}

/**
 * Get a product family by handle, scoped to store.
 */
export async function getProductFamilyByHandle(storeId: string, handle: string) {
  return db.productFamily.findUnique({
    where: { storeId_handle: { storeId, handle } },
  });
}

/**
 * Create a new product family.
 */
export async function createProductFamily(
  storeId: string,
  input: CreateProductFamilyInput
) {
  const handle = input.handle || generateHandle(input.name);

  // Check handle uniqueness within store
  const existingByHandle = await db.productFamily.findUnique({
    where: { storeId_handle: { storeId, handle } },
  });
  if (existingByHandle) {
    throw new ProductFamilyError(`A product family with handle "${handle}" already exists`, 'DUPLICATE_HANDLE');
  }

  // Also set slug = handle for backward compatibility
  const existingBySlug = await db.productFamily.findUnique({
    where: { storeId_slug: { storeId, slug: handle } },
  });
  if (existingBySlug) {
    throw new ProductFamilyError(`A product family with slug "${handle}" already exists`, 'DUPLICATE_SLUG');
  }

  const family = await db.productFamily.create({
    data: {
      storeId,
      name: input.name,
      handle,
      slug: handle, // keep slug in sync with handle
      category: input.category ?? null,
      description: input.description ?? null,
      shopifyProductId: input.shopifyProductId ?? null,
      basePrice: input.basePrice ?? 0,
      status: input.status ?? 'DRAFT',
      defaultMediaSet: [],
    },
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'ProductFamily',
    entityId: family.id,
    after: family,
  });

  return family;
}

/**
 * Update an existing product family.
 */
export async function updateProductFamily(
  storeId: string,
  familyId: string,
  input: UpdateProductFamilyInput
) {
  // Verify it belongs to this store
  const existing = await db.productFamily.findFirst({
    where: { id: familyId, storeId },
  });
  if (!existing) {
    throw new ProductFamilyError('Product family not found', 'NOT_FOUND');
  }

  // If handle is changing, check uniqueness
  if (input.handle && input.handle !== existing.handle) {
    const conflict = await db.productFamily.findUnique({
      where: { storeId_handle: { storeId, handle: input.handle } },
    });
    if (conflict) {
      throw new ProductFamilyError(`Handle "${input.handle}" is already in use`, 'DUPLICATE_HANDLE');
    }
  }

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.handle !== undefined) {
    updateData.handle = input.handle;
    updateData.slug = input.handle; // keep slug in sync
  }
  if (input.category !== undefined) updateData.category = input.category;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.shopifyProductId !== undefined) updateData.shopifyProductId = input.shopifyProductId;
  if (input.basePrice !== undefined) updateData.basePrice = input.basePrice;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.defaultMediaSet !== undefined) updateData.defaultMediaSet = input.defaultMediaSet;

  const updated = await db.productFamily.update({
    where: { id: familyId },
    data: updateData,
  });

  await createAuditLog({
    storeId,
    action: 'UPDATE',
    entityType: 'ProductFamily',
    entityId: familyId,
    before: existing,
    after: updated,
  });

  return updated;
}

/**
 * Delete a product family.
 */
export async function deleteProductFamily(storeId: string, familyId: string) {
  const existing = await db.productFamily.findFirst({
    where: { id: familyId, storeId },
  });
  if (!existing) {
    throw new ProductFamilyError('Product family not found', 'NOT_FOUND');
  }

  await db.productFamily.delete({ where: { id: familyId } });

  await createAuditLog({
    storeId,
    action: 'DELETE',
    entityType: 'ProductFamily',
    entityId: familyId,
    before: existing,
  });

  return existing;
}

// ──────────────────────────────────────────────
// Error class
// ──────────────────────────────────────────────

export type ProductFamilyErrorCode =
  | 'NOT_FOUND'
  | 'DUPLICATE_HANDLE'
  | 'DUPLICATE_SLUG'
  | 'VALIDATION';

export class ProductFamilyError extends Error {
  code: ProductFamilyErrorCode;

  constructor(message: string, code: ProductFamilyErrorCode) {
    super(message);
    this.name = 'ProductFamilyError';
    this.code = code;
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'NOT_FOUND': return 404;
      case 'DUPLICATE_HANDLE':
      case 'DUPLICATE_SLUG':
      case 'VALIDATION': return 400;
      default: return 500;
    }
  }
}
