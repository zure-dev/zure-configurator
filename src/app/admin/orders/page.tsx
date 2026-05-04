'use client';

import { useState, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Divider,
} from '@shopify/polaris';

type SnapshotSelectionValue =
  | string
  | {
      name?: string;
      slug?: string;
    };

type SnapshotData = {
  id: string;
  summaryText?: string | null;
  selections: Record<string, SnapshotSelectionValue>;
  pricingBreakdown?: {
    basePrice?: number;
    modifiers?: Array<{
      optionGroupName?: string;
      optionValueName?: string;
      delta: number;
    }>;
    totalPrice?: number;
    isTradePrice?: boolean;
  } | null;
  componentMappings?: Array<{
    type?: string;
    name?: string;
    sku?: string;
    quantity?: number;
  }> | null;
  ruleVersionId?: string | null;
  validationSignature?: string | null;
  createdAt: string;
};

type OrderResolutionData = {
  shopifyOrderName?: string | null;
  shopifyOrderId?: string | null;
  shopifyLineItemId?: string | null;
  fulfilmentStatus?: string | null;
};

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [orderRes, setOrderRes] = useState<OrderResolutionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError('Enter a configuration ID or Shopify order ID.');
      return;
    }

    setLoading(true);
    setError('');
    setSnapshot(null);
    setOrderRes(null);

    try {
      const isOrderId = searchQuery.startsWith('#') || /^\d+$/.test(searchQuery.trim());
      const param = isOrderId
        ? `orderId=${encodeURIComponent(searchQuery.replace('#', '').trim())}`
        : `snapshotId=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(`/api/order/snapshot?${param}`);

      if (!res.ok) {
        setError('Not found. Try a configuration ID or Shopify order ID.');
        return;
      }

      const data = await res.json();
      setSnapshot(data.snapshot ?? null);
      setOrderRes(data.orderResolution ?? null);
    } catch {
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
                  />
                </div>
                <Button onClick={handleSearch} loading={loading}>
                  Search
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {error ? (
          <Layout.Section>
            <Banner tone="warning">{error}</Banner>
          </Layout.Section>
        ) : null}

        {snapshot ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Configuration Snapshot
                  </Text>
                  <Badge>{`${snapshot.id.slice(0, 12)}...`}</Badge>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Summary
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {snapshot.summaryText || 'No summary available'}
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Selections
                  </Text>
                  {Object.entries(snapshot.selections ?? {}).map(([key, val]) => (
                    <InlineStack key={key} gap="200">
                      <Text
                        as="span"
                        variant="bodySm"
                        tone="subdued"
                        fontWeight="semibold"
                      >
                        {key}:
                      </Text>
                      <Text as="span" variant="bodySm">
                        {typeof val === 'object' && val !== null
                          ? (val.name ?? val.slug ?? JSON.stringify(val))
                          : String(val)}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Pricing
                  </Text>
                  {snapshot.pricingBreakdown ? (
                    <>
                      <Text as="p" variant="bodySm">
                        Base: ${snapshot.pricingBreakdown.basePrice ?? 0}
                      </Text>
                      {(snapshot.pricingBreakdown.modifiers ?? []).map((m, i) => (
                        <Text key={i} as="p" variant="bodySm">
                          {m.optionGroupName ?? 'Option'} → {m.optionValueName ?? 'Value'}:{' '}
                          {m.delta >= 0 ? '+' : ''}${m.delta}
                        </Text>
                      ))}
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="p" variant="bodyMd" fontWeight="bold">
                          Total: ${snapshot.pricingBreakdown.totalPrice ?? 0}
                        </Text>
                        {snapshot.pricingBreakdown.isTradePrice ? (
                          <Badge tone="magic">Trade</Badge>
                        ) : null}
                      </InlineStack>
                    </>
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">
                      No pricing breakdown available
                    </Text>
                  )}
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Components
                  </Text>
                  {(snapshot.componentMappings ?? []).length > 0 ? (
                    (snapshot.componentMappings ?? []).map((c, i) => (
                      <InlineStack key={i} gap="200">
                        <Badge>{c.type ?? 'Component'}</Badge>
                        <Text as="span" variant="bodySm">
                          {c.name ?? 'Unnamed component'}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          SKU: {c.sku ?? 'N/A'} × {c.quantity ?? 0}
                        </Text>
                      </InlineStack>
                    ))
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">
                      No components mapped
                    </Text>
                  )}
                </BlockStack>

                <Divider />

                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Rule Version: {snapshot.ruleVersionId ?? 'N/A'}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Signature:{' '}
                    {snapshot.validationSignature
                      ? `${snapshot.validationSignature.slice(0, 30)}...`
                      : 'N/A'}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Created: {new Date(snapshot.createdAt).toLocaleString()}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        {orderRes ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Order Resolution
                </Text>
                <Text as="p" variant="bodySm">
                  Shopify Order: {orderRes.shopifyOrderName ?? orderRes.shopifyOrderId ?? 'N/A'}
                </Text>
                <Text as="p" variant="bodySm">
                  Line Item ID: {orderRes.shopifyLineItemId ?? 'N/A'}
                </Text>
                <Text as="p" variant="bodySm">
                  Fulfilment: {orderRes.fulfilmentStatus ?? 'Pending'}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}