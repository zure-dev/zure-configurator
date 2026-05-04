'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Banner,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  Spinner,
  Tabs,
  Divider,
} from '@shopify/polaris';
import { useParams } from 'next/navigation';

interface PriceRuleRow {
  optionGroupSlug: string;
  optionValueSlug: string;
  priceModifier: string;
  modifierType: string;
  groupName: string;
  valueName: string;
}

interface OptionValueData {
  slug: string;
  name: string;
}

interface OptionGroupData {
  slug: string;
  name: string;
  values?: OptionValueData[];
}

export default function PricingEditorPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [retailRules, setRetailRules] = useState<PriceRuleRow[]>([]);
  const [tradeRules, setTradeRules] = useState<PriceRuleRow[]>([]);
  const [groups, setGroups] = useState<OptionGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [retailRes, tradeRes, optionsRes] = await Promise.all([
        fetch(`/api/rules/pricing?familyId=${familyId}`),
        fetch(`/api/rules/trade-pricing?familyId=${familyId}`),
        fetch(`/api/options?familyId=${familyId}`),
      ]);

      const retailData = await retailRes.json();
      const tradeData = await tradeRes.json();
      const optionsData = await optionsRes.json();

      const groupsList: OptionGroupData[] = optionsData.optionGroups ?? [];
      setGroups(groupsList);

      const mapRules = (rules: Array<any>) =>
        rules.map((r) => {
          const group = groupsList.find((g) => g.slug === r.optionGroupSlug);
          const value = group?.values?.find((v) => v.slug === r.optionValueSlug);

          return {
            optionGroupSlug: r.optionGroupSlug,
            optionValueSlug: r.optionValueSlug,
            priceModifier: String(Number(r.priceModifier)),
            modifierType: r.modifierType ?? 'ADDITIVE',
            groupName: group?.name ?? r.optionGroupSlug,
            valueName: value?.name ?? r.optionValueSlug,
          };
        });

      setRetailRules(mapRules(retailData.rules ?? []));
      setTradeRules(mapRules(tradeData.rules ?? []));
    } catch {
      setErrorMsg('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveRetail = useCallback(async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const rules = retailRules
        .filter((r) => r.priceModifier !== '0' && r.priceModifier !== '')
        .map((r) => ({
          optionGroupSlug: r.optionGroupSlug,
          optionValueSlug: r.optionValueSlug,
          priceModifier: parseFloat(r.priceModifier),
          modifierType: r.modifierType,
        }));

      const res = await fetch('/api/rules/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productFamilyId: familyId, rules }),
      });

      if (!res.ok) {
        setErrorMsg('Failed to save');
        return;
      }

      setSuccessMsg('Retail pricing saved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  }, [familyId, retailRules]);

  const handleSaveTrade = useCallback(async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const rules = tradeRules
        .filter((r) => r.priceModifier !== '0' && r.priceModifier !== '')
        .map((r) => ({
          optionGroupSlug: r.optionGroupSlug,
          optionValueSlug: r.optionValueSlug,
          priceModifier: parseFloat(r.priceModifier),
          modifierType: r.modifierType,
          tradeCondition: { type: 'customer_tag', value: 'trade' },
        }));

      const res = await fetch('/api/rules/trade-pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productFamilyId: familyId, rules }),
      });

      if (!res.ok) {
        setErrorMsg('Failed to save');
        return;
      }

      setSuccessMsg('Trade pricing saved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  }, [familyId, tradeRules]);

  const buildFullGrid = (existingRules: PriceRuleRow[]): PriceRuleRow[] => {
    const grid: PriceRuleRow[] = [];

    for (const group of groups) {
      for (const value of group.values ?? []) {
        const existing = existingRules.find(
          (r) =>
            r.optionGroupSlug === group.slug &&
            r.optionValueSlug === value.slug
        );

        grid.push(
          existing ?? {
            optionGroupSlug: group.slug,
            optionValueSlug: value.slug,
            priceModifier: '0',
            modifierType: 'ADDITIVE',
            groupName: group.name,
            valueName: value.name,
          }
        );
      }
    }

    return grid;
  };

  const renderPriceGrid = (
    grid: PriceRuleRow[],
    setRules: React.Dispatch<React.SetStateAction<PriceRuleRow[]>>
  ) => {
    let currentGroup = '';

    return grid.map((row, i) => {
      const showHeader = row.groupName !== currentGroup;
      currentGroup = row.groupName;

      const numericModifier = parseFloat(row.priceModifier || '0');

      return (
        <div key={`${row.optionGroupSlug}-${row.optionValueSlug}`}>
          {showHeader ? (
            <div style={{ marginTop: i > 0 ? 16 : 0, marginBottom: 8 }}>
              <Text as="h3" variant="headingSm">
                {row.groupName}
              </Text>
            </div>
          ) : null}

          <InlineStack gap="300" blockAlign="center">
            <div style={{ width: 180 }}>
              <Text as="span" variant="bodyMd">
                {row.valueName}
              </Text>
            </div>

            <div style={{ width: 120 }}>
              <TextField
                label=""
                labelHidden
                value={row.priceModifier}
                onChange={(value) => {
                  setRules((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex(
                      (r) =>
                        r.optionGroupSlug === row.optionGroupSlug &&
                        r.optionValueSlug === row.optionValueSlug
                    );

                    if (idx >= 0) {
                      next[idx] = { ...next[idx]!, priceModifier: value };
                    } else {
                      next.push({ ...row, priceModifier: value });
                    }

                    return next;
                  });
                }}
                prefix="$"
                type="number"
                autoComplete="off"
              />
            </div>

            <div style={{ width: 100 }}>
              {numericModifier > 0 ? (
                <Badge tone="success">{`+$${row.priceModifier}`}</Badge>
              ) : null}

              {numericModifier < 0 ? (
                <Badge tone="critical">{`$${row.priceModifier}`}</Badge>
              ) : null}

              {numericModifier === 0 ? <Badge>Base</Badge> : null}
            </div>
          </InlineStack>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <Page
        title="Pricing"
        backAction={{ content: 'Back', url: `/admin/product-families/${familyId}` }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  const retailGrid = buildFullGrid(retailRules);
  const tradeGrid = buildFullGrid(tradeRules);

  const tabs = [
    { id: 'retail', content: 'Retail Pricing', panelID: 'retail-panel' },
    { id: 'trade', content: 'Trade Pricing', panelID: 'trade-panel' },
  ];

  return (
    <Page
      title="Pricing Rules"
      backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
    >
      {successMsg ? (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="success" onDismiss={() => setSuccessMsg('')}>
            {successMsg}
          </Banner>
        </div>
      ) : null}

      {errorMsg ? (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="critical" onDismiss={() => setErrorMsg('')}>
            {errorMsg}
          </Banner>
        </div>
      ) : null}

      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        {selectedTab === 0 ? (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Retail Price Modifiers
                    </Text>
                    <Button variant="primary" onClick={handleSaveRetail} loading={saving}>
                      Save Retail Pricing
                    </Button>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    Set the price adjustment for each option value. Positive values add to the
                    base price, negative values subtract.
                  </Text>

                  <Divider />

                  {renderPriceGrid(retailGrid, setRetailRules)}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        ) : null}

        {selectedTab === 1 ? (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Trade Price Modifiers
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Applied when customer has the &quot;trade&quot; tag. Leave at $0 to use
                        retail pricing for that option.
                      </Text>
                    </BlockStack>

                    <Button variant="primary" onClick={handleSaveTrade} loading={saving}>
                      Save Trade Pricing
                    </Button>
                  </InlineStack>

                  <Divider />

                  {renderPriceGrid(tradeGrid, setTradeRules)}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        ) : null}
      </Tabs>
    </Page>
  );
}