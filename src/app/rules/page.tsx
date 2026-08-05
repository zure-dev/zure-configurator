'use client';

import { Page, Layout, Card, Text, BlockStack, Badge, Divider } from '@shopify/polaris';
import { useRouter } from 'next/navigation';
import { getShopDomain } from '@/lib/api-client';

export default function RulesPage() {
  const router = useRouter();
  const shop = getShopDomain();

  return (
    <Page
      title="Rules Engine"
      backAction={{ content: 'Dashboard', onAction: () => router.push(shop ? `/?shop=${shop}` : '/') }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineHeader title="Rules Engine" badge="Coming Soon" />
              <Text as="p" variant="bodyMd">
                The Rules Engine will let you define advanced logic for your product configurator
                without writing code. Rules are evaluated on every customer selection to control
                what options are available, how pricing works, and what media is shown.
              </Text>
              <Divider />
              <RuleCategory
                title="Dependency Rules"
                description="When a customer selects option A, automatically show or require option B."
                example='e.g. Selecting "Double Bowl" basin requires "1500mm" cabinet size'
              />
              <RuleCategory
                title="Exclusion Rules"
                description="When a customer selects option A, hide or disable option B."
                example='e.g. Selecting "Wall Hung" excludes "Floor Standing" basin options'
              />
              <RuleCategory
                title="Price Rules"
                description="Adjust pricing based on selections. Supports additive, percentage, and override modifiers."
                example='e.g. Upgrading to "Stone Top" adds $350 to the configured price'
              />
              <RuleCategory
                title="Media Rules"
                description="Swap product images based on selected options."
                example='e.g. Selecting "Matte Black" handles shows the vanity with dark hardware'
              />
              <RuleCategory
                title="Component Mapping"
                description="Map option combinations to specific SKUs for fulfilment."
                example='e.g. 1200mm + Carrara + Undermount → maps to SKU BOS-1200-CAR-UM'
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function InlineHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Text as="h2" variant="headingMd">{title}</Text>
      <Badge tone="attention">{badge}</Badge>
    </div>
  );
}

function RuleCategory({ title, description, example }: { title: string; description: string; example: string }) {
  return (
    <div style={{ padding: '12px 0' }}>
      <Text as="span" variant="bodyMd" fontWeight="semibold">{title}</Text>
      <Text as="p" variant="bodySm">{description}</Text>
      <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{example}</Text>
    </div>
  );
}
