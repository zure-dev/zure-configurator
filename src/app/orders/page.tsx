'use client';

import { Page, Layout, Card, Text, BlockStack, Badge, Divider } from '@shopify/polaris';
import { useRouter } from 'next/navigation';
import { getShopDomain } from '@/lib/api-client';

export default function OrdersPage() {
  const router = useRouter();
  const shop = getShopDomain();

  return (
    <Page
      title="Orders"
      backAction={{ content: 'Dashboard', onAction: () => router.push(shop ? `/?shop=${shop}` : '/') }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Text as="h2" variant="headingMd">Configuration Orders</Text>
                <Badge tone="attention">Coming Soon</Badge>
              </div>
              <Text as="p" variant="bodyMd">
                The Orders page will show all Shopify orders that include configured products,
                with the full configuration breakdown attached to each line item.
              </Text>
              <Divider />
              <FeaturePreview
                title="Configuration Traceability"
                description="See exactly which options a customer selected for each configured product in an order."
              />
              <FeaturePreview
                title="Product Family Insights"
                description="View which product families and option combinations are most popular across orders."
              />
              <FeaturePreview
                title="Order Search"
                description="Search and filter orders by product family, option group selection, or configuration value."
              />
              <FeaturePreview
                title="Fulfilment Support"
                description="View the component SKU breakdown for each configured order to streamline picking and packing."
              />
              <Divider />
              <Text as="p" variant="bodySm" tone="subdued">
                For now, configuration data is attached to each cart line item as properties.
                You can view these in Shopify Admin → Orders → click an order → line item properties
                (look for fields starting with _zure_).
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function FeaturePreview({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <Text as="span" variant="bodyMd" fontWeight="semibold">{title}</Text>
      <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
    </div>
  );
}
