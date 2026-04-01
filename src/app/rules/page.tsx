'use client';

import { Page, Card, Text, BlockStack } from '@shopify/polaris';

export default function RulesPage() {
  return (
    <Page title="Rules Engine" backAction={{ content: 'Dashboard', url: '/' }}>
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Rules Engine
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            This page will manage dependencies, exclusions, pricing deltas,
            media switching, and SKU/component mapping.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}