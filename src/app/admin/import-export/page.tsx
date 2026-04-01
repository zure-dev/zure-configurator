'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page, Layout, Card, Button, Banner, BlockStack, Text,
  Select, DropZone, InlineStack, Spinner,
} from '@shopify/polaris';

export default function ImportExportPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/api/product-families')
      .then((r) => r.json())
      .then((d) => {
        setFamilies(d.families ?? []);
        if (d.families?.length) setSelectedFamily(d.families[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExport = useCallback(async () => {
    if (!selectedFamily) return;
    try {
      const res = await fetch(`/api/import-export/export?familyId=${selectedFamily}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `configurator-export-${data.productFamily?.slug ?? 'unknown'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMsg('Export downloaded');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setErrorMsg('Export failed');
    }
  }, [selectedFamily]);

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    setErrorMsg('');
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/import-export/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error ?? 'Import failed');
        return;
      }

      const result = await res.json();
      setSuccessMsg(`Imported "${result.family.name}" as DRAFT. Review before activating.`);
      setImportFile(null);

      // Refresh family list
      const listRes = await fetch('/api/product-families');
      const listData = await listRes.json();
      setFamilies(listData.families ?? []);
    } catch (e) {
      setErrorMsg('Invalid JSON file');
    } finally {
      setImporting(false);
    }
  }, [importFile]);

  if (loading) {
    return <Page title="Import / Export"><div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div></Page>;
  }

  const familyOptions = families.map((f) => ({ label: f.name, value: f.id }));

  return (
    <Page title="Import / Export">
      {successMsg && <div style={{ marginBottom: 16 }}><Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner></div>}
      {errorMsg && <div style={{ marginBottom: 16 }}><Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner></div>}

      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Export</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Download a complete product family configuration as JSON. Includes all option groups,
                values, rules, pricing, media rules, and component mappings.
              </Text>
              {familyOptions.length > 0 ? (
                <>
                  <Select label="Product Family" options={familyOptions} value={selectedFamily} onChange={setSelectedFamily} />
                  <Button variant="primary" onClick={handleExport}>Export JSON</Button>
                </>
              ) : (
                <Text as="p" tone="subdued">No product families to export.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Import</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Import a product family configuration from a JSON export file.
                The imported family will be created as a DRAFT.
              </Text>
              <DropZone
                accept=".json"
                type="file"
                onDrop={(files) => setImportFile(files[0] ?? null)}
                allowMultiple={false}
              >
                {importFile ? (
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="bodyMd">{importFile.name}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{(importFile.size / 1024).toFixed(1)} KB</Text>
                  </BlockStack>
                ) : (
                  <DropZone.FileUpload actionTitle="Upload JSON" actionHint="or drag and drop" />
                )}
              </DropZone>
              {importFile && (
                <InlineStack gap="200">
                  <Button variant="primary" onClick={handleImport} loading={importing}>Import</Button>
                  <Button onClick={() => setImportFile(null)}>Clear</Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
