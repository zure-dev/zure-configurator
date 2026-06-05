import { NextRequest } from 'next/server';
import { getTenantFromSession, tenantResponse, tenantError } from '@/lib/tenant';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────
// GET /api/options/clipboard
// Returns the current clipboard entry for this store.
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    const entry = await db.optionGroupClipboard.findFirst({
      where: {
        storeId: tenant.storeId,
        isTemplate: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, data: true, createdAt: true },
    });

    if (!entry) {
      return tenantResponse({ hasClipboard: false, clipboard: null });
    }

    // Extract value count from data without sending all the data
    const data = entry.data as unknown as Record<string, unknown> | null;
    const values = Array.isArray(data?.values) ? data.values : [];

    return tenantResponse({
      hasClipboard: true,
      clipboard: {
        id: entry.id,
        label: entry.label,
        valueCount: values.length,
        createdAt: entry.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/clipboard/GET]', message, error);
    return tenantError(`Failed to check clipboard: ${message}`, 500);
  }
}

// ──────────────────────────────────────────────
// DELETE /api/options/clipboard
// Clears the clipboard for this store.
// ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession(request);
    if (!tenant) return tenantError('Unauthorized', 401);

    await db.optionGroupClipboard.deleteMany({
      where: { storeId: tenant.storeId, isTemplate: false },
    });

    return tenantResponse({ cleared: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[options/clipboard/DELETE]', message, error);
    return tenantError(`Failed to clear clipboard: ${message}`, 500);
  }
}
