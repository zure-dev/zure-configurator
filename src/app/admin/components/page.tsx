'use client';

import { useState, useEffect } from 'react';
import {
  Page, Layout, Card, DataTable, Spinner, Text, Badge, Select,
} from '@shopify/polaris';

export default function ComponentsPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/product-families')
      .then((r) => r.json())
      .then((d) => {
        setFamilies(d.families ?? []);
        if (d.families?.length) setSelectedFamily(d.families[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFamily) return;
    fetch(`/api/product-families/${selectedFamily}`)
      .then((r) => r.json())
      .then((d) => setComponents(d.family?.components ?? []));
  }, [selectedFamily]);

  const typeBadge = (type: string) => {
    const tones: Record<string, any> = {
      CABINET: 'success', STONE_TOP: 'info', BASIN: 'attention',
      HANDLE: undefined, PLUG_WASTE: undefined, ACCESSORY: 'magic',
    };
    return <Badge tone={tones[type]}>{type}</Badge>;
  };

  const rows = components.map((c) => [
    c.name,
    c.sku,
    typeBadge(c.type),
    c.shopifyProductId ? 'Linked' : 'Internal only',
  ]);

  if (loading) {
    return <Page title="Components"><div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div></Page>;
  }

  return (
    <Page title="Component Registry">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p" variant="bodySm" tone="subdued">
              Components are the internal SKUs that make up a configured product.
              Each configuration maps to one or more components for operational tracking.
            </Text>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Select
              label="Product Family"
              options={families.map((f) => ({ label: f.name, value: f.id }))}
              value={selectedFamily}
              onChange={setSelectedFamily}
            />
          </Card>
        </Layout.Section>

        {components.length > 0 && (
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={['Name', 'SKU', 'Type', 'Shopify Link']}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
