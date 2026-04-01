'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  Tabs,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  Spinner,
  Divider,
} from '@shopify/polaris';
import { useParams, useRouter } from 'next/navigation';

interface ProductFamilyFull {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  basePrice: string;
  shopifyLink: any;
  optionGroups: any[];
  dependencyRules: any[];
  exclusionRules: any[];
  priceRules: any[];
  tradePriceRules: any[];
  mediaRules: any[];
  summaryRules: any[];
  components: any[];
  ruleVersions: any[];
}

export default function ProductFamilyEditPage() {
  const params = useParams();
  const router = useRouter();
  const [family, setFamily] = useState<ProductFamilyFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [formState, setFormState] = useState({ name: '', slug: '', description: '', basePrice: '', status: '' });
  const [successBanner, setSuccessBanner] = useState(false);

  const fetchFamily = useCallback(async () => {
    try {
      const res = await fetch(`/api/product-families/${params.id}`);
      const data = await res.json();
      const f = data.family;
      setFamily(f);
      setFormState({
        name: f.name,
        slug: f.slug,
        description: f.description ?? '',
        basePrice: Number(f.basePrice).toString(),
        status: f.status,
      });
    } catch (e) {
      console.error('Failed to fetch family', e);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/product-families/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          slug: formState.slug,
          description: formState.description || null,
          basePrice: parseFloat(formState.basePrice) || 0,
          status: formState.status,
        }),
      });
      setSuccessBanner(true);
      setTimeout(() => setSuccessBanner(false), 3000);
    } catch (e) {
      console.error('Failed to save', e);
    } finally {
      setSaving(false);
    }
  }, [params.id, formState]);

  if (loading) {
    return (
      <Page title="Loading...">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  if (!family) {
    return (
      <Page title="Not Found">
        <Banner tone="critical">Product family not found.</Banner>
      </Page>
    );
  }

  const tabs = [
    { id: 'details', content: 'Details', panelID: 'details-panel' },
    { id: 'options', content: `Options (${family.optionGroups.length})`, panelID: 'options-panel' },
    { id: 'rules', content: `Rules (${family.dependencyRules.length + family.exclusionRules.length})`, panelID: 'rules-panel' },
    { id: 'pricing', content: `Pricing (${family.priceRules.length})`, panelID: 'pricing-panel' },
    { id: 'media', content: `Media (${family.mediaRules.length})`, panelID: 'media-panel' },
    { id: 'components', content: `Components (${family.components.length})`, panelID: 'components-panel' },
  ];

  return (
    <Page
      title={family.name}
      backAction={{ content: 'Product Families', url: '/admin/product-families' }}
      titleMetadata={
        family.status === 'ACTIVE'
          ? <Badge tone="success">Active</Badge>
          : <Badge>Draft</Badge>
      }
      primaryAction={{ content: 'Save', onAction: handleSave, loading: saving }}
      secondaryActions={[
        { content: 'Preview', url: `/admin/product-families/${family.id}/preview` },
        { content: 'Export', url: `/api/import-export/export?familyId=${family.id}` },
      ]}
    >
      {successBanner && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="success" onDismiss={() => setSuccessBanner(false)}>
            Product family saved successfully.
          </Banner>
        </div>
      )}

      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        {selectedTab === 0 && (
          <Layout>
            <Layout.Section>
              <Card>
                <FormLayout>
                  <TextField
                    label="Name"
                    value={formState.name}
                    onChange={(v) => setFormState((s) => ({ ...s, name: v }))}
                    autoComplete="off"
                  />
                  <TextField
                    label="Slug"
                    value={formState.slug}
                    onChange={(v) => setFormState((s) => ({ ...s, slug: v }))}
                    helpText="URL-friendly identifier. Used in API endpoints."
                    autoComplete="off"
                  />
                  <TextField
                    label="Description"
                    value={formState.description}
                    onChange={(v) => setFormState((s) => ({ ...s, description: v }))}
                    multiline={3}
                    autoComplete="off"
                  />
                  <TextField
                    label="Base Price (AUD)"
                    value={formState.basePrice}
                    onChange={(v) => setFormState((s) => ({ ...s, basePrice: v }))}
                    type="number"
                    prefix="$"
                    autoComplete="off"
                  />
                  <Select
                    label="Status"
                    options={[
                      { label: 'Draft', value: 'DRAFT' },
                      { label: 'Active', value: 'ACTIVE' },
                      { label: 'Archived', value: 'ARCHIVED' },
                    ]}
                    value={formState.status}
                    onChange={(v) => setFormState((s) => ({ ...s, status: v }))}
                  />
                </FormLayout>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Shopify Product</Text>
                  {family.shopifyLink ? (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd">
                        Linked to: /{family.shopifyLink.shopifyProductHandle}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Product ID: {family.shopifyLink.shopifyProductId}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Variant ID: {family.shopifyLink.shopifyVariantId}
                      </Text>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        No Shopify product linked yet.
                      </Text>
                      <Button size="slim">Link Shopify Product</Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <div style={{ marginTop: 16 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">Stats</Text>
                    <Text as="p" variant="bodySm">{family.optionGroups.length} option groups</Text>
                    <Text as="p" variant="bodySm">{family.dependencyRules.length} dependency rules</Text>
                    <Text as="p" variant="bodySm">{family.exclusionRules.length} exclusion rules</Text>
                    <Text as="p" variant="bodySm">{family.priceRules.length} retail price rules</Text>
                    <Text as="p" variant="bodySm">{family.tradePriceRules.length} trade price rules</Text>
                    <Text as="p" variant="bodySm">{family.mediaRules.length} media rules</Text>
                    <Text as="p" variant="bodySm">{family.components.length} components</Text>
                    <Divider />
                    <Text as="p" variant="bodySm" tone="subdued">
                      Latest rule version: v{family.ruleVersions[0]?.version ?? 'none'}
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 1 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">Option Groups</Text>
                    <Button size="slim" url={`/admin/product-families/${family.id}/options`}>
                      Manage Options
                    </Button>
                  </InlineStack>
                  {family.optionGroups.map((group) => (
                    <Card key={group.id}>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span" fontWeight="semibold">{group.name}</Text>
                            <Badge>{group.displayType}</Badge>
                            {group.isRequired && <Badge tone="info">Required</Badge>}
                          </InlineStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {group.values.length} values · Step {group.stepNumber ?? group.sortOrder}
                          </Text>
                        </BlockStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {group.values.map((v: any) => v.name).join(', ')}
                        </Text>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 2 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">Dependency Rules</Text>
                    <Button size="slim" url={`/admin/product-families/${family.id}/rules`}>
                      Manage Rules
                    </Button>
                  </InlineStack>
                  {family.dependencyRules.map((rule) => (
                    <Card key={rule.id}>
                      <Text as="p" variant="bodyMd">
                        <strong>WHEN</strong> {rule.whenOptionGroupSlug} = {rule.whenOptionValueSlug}{' '}
                        <strong>THEN</strong> {rule.thenOptionGroupSlug} allows [{rule.thenOptionValueSlugs.join(', ')}]
                      </Text>
                      {rule.name && <Text as="p" variant="bodySm" tone="subdued">{rule.name}</Text>}
                    </Card>
                  ))}

                  <Divider />

                  <Text as="h3" variant="headingMd">Exclusion Rules</Text>
                  {family.exclusionRules.map((rule) => (
                    <Card key={rule.id}>
                      <Text as="p" variant="bodyMd">
                        <strong>WHEN</strong> {rule.whenOptionGroupSlug} = {rule.whenOptionValueSlug}{' '}
                        <strong>EXCLUDE</strong> {rule.excludeOptionGroupSlug} → [{rule.excludeOptionValueSlugs.join(', ')}]
                      </Text>
                      {rule.name && <Text as="p" variant="bodySm" tone="subdued">{rule.name}</Text>}
                    </Card>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 3 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">Retail Price Rules</Text>
                    <Button size="slim" url={`/admin/product-families/${family.id}/pricing`}>
                      Manage Pricing
                    </Button>
                  </InlineStack>
                  {family.priceRules.map((rule) => (
                    <InlineStack key={rule.id} align="space-between">
                      <Text as="span" variant="bodyMd">
                        {rule.optionGroupSlug} → {rule.optionValueSlug}
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {Number(rule.priceModifier) >= 0 ? '+' : ''}${Number(rule.priceModifier).toFixed(2)}
                      </Text>
                    </InlineStack>
                  ))}

                  {family.tradePriceRules.length > 0 && (
                    <>
                      <Divider />
                      <Text as="h3" variant="headingMd">Trade Price Rules</Text>
                      {family.tradePriceRules.map((rule) => (
                        <InlineStack key={rule.id} align="space-between">
                          <InlineStack gap="200">
                            <Text as="span" variant="bodyMd">
                              {rule.optionGroupSlug} → {rule.optionValueSlug}
                            </Text>
                            <Badge tone="magic">Trade</Badge>
                          </InlineStack>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {Number(rule.priceModifier) >= 0 ? '+' : ''}${Number(rule.priceModifier).toFixed(2)}
                          </Text>
                        </InlineStack>
                      ))}
                    </>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 4 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">Media Rules</Text>
                    <Button size="slim" url={`/admin/product-families/${family.id}/media`}>
                      Manage Media
                    </Button>
                  </InlineStack>
                  {family.mediaRules.map((rule) => (
                    <Card key={rule.id}>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text as="span" fontWeight="semibold">{rule.name ?? 'Unnamed rule'}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            Priority: {rule.priority} · {(rule.conditions as any[]).map((c: any) => `${c.optionGroupSlug}=${c.optionValueSlug}`).join(' + ')}
                          </Text>
                        </BlockStack>
                        <Text as="span" variant="bodySm">
                          {(rule.mediaSet as any[]).length} images
                        </Text>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 5 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Components (Internal SKUs)</Text>
                  {family.components.map((comp) => (
                    <InlineStack key={comp.id} align="space-between">
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{comp.name}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">{comp.sku}</Text>
                      </BlockStack>
                      <Badge>{comp.type}</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </Tabs>
    </Page>
  );
}
