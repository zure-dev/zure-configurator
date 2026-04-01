import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// ──────────────────────────────────────────────
// Types (matching Prisma schema exactly)
//
// Two rule types in the schema:
//   OptionDependencyRule — "WHEN X, THEN only allow Y values"
//   OptionExclusionRule  — "WHEN X, THEN exclude Y values"
//
// This service provides unified CRUD for both.
// ──────────────────────────────────────────────

export type RuleType = 'dependency' | 'exclusion';

export interface CreateDependencyRuleInput {
  productFamilyId: string;
  name?: string | null;
  description?: string | null;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  thenOptionGroupSlug: string;
  thenOptionValueSlugs: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateDependencyRuleInput {
  name?: string | null;
  description?: string | null;
  whenOptionGroupSlug?: string;
  whenOptionValueSlug?: string;
  thenOptionGroupSlug?: string;
  thenOptionValueSlugs?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateExclusionRuleInput {
  productFamilyId: string;
  name?: string | null;
  description?: string | null;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  excludeOptionGroupSlug: string;
  excludeOptionValueSlugs: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateExclusionRuleInput {
  name?: string | null;
  description?: string | null;
  whenOptionGroupSlug?: string;
  whenOptionValueSlug?: string;
  excludeOptionGroupSlug?: string;
  excludeOptionValueSlugs?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

// ──────────────────────────────────────────────
// Ownership verification
// ──────────────────────────────────────────────

async function verifyFamilyOwnership(storeId: string, productFamilyId: string) {
  const family = await db.productFamily.findFirst({
    where: { id: productFamilyId, storeId },
  });
  if (!family) {
    throw new RuleError('Product family not found', 'FAMILY_NOT_FOUND');
  }
  return family;
}

async function verifyDependencyRuleOwnership(storeId: string, ruleId: string) {
  const rule = await db.optionDependencyRule.findUnique({
    where: { id: ruleId },
    include: { productFamily: { select: { storeId: true } } },
  });
  if (!rule || rule.productFamily.storeId !== storeId) {
    throw new RuleError('Dependency rule not found', 'NOT_FOUND');
  }
  return rule;
}

async function verifyExclusionRuleOwnership(storeId: string, ruleId: string) {
  const rule = await db.optionExclusionRule.findUnique({
    where: { id: ruleId },
    include: { productFamily: { select: { storeId: true } } },
  });
  if (!rule || rule.productFamily.storeId !== storeId) {
    throw new RuleError('Exclusion rule not found', 'NOT_FOUND');
  }
  return rule;
}

// ──────────────────────────────────────────────
// DEPENDENCY RULES CRUD
// ──────────────────────────────────────────────

export async function listDependencyRules(storeId: string, productFamilyId: string) {
  await verifyFamilyOwnership(storeId, productFamilyId);
  return db.optionDependencyRule.findMany({
    where: { productFamilyId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getDependencyRule(storeId: string, ruleId: string) {
  const rule = await db.optionDependencyRule.findUnique({
    where: { id: ruleId },
    include: { productFamily: { select: { id: true, name: true, storeId: true } } },
  });
  if (!rule || rule.productFamily.storeId !== storeId) return null;
  return rule;
}

export async function createDependencyRule(storeId: string, input: CreateDependencyRuleInput) {
  await verifyFamilyOwnership(storeId, input.productFamilyId);

  // Auto sortOrder
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const max = await db.optionDependencyRule.findFirst({
      where: { productFamilyId: input.productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (max?.sortOrder ?? -1) + 1;
  }

  const rule = await db.optionDependencyRule.create({
    data: {
      productFamilyId: input.productFamilyId,
      name: input.name ?? null,
      description: input.description ?? null,
      whenOptionGroupSlug: input.whenOptionGroupSlug,
      whenOptionValueSlug: input.whenOptionValueSlug,
      thenOptionGroupSlug: input.thenOptionGroupSlug,
      thenOptionValueSlugs: input.thenOptionValueSlugs,
      isActive: input.isActive ?? true,
      sortOrder,
    },
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'OptionDependencyRule',
    entityId: rule.id,
    after: rule,
  });

  return rule;
}

export async function updateDependencyRule(
  storeId: string,
  ruleId: string,
  input: UpdateDependencyRuleInput
) {
  const existing = await verifyDependencyRuleOwnership(storeId, ruleId);

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.whenOptionGroupSlug !== undefined) updateData.whenOptionGroupSlug = input.whenOptionGroupSlug;
  if (input.whenOptionValueSlug !== undefined) updateData.whenOptionValueSlug = input.whenOptionValueSlug;
  if (input.thenOptionGroupSlug !== undefined) updateData.thenOptionGroupSlug = input.thenOptionGroupSlug;
  if (input.thenOptionValueSlugs !== undefined) updateData.thenOptionValueSlugs = input.thenOptionValueSlugs;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  const updated = await db.optionDependencyRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  await createAuditLog({
    storeId,
    action: 'UPDATE',
    entityType: 'OptionDependencyRule',
    entityId: ruleId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteDependencyRule(storeId: string, ruleId: string) {
  const existing = await verifyDependencyRuleOwnership(storeId, ruleId);
  await db.optionDependencyRule.delete({ where: { id: ruleId } });

  await createAuditLog({
    storeId,
    action: 'DELETE',
    entityType: 'OptionDependencyRule',
    entityId: ruleId,
    before: existing,
  });

  return existing;
}

// ──────────────────────────────────────────────
// EXCLUSION RULES CRUD
// ──────────────────────────────────────────────

export async function listExclusionRules(storeId: string, productFamilyId: string) {
  await verifyFamilyOwnership(storeId, productFamilyId);
  return db.optionExclusionRule.findMany({
    where: { productFamilyId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getExclusionRule(storeId: string, ruleId: string) {
  const rule = await db.optionExclusionRule.findUnique({
    where: { id: ruleId },
    include: { productFamily: { select: { id: true, name: true, storeId: true } } },
  });
  if (!rule || rule.productFamily.storeId !== storeId) return null;
  return rule;
}

export async function createExclusionRule(storeId: string, input: CreateExclusionRuleInput) {
  await verifyFamilyOwnership(storeId, input.productFamilyId);

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const max = await db.optionExclusionRule.findFirst({
      where: { productFamilyId: input.productFamilyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (max?.sortOrder ?? -1) + 1;
  }

  const rule = await db.optionExclusionRule.create({
    data: {
      productFamilyId: input.productFamilyId,
      name: input.name ?? null,
      description: input.description ?? null,
      whenOptionGroupSlug: input.whenOptionGroupSlug,
      whenOptionValueSlug: input.whenOptionValueSlug,
      excludeOptionGroupSlug: input.excludeOptionGroupSlug,
      excludeOptionValueSlugs: input.excludeOptionValueSlugs,
      isActive: input.isActive ?? true,
      sortOrder,
    },
  });

  await createAuditLog({
    storeId,
    action: 'CREATE',
    entityType: 'OptionExclusionRule',
    entityId: rule.id,
    after: rule,
  });

  return rule;
}

export async function updateExclusionRule(
  storeId: string,
  ruleId: string,
  input: UpdateExclusionRuleInput
) {
  const existing = await verifyExclusionRuleOwnership(storeId, ruleId);

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.whenOptionGroupSlug !== undefined) updateData.whenOptionGroupSlug = input.whenOptionGroupSlug;
  if (input.whenOptionValueSlug !== undefined) updateData.whenOptionValueSlug = input.whenOptionValueSlug;
  if (input.excludeOptionGroupSlug !== undefined) updateData.excludeOptionGroupSlug = input.excludeOptionGroupSlug;
  if (input.excludeOptionValueSlugs !== undefined) updateData.excludeOptionValueSlugs = input.excludeOptionValueSlugs;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  const updated = await db.optionExclusionRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  await createAuditLog({
    storeId,
    action: 'UPDATE',
    entityType: 'OptionExclusionRule',
    entityId: ruleId,
    before: existing,
    after: updated,
  });

  return updated;
}

export async function deleteExclusionRule(storeId: string, ruleId: string) {
  const existing = await verifyExclusionRuleOwnership(storeId, ruleId);
  await db.optionExclusionRule.delete({ where: { id: ruleId } });

  await createAuditLog({
    storeId,
    action: 'DELETE',
    entityType: 'OptionExclusionRule',
    entityId: ruleId,
    before: existing,
  });

  return existing;
}

// ──────────────────────────────────────────────
// COMBINED: list all rules for a product family
// ──────────────────────────────────────────────

export async function listAllRules(storeId: string, productFamilyId: string) {
  await verifyFamilyOwnership(storeId, productFamilyId);

  const [dependencyRules, exclusionRules] = await Promise.all([
    db.optionDependencyRule.findMany({
      where: { productFamilyId },
      orderBy: { sortOrder: 'asc' },
    }),
    db.optionExclusionRule.findMany({
      where: { productFamilyId },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return { dependencyRules, exclusionRules };
}

// ──────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────

export type RuleErrorCode =
  | 'NOT_FOUND'
  | 'FAMILY_NOT_FOUND'
  | 'VALIDATION';

export class RuleError extends Error {
  code: RuleErrorCode;

  constructor(message: string, code: RuleErrorCode) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }

  get httpStatus(): number {
    switch (this.code) {
      case 'NOT_FOUND':
      case 'FAMILY_NOT_FOUND':
        return 404;
      case 'VALIDATION':
        return 400;
      default:
        return 500;
    }
  }
}
