'use client';

import { useState } from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  TextField,
  Spinner,
  Banner,
  Divider,
} from '@shopify/polaris';
import { useConfigurator } from '@/lib/configurator';

export default function ConfiguratorTestPage() {
  const [familyId, setFamilyId] = useState('');
  const [activeFamilyId, setActiveFamilyId] = useState('');

  return (
    <Page title="Configurator Test">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Load a Product Family</Text>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Product Family ID"
                    value={familyId}
                    onChange={setFamilyId}
                    placeholder="Paste a product family ID"
                    autoComplete="off"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={() => setActiveFamilyId(familyId)}
                  disabled={!familyId.trim()}
                >
                  Load
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {activeFamilyId && (
          <ConfiguratorPanel key={activeFamilyId} productFamilyId={activeFamilyId} />
        )}
      </Layout>
    </Page>
  );
}

function ConfiguratorPanel({ productFamilyId }: { productFamilyId: string }) {
  const {
    state,
    select,
    isDisabled,
    getDisabledReason,
    getAllowedValues,
  } = useConfigurator(productFamilyId);

  if (state.isLoading) {
    return (
      <Layout.Section>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Layout.Section>
    );
  }

  if (state.error && state.optionGroups.length === 0) {
    return (
      <Layout.Section>
        <Banner tone="critical" title="Failed to load">{state.error}</Banner>
      </Layout.Section>
    );
  }

  const pricing = state.pricing;

  return (
    <>
      {/* Auto-cleared notice */}
      {state.autoClearedGroups.length > 0 && (
        <Layout.Section>
          <Banner tone="warning" title="Selections adjusted">
            The following selections were automatically changed because they became
            invalid: {state.autoClearedGroups.join(', ')}
          </Banner>
        </Layout.Section>
      )}

      {/* Live pricing summary bar */}
      {pricing && (
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="400" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="span" variant="bodySm" tone="subdued">Base price</Text>
                  <Text as="span" variant="bodyMd">${pricing.basePrice.toFixed(2)}</Text>
                </BlockStack>
                {pricing.lineItems.length > 0 && (
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">Modifiers</Text>
                    <Text as="span" variant="bodyMd">
                      {pricing.subtotal >= 0 ? '+' : ''}${pricing.subtotal.toFixed(2)}
                    </Text>
                  </BlockStack>
                )}
              </InlineStack>
              <BlockStack gap="050" inlineAlign="end">
                <Text as="span" variant="bodySm" tone="subdued">Total</Text>
                <Text as="span" variant="headingLg">
                  ${pricing.total.toFixed(2)} {pricing.currency}
                </Text>
              </BlockStack>
            </InlineStack>
          </Card>
        </Layout.Section>
      )}

      {/* Option groups */}
      <Layout.Section>
        <BlockStack gap="400">
          {state.optionGroups.map((group) => {
            const selectedSlug = state.selections[group.slug];

            return (
              <Card key={group.id}>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h3" variant="headingSm">{group.name}</Text>
                    <Badge>{group.displayType}</Badge>
                    {group.isRequired && <Badge tone="info">Required</Badge>}
                    {group.stepNumber != null && (
                      <Text as="span" variant="bodySm" tone="subdued">Step {group.stepNumber}</Text>
                    )}
                  </InlineStack>

                  {group.helperText && (
                    <Text as="p" variant="bodySm" tone="subdued">{group.helperText}</Text>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {group.values.map((value) => {
                      const isSelected = selectedSlug === value.slug;
                      const disabled = isDisabled(group.slug, value.slug);
                      const reason = getDisabledReason(group.slug, value.slug);

                      return (
                        <button
                          key={value.slug}
                          onClick={() => !disabled && select(group.slug, value.slug)}
                          disabled={disabled}
                          title={disabled ? reason ?? 'Not available' : value.name}
                          style={{
                            padding: '8px 16px',
                            border: isSelected ? '2px solid #1a1a1a' : '1px solid #e0e0e0',
                            borderRadius: 8,
                            background: disabled ? '#f5f5f5' : isSelected ? '#f0f7ff' : '#fff',
                            color: disabled ? '#999' : '#1a1a1a',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                            fontFamily: 'inherit',
                            textDecoration: disabled ? 'line-through' : 'none',
                            opacity: disabled ? 0.5 : 1,
                          }}
                        >
                          {value.swatchColor && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                backgroundColor: value.swatchColor,
                                border: '1px solid #ddd',
                                marginRight: 6,
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                          {value.name}
                          {isSelected && ' ✓'}
                        </button>
                      );
                    })}
                  </div>

                  {(state.disabled[group.slug] ?? []).length > 0 && (
                    <BlockStack gap="100">
                      {state.disabled[group.slug]!.map((d) => (
                        <Text key={d.slug} as="p" variant="bodySm" tone="caution">
                          ⚠ {d.slug}: {d.reason}
                        </Text>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            );
          })}
        </BlockStack>
      </Layout.Section>

      {/* Pricing breakdown */}
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">Pricing Breakdown</Text>
              {state.isPricing && <Spinner size="small" />}
            </InlineStack>

            {pricing ? (
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Base price</Text>
                  <Text as="span" variant="bodyMd">${pricing.basePrice.toFixed(2)}</Text>
                </InlineStack>

                {pricing.lineItems.map((item, i) => (
                  <InlineStack key={i} align="space-between">
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.optionGroupSlug}
                      </Text>
                      <Text as="span" variant="bodySm">{item.description}</Text>
                    </InlineStack>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {item.amount >= 0 ? '+' : ''}${item.amount.toFixed(2)}
                    </Text>
                  </InlineStack>
                ))}

                {pricing.lineItems.length === 0 && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No price modifiers applied for current selections
                  </Text>
                )}

                <Divider />

                <InlineStack align="space-between">
                  <Text as="span" variant="headingSm">Total</Text>
                  <Text as="span" variant="headingSm">
                    ${pricing.total.toFixed(2)} {pricing.currency}
                  </Text>
                </InlineStack>
              </BlockStack>
            ) : (
              <Text as="p" variant="bodySm" tone="subdued">
                {state.isPricing ? 'Calculating...' : 'Select options to see pricing'}
              </Text>
            )}
          </BlockStack>
        </Card>
      </Layout.Section>

      {/* Debug: state */}
      <Layout.Section>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">Current Selections</Text>
              {state.isEvaluating && <Spinner size="small" />}
            </InlineStack>
            <pre style={{ fontSize: 12, background: '#f8f8f8', padding: 12, borderRadius: 6, overflow: 'auto' }}>
              {JSON.stringify(state.selections, null, 2)}
            </pre>

            <Divider />

            <Text as="h3" variant="headingSm">
              Fired Rules ({state.firedRules.length})
            </Text>
            {state.firedRules.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">No rules fired</Text>
            ) : (
              <BlockStack gap="100">
                {state.firedRules.map((rule) => (
                  <InlineStack key={rule.id} gap="200">
                    <Badge tone={rule.type === 'dependency' ? 'info' : 'warning'}>
                      {rule.type}
                    </Badge>
                    <Text as="span" variant="bodySm">
                      {rule.trigger} → {rule.effect}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
    </>
  );
}
