'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Pagination,
  Spinner,
  Text,
  Badge,
} from '@shopify/polaris';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?page=${page}&limit=25`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionBadge = (action: string) => {
    const toneMap: Record<string, any> = {
      CREATE: 'success',
      UPDATE: 'info',
      DELETE: 'critical',
      PUBLISH: 'attention',
      IMPORT: 'magic',
      EXPORT: undefined,
    };
    return <Badge tone={toneMap[action]}>{action}</Badge>;
  };

  const rows = logs.map((log) => [
    new Date(log.createdAt).toLocaleString(),
    actionBadge(log.action),
    log.entityType,
    log.entityId.slice(0, 12) + '...',
    log.userName ?? 'System',
  ]);

  return (
    <Page title="Audit Log">
      <Layout>
        <Layout.Section>
          <Card>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Spinner />
              </div>
            ) : (
              <>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Time', 'Action', 'Entity Type', 'Entity ID', 'User']}
                  rows={rows}
                />
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <Pagination
                    hasPrevious={page > 1}
                    hasNext={page < totalPages}
                    onPrevious={() => setPage((p) => p - 1)}
                    onNext={() => setPage((p) => p + 1)}
                  />
                </div>
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
