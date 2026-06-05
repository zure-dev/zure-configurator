import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateOptionGroupInput {
  productFamilyId: string;
  name: string;
  slug?: string;
  displayType?: string;
  sortOrder?: number;
  isRequired?: boolean;
  helperText?: string | null;
  stepNumber?: number | null;
  isConditional?: boolean;
  visibilityConditions?: Prisma.InputJsonValue | null;
}

export interface UpdateOptionGroupInput {
  name?: string;
  slug?: string;
  displayType?: string;
  sortOrder?: number;
  isRequired?: boolean;
  helperText?: string | null;
  stepNumber?: number | null;
  isConditional?: boolean;
  visibilityConditions?: Prisma.InputJsonValue | null;
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

async function verifyFamilyOwnership(storeId: string, productFamilyId: string) {
  const family = await db.productFamily.findFirst({
    where: { id: productFamilyId, storeId },
    select: { id: true, name: true, storeId: true },
  });

  if (!family) {
    throw new OptionGroupError('Product family not found', 'FAMILY_NOT_FOUND');
  }

  return family;
}

async function verifyGroupOwnership(storeId: string, groupId: string) {
  const group = await db.optionGroup.findUnique({
    where: { id: groupId },
    include: {
      productFamily: {
        select: { id: true, name: true, storeId: true },
      },
    },
  });

  if (!group) {
    throw new OptionGroupError('Option group not found', 'NOT_FOUND');
  }

  if (group.productFamily.storeId !== storeId) {
    throw new OptionGroupError(
      `Option group belongs to store "${group.productFamily.storeId}", not "${storeId}"`,
      'STORE_MISMATCH'
    );
  }

  return group;
}

// ──────────────────────────────────────────────
// List
// ──────────────────────────────────────────────

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

export async function listAllOptionGroups(storeId: string) {
  return db.optionGroup.findMany({
    where: {
      productFamily: { storeId },
    },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: { select: { id: true, name: true } },
    },
    orderBy: [{ productFamilyId: 'asc' }, { sortOrder: 'asc' }],
  });
}

// ──────────────────────────────────────────────
// Get
// ──────────────────────────────────────────────

export async function getOptionGroup(storeId: string, groupId: string) {
  const group = await db.optionGroup.findUnique({
    where: { id: groupId },
    include: {
      values: { orderBy: { sortOrder: 'asc' } },
      productFamily: {
        select: { id: true, name: true, storeId: true },
      },
    },
  });

  if (!group) return null;
  if (group.productFamily.storeId !== storeId) return null;

  return group;
}

// ──────────────────────────────────────────────
// Create
// ──────────────────────────────────────────────

export async function createOptionGroup(
  storeId: string,
  input: CreateOptionGroupInput
) {
  const family = await verifyFamilyOwnership(storeId, input.productFamilyId);

  const slug = (input.slug && input.slug.trim()) || toSlug(input.name);

  const existing = await db.optionGroup.findFirst({
    where: { productFamilyId: input.productFamilyId, slug },
    select: { id: true },
  });

  if (existing) {
    throw new OptionGroupError(
      `Slug "${slug}" already exists in this product family`,
      'DUPLICATE_SLUG'
    );
  }

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
      displayType: (input.displayType as any) ?? 'TILE',
      sortOrder,
      isRequired: input.isRequired ?? true,
      helperText: input.helperText ?? null,
      stepNumber: input.stepNumber ?? null,
      isConditional: input.isConditional ?? false,
      visibilityConditions: input.visibilityConditions != null
        ? input.visibilityConditions
        : Prisma.JsonNull,
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
    metadata: {
      productFamilyId: family.id,
      productFamilyName: family.name,
    },
  });

  return group;
}

// ──────────────────────────────────────────────
// Update
// ──────────────────────────────────────────────

export async function updateOptionGroup(
  storeId: string,
  groupId: string,
  input: UpdateOptionGroupInput
) {
  const existing = await verifyGroupOwnership(storeId, groupId);

  const nextSlug =
    input.slug !== undefined
      ? input.slug
      : input.name !== undefined
        ? toSlug(input.name)
        : undefined;

  if (nextSlug && nextSlug !== existing.slug) {
    const conflict = await db.optionGroup.findFirst({
      where: {
        productFamilyId: existing.productFamilyId,
        slug: nextSlug,
        NOT: { id: groupId },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new OptionGroupError(
        `Slug "${nextSlug}" already exists in this product family`,
        'DUPLICATE_SLUG'
      );
    }
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (nextSlug !== undefined) updateData.slug = nextSlug;
  if (input.displayType !== undefined) updateData.displayType = input.displayType;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
  if (input.helperText !== undefined) updateData.helperText = input.helperText;
  if (input.stepNumber !== undefined) updateData.stepNumber = input.stepNumber;
  if (input.isConditional !== undefined) updateData.isConditional = input.isConditional;
  if (input.visibilityConditions !== undefined) {
    updateData.visibilityConditions = input.visibilityConditions != null
      ? input.visibilityConditions
      : Prisma.JsonNull;
  }

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

// ──────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────

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
  | 'DUPLICATE_SLUG'
  | 'STORE_MISMATCH';

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
      case 'STORE_MISMATCH':
        return 403;
      default:
        return 500;
    }
  }
}
