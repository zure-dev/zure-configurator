'use client';

import { useState, useCallback } from 'react';
import {
  Page, Layout, Card, TextField, Button, Banner,
  BlockStack, Text, Badge, InlineStack, Divider,
} from '@shopify/polaris';

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [snapshot, setSnapshot] = useState<any>(null);
  const [orderRes, setOrderRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    setSnapshot(null);
    setOrderRes(null);

    try {
      // Try as snapshot ID first, then as order ID
      const isOrderId = searchQuery.startsWith('#') || /^\d+$/.test(searchQuery);
      const param = isOrderId
        ? `orderId=${searchQuery.replace('#', '')}`
        : `snapshotId=${searchQuery}`;

      const res = await fetch(`/api/order/snapshot?${param}`);
      if (!res.ok) {
        setError('Not found. Try a configuration ID or Shopify order ID.');
        return;
      }

      const data = await res.json();
      setSnapshot(data.snapshot);
      setOrderRes(data.orderResolution);
    } catch (e) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  return (
    <Page title="Order Configurations">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd" tone="subdued">
                Look up a configuration snapshot by its ID or by a Shopify order ID.
              </Text>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search"
                    labelHidden
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Configuration ID or Order ID (e.g. #1042)"
                    autoComplete="off"
                    onKeyDown={(e: any) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} loading={loading}>Search</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {error && (
          <Layout.Section>
            <Banner tone="warning">{error}</Banner>
          </Layout.Section>
        )}

        {snapshot && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Configuration Snapshot</Text>
                  <Badge>{snapshot.id.slice(0, 12)}...</Badge>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Summary</Text>
                  <Text as="p" variant="bodyMd">{snapshot.summaryText}</Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Selections</Text>
                  {Object.entries(snapshot.selections as Record<string, any>).map(([key, val]) => (
                    <InlineStack key={key} gap="200">
                      <Text as="span" variant="bodySm" tone="subdued" fontWeight="semibold">{key}:</Text>
                      <Text as="span" variant="bodySm">{typeof val === 'object' ? val.name : val}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Pricing</Text>
                  {snapshot.pricingBreakdown && (
                    <>
                      <Text as="p" variant="bodySm">Base: ${snapshot.pricingBreakdown.basePrice}</Text>
                      {(snapshot.pricingBreakdown.modifiers ?? []).map((m: any, i: number) => (
                        <Text key={i} as="p" variant="bodySm">
                          {m.optionGroupName} → {m.optionValueName}: {m.delta >= 0 ? '+' : ''}${m.delta}
                        </Text>
                      ))}
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        Total: ${snapshot.pricingBreakdown.totalPrice}
                        {snapshot.pricingBreakdown.isTradePrice && <Badge tone="magic">Trade</Badge>}
                      </Text>
                    </>
                  )}
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Components</Text>
                  {(snapshot.componentMappings ?? []).map((c: any, i: number) => (
                    <InlineStack key={i} gap="200">
                      <Badge>{c.type}</Badge>
                      <Text as="span" variant="bodySm">{c.name}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">SKU: {c.sku} × {c.quantity}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>

                <Divider />

                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Rule Version: {snapshot.ruleVersionId}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Signature: {snapshot.validationSignature?.slice(0, 30)}...</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Created: {new Date(snapshot.createdAt).toLocaleString()}</Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {orderRes && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Order Resolution</Text>
                <Text as="p" variant="bodySm">Shopify Order: {orderRes.shopifyOrderName ?? orderRes.shopifyOrderId}</Text>
                <Text as="p" variant="bodySm">Line Item ID: {orderRes.shopifyLineItemId}</Text>
                <Text as="p" variant="bodySm">Fulfilment: {orderRes.fulfilmentStatus ?? 'Pending'}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
