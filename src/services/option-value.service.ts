import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateOptionValueInput {
  optionGroupId: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isDefault?: boolean;
  swatchColor?: string | null;
  swatchImage?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  shopifyProductTitle?: string | null;
  shopifyVariantTitle?: string | null;
  shopifySku?: string | null;
  shopifyImageUrl?: string | null;
  shopifyPrice?: number | null;
}

export interface UpdateOptionValueInput {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isDefault?: boolean;
  swatchColor?: string | null;
  swatchImage?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  shopifyProductTitle?: string | null;
  shopifyVariantTitle?: string | null;
  shopifySku?: string | null;
  shopifyImageUrl?: string | null;
  shopifyPrice?: number | null;
}

export interface CreateOptionValueBySlugInput {
  familyId: string;
  groupSlug: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isDefault?: boolean;
  swatchColor?: string | null;
  swatchImage?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  shopifyProductTitle?: string | null;
  shopifyVariantTitle?: string | null;
  shopifySku?: string | null;
  shopifyImageUrl?: string | null;
  shopifyPrice?: number | null;
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

async function verifyGroupOwnership(storeId: string, optionGroupId: string) {
  const group = await db.optionGroup.findUnique({
    where: { id: optionGroupId },
    include: {
      productFamily: {
        select: { id: true, name: true, storeId: true },
      },
    },
  });

  if (!group) {
    throw new OptionValueError('Option group not found', 'GROUP_NOT_FOUND');
  }

  if (group.productFamily.storeId !== storeId) {
    throw new OptionValueError(
      `Option group belongs to store "${group.productFamily.storeId}", not "${storeId}"`,
      'STORE_MISMATCH'
    );
  }

  return group;
}

async function verifyValueOwnership(storeId: string, valueId: string) {
  const value = await db.optionValue.findUnique({
    where: { id: valueId },
    include: {
      optionGroup: {
        include: {
          productFamily: {
            select: { id: true, name: true, storeId: true },
          },
        },
      },
    },
  });

  if (!value) {
    throw new OptionValueError('Option value not found', 'NOT_FOUND');
  }

  if (value.optionGroup.productFamily.storeId !== storeId) {
    throw new OptionValueError(
      `Option value belongs to store "${value.optionGroup.productFamily.storeId}", not "${storeId}"`,
      'STORE_MISMATCH'
    );
  }

  return value;
}

async function findGroupByFamilyAndSlug(
  storeId: string,
  familyId: string,
  groupSlug: string
) {
  const group = await db.optionGroup.findFirst({
    where: {
      productFamilyId: familyId,
      slug: groupSlug,
      productFamily: { storeId },
    },
    include: {
      productFamily: {
        select: { id: true, name: true, storeId: true },
      },
    },
  });

  if (!group) {
    throw new OptionValueError('Option group not found', 'GROUP_NOT_FOUND');
  }

  return group;
}

function buildShopifyLinkData(input: {
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  shopifyProductTitle?: string | null;
  shopifyVariantTitle?: string | null;
  shopifySku?: string | null;
  shopifyImageUrl?: string | null;
  shopifyPrice?: number | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.shopifyProductId !== undefined) data.shopifyProductId = input.shopifyProductId;
  if (input.shopifyVariantId !== undefined) data.shopifyVariantId = input.shopifyVariantId;
  if (input.shopifyProductTitle !== undefined) data.shopifyProductTitle = input.shopifyProductTitle;
  if (input.shopifyVariantTitle !== undefined) data.shopifyVariantTitle = input.shopifyVariantTitle;
  if (input.shopifySku !== undefined) data.shopifySku = input.shopifySku;
  if (input.shopifyImageUrl !== undefined) data.shopifyImageUrl = input.shopifyImageUrl;
  if (input.shopifyPrice !== undefined) data.shopifyPrice = input.shopifyPrice;
  return data;
}

// ──────────────────────────────────────────────
// CRUD by optionGroupId
// ──────────────────────────────────────────────

export async function listOptionValues(storeId: string, optionGroupId: string) {
  await verifyGroupOwnership(storeId, optionGroupId);

  return db.optionValue.findMany({
    where: { optionGroupId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getOptionValue(storeId: string, valueId: string) {
  const value = await db.optionValue.findUnique({
    where: { id: valueId },
    include: {
      optionGroup: {
        select: {
          id: true,
          name: true,
          productFamily: {
            select: { id: true, name: true, storeId: true },
          },
        },
      },
    },
  });

  if (!value) return null;
  if (value.optionGroup.productFamily.storeId !== storeId) return null;

  return value;
}

export async function createOptionValue(
  storeId: string,
  input: CreateOptionValueInput
) {
  const group = await verifyGroupOwnership(storeId, input.optionGroupId);

  const slug = (input.slug && input.slug.trim()) || toSlug(input.name);

  const existing = await db.optionValue.findFirst({
    where: { optionGroupId: input.optionGroupId, slug },
    select: { id: true },
  });

  if (existing) {
    throw new OptionValueError(
      `Slug "${slug}" already exists in this option group`,
      'DUPLICATE_SLUG'
    );
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxValue = await db.optionValue.findFirst({
      where: { optionGroupId: input.optionGroupId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (maxValue?.sortOrder ?? -1) + 1;
  }

  const value = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.isDefault === true) {
      await tx.optionValue.updateMany({
        where: { optionGroupId: input.optionGroupId },
        data: { isDefault: false },
      });
    }

    return tx.optionValue.create({
      data: {
        optionGroupId: input.optionGroupId,
        name: input.name,
        slug,
        sortOrder,
        isDefault: input.isDefault ?? false,
        swatchColor: input.swatchColor ?? null,
        swatchImage: input.swatchImage ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        description: input.description ?? null,
        metadata: input.metadata != null
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shopifyProductId: input.shopifyProductId ?? null,
        shopifyVariantId: input.shopifyVariantId ?? null,
        shopifyProductTitle: input.shopifyProductTitle ?? null,
        shopifyVariantTitle: input.shopifyVariantTitle ?? null,
        shopifySku: input.shopifySku ?? null,
        shopifyImageUrl: input.shopifyImageUrl ?? null,
        shopifyPrice: input.shopifyPrice ?? null,
      },
      include: {
        optionGroup: { select: { id: true, name: true } },
      },
    });
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'OptionValue',
    entityId: value.id,
    after: value,
    metadata: {
      optionGroupId: group.id,
      optionGroupName: group.name,
    },
  });

  return value;
}

export async function updateOptionValue(
  storeId: string,
  valueId: string,
  input: UpdateOptionValueInput
) {
  const existing = await verifyValueOwnership(storeId, valueId);

  const nextSlug =
    input.slug !== undefined
      ? input.slug
      : input.name !== undefined
        ? toSlug(input.name)
        : undefined;

  if (nextSlug && nextSlug !== existing.slug) {
    const conflict = await db.optionValue.findFirst({
      where: {
        optionGroupId: existing.optionGroupId,
        slug: nextSlug,
        NOT: { id: valueId },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new OptionValueError(
        `Slug "${nextSlug}" already exists in this option group`,
        'DUPLICATE_SLUG'
      );
    }
  }

  const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.isDefault === true) {
      await tx.optionValue.updateMany({
        where: {
          optionGroupId: existing.optionGroupId,
          NOT: { id: valueId },
        },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (nextSlug !== undefined) updateData.slug = nextSlug;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.swatchColor !== undefined) updateData.swatchColor = input.swatchColor;
    if (input.swatchImage !== undefined) updateData.swatchImage = input.swatchImage;
    if (input.thumbnailUrl !== undefined) updateData.thumbnailUrl = input.thumbnailUrl;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata != null
        ? (input.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const shopifyData = buildShopifyLinkData(input);
    Object.assign(updateData, shopifyData);

    return tx.optionValue.update({
      where: { id: valueId },
      data: updateData,
      include: {
        optionGroup: { select: { id: true, name: true } },
      },
    });
  });

  await createAuditLog({
    storeId,
    action: 'UPDATE',
    entityType: 'OptionValue',
    entityId: valueId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteOptionValue(storeId: string, valueId: string) {
  const existing = await verifyValueOwnership(storeId, valueId);

  await db.optionValue.delete({ where: { id: valueId } });

  await createAuditLog({
    storeId,
    action: 'DELETE',
    entityType: 'OptionValue',
    entityId: valueId,
    before: existing,
  });

  return existing;
}

// ──────────────────────────────────────────────
// CRUD by familyId + groupSlug
// ──────────────────────────────────────────────

export async function listOptionValuesByGroupSlug(
  storeId: string,
  familyId: string,
  groupSlug: string
) {
  const group = await findGroupByFamilyAndSlug(storeId, familyId, groupSlug);

  return db.optionValue.findMany({
    where: { optionGroupId: group.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function createOptionValueByGroupSlug(
  storeId: string,
  input: CreateOptionValueBySlugInput
) {
  const group = await findGroupByFamilyAndSlug(
    storeId,
    input.familyId,
    input.groupSlug
  );

  const slug = (input.slug && input.slug.trim()) || toSlug(input.name);

  const existing = await db.optionValue.findFirst({
    where: { optionGroupId: group.id, slug },
    select: { id: true },
  });

  if (existing) {
    throw new OptionValueError(
      `Slug "${slug}" already exists in this option group`,
      'DUPLICATE_SLUG'
    );
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxValue = await db.optionValue.findFirst({
      where: { optionGroupId: group.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (maxValue?.sortOrder ?? -1) + 1;
  }

  const value = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.isDefault === true) {
      await tx.optionValue.updateMany({
        where: { optionGroupId: group.id },
        data: { isDefault: false },
      });
    }

    return tx.optionValue.create({
      data: {
        optionGroupId: group.id,
        name: input.name,
        slug,
        sortOrder,
        isDefault: input.isDefault ?? false,
        swatchColor: input.swatchColor ?? null,
        swatchImage: input.swatchImage ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        description: input.description ?? null,
        metadata: input.metadata != null
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shopifyProductId: input.shopifyProductId ?? null,
        shopifyVariantId: input.shopifyVariantId ?? null,
        shopifyProductTitle: input.shopifyProductTitle ?? null,
        shopifyVariantTitle: input.shopifyVariantTitle ?? null,
        shopifySku: input.shopifySku ?? null,
        shopifyImageUrl: input.shopifyImageUrl ?? null,
        shopifyPrice: input.shopifyPrice ?? null,
      },
      include: {
        optionGroup: { select: { id: true, name: true } },
      },
    });
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'OptionValue',
    entityId: value.id,
    after: value,
    metadata: {
      optionGroupId: group.id,
      optionGroupName: group.name,
      productFamilyId: group.productFamily.id,
      productFamilyName: group.productFamily.name,
    },
  });

  return value;
}

// ──────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────

export type OptionValueErrorCode =
  | 'NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'DUPLICATE_SLUG'
  | 'STORE_MISMATCH';

export class OptionValueError extends Error {
  code: OptionValueErrorCode;

  constructor(message: string, code: OptionValueErrorCode) {
    super(message);
    this.name = 'OptionValueError';
    this.code = code;
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'NOT_FOUND':
      case 'GROUP_NOT_FOUND':
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
