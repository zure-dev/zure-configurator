import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import type { OptionDisplayType } from '@prisma/client';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateOptionGroupInput {
  productFamilyId: string;
  name: string;
  slug: string;
  displayType?: OptionDisplayType;
  sortOrder?: number;
  isRequired?: boolean;
  helperText?: string | null;
  stepNumber?: number | null;
}

export interface UpdateOptionGroupInput {
  name?: string;
  slug?: string;
  displayType?: OptionDisplayType;
  sortOrder?: number;
  isRequired?: boolean;
  helperText?: string | null;
  stepNumber?: number | null;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Verify that a product family belongs to the given store.
 * Returns the family or throws.
 */
async function verifyFamilyOwnership(storeId: string, productFamilyId: string) {
  const family = await db.productFamily.findFirst({
    where: { id: productFamilyId, storeId },
  });
  if (!family) {
    throw new OptionGroupError('Product family not found', 'FAMILY_NOT_FOUND');
  }
  return family;
}

/**
 * Verify that an option group belongs to a store (via its product family).
 */
async function verifyGroupOwnership(storeId: string, groupId: string) {
  const group = await db.optionGroup.findUnique({
    where: { id: groupId },
    include: { productFamily: { select: { storeId: true } } },
  });
  if (!group || group.productFamily.storeId !== storeId) {
    throw new OptionGroupError('Option group not found', 'NOT_FOUND');
  }
  return group;
}

// ──────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────

/**
 * List option groups for a product family, with value counts.
 */
export async function listOptionGroups(storeId: string, productFamilyId: string) {
  await verifyFamilyOwnership(storeId, productFamilyId);

  return db.optionGroup.findMany({
    where: { productFamilyId },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * List ALL option groups across all families for a store (for the admin list page).
 */
export async function listAllOptionGroups(storeId: string) {
  return db.optionGroup.findMany({
    where: {
      productFamily: { storeId },
    },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true, handle: true } },
    },
    orderBy: [
      { productFamily: { name: 'asc' } },
      { sortOrder: 'asc' },
    ],
  });
}

/**
 * Get a single option group by ID.
 */
export async function getOptionGroup(storeId: string, groupId: string) {
  const group = await db.optionGroup.findUnique({
    where: { id: groupId },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true, storeId: true } },
    },
  });

  if (!group || group.productFamily.storeId !== storeId) return null;
  return group;
}

/**
 * Create an option group.
 */
export async function createOptionGroup(storeId: string, input: CreateOptionGroupInput) {
  await verifyFamilyOwnership(storeId, input.productFamilyId);

  const slug = input.slug || toSlug(input.name);

  // Check slug uniqueness within the family
  const existing = await db.optionGroup.findUnique({
    where: { productFamilyId_slug: { productFamilyId: input.productFamilyId, slug } },
  });
  if (existing) {
    throw new OptionGroupError(`Slug "${slug}" already exists in this product family`, 'DUPLICATE_SLUG');
  }

  // Auto-calculate sortOrder if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxGroup = await db.optionGroup.findFirst({
      where: { productFamilyId: input.productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (maxGroup?.sortOrder ?? -1) + 1;
  }

  const group = await db.optionGroup.create({
    data: {
      productFamilyId: input.productFamilyId,
      name: input.name,
      slug,
      displayType: input.displayType ?? 'TILE',
      sortOrder,
      isRequired: input.isRequired ?? true,
      helperText: input.helperText ?? null,
      stepNumber: input.stepNumber ?? null,
    },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'OptionGroup',
    entityId: group.id,
    after: group,
  });

  return group;
}

/**
 * Update an option group.
 */
export async function updateOptionGroup(
  storeId: string,
  groupId: string,
  input: UpdateOptionGroupInput
) {
  const existing = await verifyGroupOwnership(storeId, groupId);

  // If slug is changing, check uniqueness
  if (input.slug && input.slug !== existing.slug) {
    const conflict = await db.optionGroup.findUnique({
      where: {
        productFamilyId_slug: {
          productFamilyId: existing.productFamilyId,
          slug: input.slug,
        },
      },
    });
    if (conflict) {
      throw new OptionGroupError(`Slug "${input.slug}" already exists in this product family`, 'DUPLICATE_SLUG');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.displayType !== undefined) updateData.displayType = input.displayType;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
  if (input.helperText !== undefined) updateData.helperText = input.helperText;
  if (input.stepNumber !== undefined) updateData.stepNumber = input.stepNumber;

  const updated = await db.optionGroup.update({
    where: { id: groupId },
    data: updateData,
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    storeId,
    action: 'UPDATE',
    entityType: 'OptionGroup',
    entityId: groupId,
    before: existing,
    after: updated,
  });

  return updated;
}

/**
 * Delete an option group (cascades to values).
 */
export async function deleteOptionGroup(storeId: string, groupId: string) {
  const existing = await verifyGroupOwnership(storeId, groupId);

  await db.optionGroup.delete({ where: { id: groupId } });

  await createAuditLog({
    storeId,
    action: 'DELETE',
    entityType: 'OptionGroup',
    entityId: groupId,
    before: existing,
  });

  return existing;
}

// ──────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────

export type OptionGroupErrorCode =
  | 'NOT_FOUND'
  | 'FAMILY_NOT_FOUND'
  | 'DUPLICATE_SLUG';

export class OptionGroupError extends Error {
  code: OptionGroupErrorCode;

  constructor(message: string, code: OptionGroupErrorCode) {
    super(message);
    this.name = 'OptionGroupError';
    this.code = code;
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'NOT_FOUND':
      case 'FAMILY_NOT_FOUND':
        return 404;
      case 'DUPLICATE_SLUG':
        return 400;
      default:
        return 500;
    }
  }
}
