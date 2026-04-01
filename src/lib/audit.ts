import { AuditAction } from '@prisma/client';
import { db } from './db';

interface AuditEntry {
  storeId: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

/**
 * Create an audit log entry.
 * Should be called after every mutation to rules, options, pricing, etc.
 */
export async function createAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        storeId: entry.storeId,
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : undefined,
        after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : undefined,
        metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
      },
    });
  } catch (error) {
    // Audit log failure should not break the main operation
    console.error('[AuditLog] Failed to create entry:', error);
  }
}

/**
 * Helper to wrap a mutation with automatic audit logging
 */
export async function withAudit<T>(
  entry: Omit<AuditEntry, 'after'>,
  mutation: () => Promise<T>
): Promise<T> {
  const result = await mutation();
  await createAuditLog({
    ...entry,
    after: result,
  });
  return result;
}
