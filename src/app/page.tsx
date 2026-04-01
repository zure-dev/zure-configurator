'use client';

import Link from 'next/link';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
} from '@shopify/polaris';

function DashboardCard({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ cursor: 'pointer' }}>
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingMd">
                {title}
              </Text>
              {badge ? <Badge tone="success">{badge}</Badge> : null}
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">
              {description}
            </Text>
          </BlockStack>
        </Card>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <Page title="Zure Configurator">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Welcome to Zure Configurator
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Manage your configurable product families, option groups, pricing rules,
                and media mappings. Configure everything your customers need to build
                their perfect product.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <DashboardCard
            title="Product Families"
            description="Create and manage configurable product families."
            href="/product-families"
            badge="Active"
          />
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <DashboardCard
            title="Rules Engine"
            description="Dependencies, exclusions, pricing, media, and component mappings."
            href="/rules"
          />
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <DashboardCard
            title="Orders"
            description="View configuration snapshots attached to Shopify orders."
            href="/orders"
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}