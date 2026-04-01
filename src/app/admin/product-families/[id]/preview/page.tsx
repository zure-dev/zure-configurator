'use client';

import { useState, useEffect } from 'react';
import { Page, Layout, Card, Banner, BlockStack, Text, Select, InlineStack, Checkbox } from '@shopify/polaris';
import { useParams } from 'next/navigation';

export default function PreviewPage() {
  const params = useParams();
  const familyId = params.id as string;
  const [family, setFamily] = useState<any>(null);
  const [isTradeCustomer, setIsTradeCustomer] = useState(false);
  const [viewportWidth, setViewportWidth] = useState('100%');

  useEffect(() => {
    fetch(`/api/product-families/${familyId}`)
      .then((r) => r.json())
      .then((d) => setFamily(d.family));
  }, [familyId]);

  const shopifyProductId = family?.shopifyLink?.shopifyProductId ?? 'preview-mode';
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Page
      title="Configurator Preview"
      backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="400" blockAlign="center">
                <Select
                  label="Viewport"
                  labelInline
                  options={[
                    { label: 'Desktop (100%)', value: '100%' },
                    { label: 'Tablet (768px)', value: '768px' },
                    { label: 'Mobile (375px)', value: '375px' },
                  ]}
                  value={viewportWidth}
                  onChange={setViewportWidth}
                />
                <Checkbox
                  label="Trade customer"
                  checked={isTradeCustomer}
                  onChange={setIsTradeCustomer}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {!family?.shopifyLink ? (
            <Banner tone="warning">
              No Shopify product linked. Link a product first to test the full flow.
              The preview below will use mock data.
            </Banner>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <Card>
              <div
                style={{
                  maxWidth: viewportWidth,
                  margin: '0 auto',
                  border: viewportWidth !== '100%' ? '1px solid #e5e5e5' : 'none',
                  borderRadius: 8,
                  overflow: 'hidden',
                  minHeight: 600,
                }}
              >
                {/* 
                  In production, this would load the actual compiled widget bundle.
                  For preview in the admin, we use an iframe pointing to a preview endpoint
                  that serves the widget with the product family data.
                */}
                <div
                  id="zure-configurator-root"
                  data-product-id={shopifyProductId}
                  data-shop="preview.myshopify.com"
                  data-app-url={appUrl}
                  style={{ padding: 20 }}
                >
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      {family?.name ?? 'Product Configurator'}
                    </Text>
                    <Text as="p" tone="subdued">
                      Live preview requires the widget bundle to be loaded. In production, the widget
                      renders here automatically via the Theme App Extension.
                    </Text>

                    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 20 }}>
                      <Text as="h3" variant="headingMd">Configuration Summary</Text>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm">Base Price: ${Number(family?.basePrice ?? 0).toFixed(2)}</Text>
                        <Text as="p" variant="bodySm">Option Groups: {family?.optionGroups?.length ?? 0}</Text>
                        <Text as="p" variant="bodySm">Dependency Rules: {family?.dependencyRules?.length ?? 0}</Text>
                        <Text as="p" variant="bodySm">Exclusion Rules: {family?.exclusionRules?.length ?? 0}</Text>
                        <Text as="p" variant="bodySm">Price Rules: {family?.priceRules?.length ?? 0} retail, {family?.tradePriceRules?.length ?? 0} trade</Text>
                        <Text as="p" variant="bodySm">Media Rules: {family?.mediaRules?.length ?? 0}</Text>
                        <Text as="p" variant="bodySm">Components: {family?.components?.length ?? 0}</Text>
                      </BlockStack>
                    </div>

                    {family?.optionGroups?.map((group: any) => (
                      <div key={group.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}>
                        <Text as="h3" variant="headingSm">{group.name}</Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {group.values?.map((v: any, i: number) => (
                            <div
                              key={v.slug}
                              style={{
                                padding: '8px 16px',
                                border: i === 0 ? '2px solid #1a1a1a' : '1px solid #e5e5e5',
                                borderRadius: 6,
                                fontSize: 14,
                                cursor: 'pointer',
                                background: i === 0 ? '#fafafa' : '#fff',
                              }}
                            >
                              {v.swatchColor && (
                                <span style={{
                                  display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                                  backgroundColor: v.swatchColor, marginRight: 6, verticalAlign: 'middle',
                                  border: '1px solid #ddd',
                                }} />
                              )}
                              {v.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </BlockStack>
                </div>
              </div>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
