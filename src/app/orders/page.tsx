'use client';

import { Page, Card, Text, BlockStack } from '@shopify/polaris';

export default function OrdersPage() {
  return (
    <Page title="Orders" backAction={{ content: 'Dashboard', url: '/' }}>
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Orders
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            This page will show saved configuration snapshots attached to Shopify
            orders.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}