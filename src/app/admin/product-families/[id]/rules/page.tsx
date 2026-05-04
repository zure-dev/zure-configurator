'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page, Layout, Card, FormLayout, TextField, Select, Button, Banner,
  InlineStack, BlockStack, Text, Badge, Spinner, Modal, Divider,
} from '@shopify/polaris';
import { useParams } from 'next/navigation';

interface RuleData {
  id: string;
  name?: string;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
}

interface DependencyRule extends RuleData {
  thenOptionGroupSlug: string;
  thenOptionValueSlugs: string[];
}

interface ExclusionRule extends RuleData {
  excludeOptionGroupSlug: string;
  excludeOptionValueSlugs: string[];
}

interface OptionGroupInfo {
  slug: string;
  name: string;
  values: { slug: string; name: string }[];
}

export default function RulesEditorPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [deps, setDeps] = useState<DependencyRule[]>([]);
  const [excs, setExcs] = useState<ExclusionRule[]>([]);
  const [groups, setGroups] = useState<OptionGroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAddDep, setShowAddDep] = useState(false);
  const [showAddExc, setShowAddExc] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newDep, setNewDep] = useState({
    name: '', whenGroup: '', whenValue: '', thenGroup: '', thenValues: [] as string[],
  });
  const [newExc, setNewExc] = useState({
    name: '', whenGroup: '', whenValue: '', excludeGroup: '', excludeValues: [] as string[],
  });

  const fetchData = useCallback(async () => {
    try {
      const [depsRes, excsRes, optionsRes] = await Promise.all([
        fetch(`/api/rules/dependencies?familyId=${familyId}`),
        fetch(`/api/rules/exclusions?familyId=${familyId}`),
        fetch(`/api/options?familyId=${familyId}`),
      ]);
      const depsData = await depsRes.json();
      const excsData = await excsRes.json();
      const optionsData = await optionsRes.json();

      setDeps(depsData.rules ?? []);
      setExcs(excsData.rules ?? []);
      setGroups((optionsData.optionGroups ?? []).map((g: any) => ({
        slug: g.slug, name: g.name,
        values: g.values.map((v: any) => ({ slug: v.slug, name: v.name })),
      })));
    } catch (e) {
      setErrorMsg('Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupOptions = groups.map((g) => ({ label: g.name, value: g.slug }));

  const getValuesForGroup = (slug: string) => {
    const group = groups.find((g) => g.slug === slug);
    return group?.values.map((v) => ({ label: v.name, value: v.slug })) ?? [];
  };

  const getGroupName = (slug: string) => groups.find((g) => g.slug === slug)?.name ?? slug;
  const getValueName = (groupSlug: string, valueSlug: string) => {
    const group = groups.find((g) => g.slug === groupSlug);
    return group?.values.find((v) => v.slug === valueSlug)?.name ?? valueSlug;
  };

  const handleAddDep = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/rules/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: familyId,
          name: newDep.name || `${newDep.whenGroup}=${newDep.whenValue} → ${newDep.thenGroup}`,
          whenOptionGroupSlug: newDep.whenGroup,
          whenOptionValueSlug: newDep.whenValue,
          thenOptionGroupSlug: newDep.thenGroup,
          thenOptionValueSlugs: newDep.thenValues,
        }),
      });
      if (!res.ok) { setErrorMsg('Failed to create rule'); return; }
      setShowAddDep(false);
      setNewDep({ name: '', whenGroup: '', whenValue: '', thenGroup: '', thenValues: [] });
      setSuccessMsg('Dependency rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } finally { setSaving(false); }
  }, [familyId, newDep, fetchData]);

  const handleAddExc = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/rules/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: familyId,
          name: newExc.name || `${newExc.whenGroup}=${newExc.whenValue} excludes ${newExc.excludeGroup}`,
          whenOptionGroupSlug: newExc.whenGroup,
          whenOptionValueSlug: newExc.whenValue,
          excludeOptionGroupSlug: newExc.excludeGroup,
          excludeOptionValueSlugs: newExc.excludeValues,
        }),
      });
      if (!res.ok) { setErrorMsg('Failed to create rule'); return; }
      setShowAddExc(false);
      setNewExc({ name: '', whenGroup: '', whenValue: '', excludeGroup: '', excludeValues: [] });
      setSuccessMsg('Exclusion rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } finally { setSaving(false); }
  }, [familyId, newExc, fetchData]);

  const handleDeleteRule = useCallback(async (type: 'dep' | 'exc', id: string) => {
    if (!confirm('Delete this rule?')) return;
    const endpoint = type === 'dep' ? 'dependencies' : 'exclusions';
    await fetch(`/api/rules/${endpoint}?id=${id}`, { method: 'DELETE' });
    setSuccessMsg('Rule deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Page title="Rules" backAction={{ content: 'Back', url: `/admin/product-families/${familyId}` }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
      </Page>
    );
  }

  return (
    <Page
      title="Configuration Rules"
      backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
    >
      {successMsg && <div style={{ marginBottom: 16 }}><Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner></div>}
      {errorMsg && <div style={{ marginBottom: 16 }}><Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner></div>}

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Dependency Rules</Text>
                <Button size="slim" onClick={() => setShowAddDep(true)}>Add Dependency</Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                When a specific value is selected, restrict another group to only allow certain values.
              </Text>
              {deps.map((rule) => (
                <Card key={rule.id}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd">
                        <strong>WHEN</strong> {getGroupName(rule.whenOptionGroupSlug)} = <Badge>{getValueName(rule.whenOptionGroupSlug, rule.whenOptionValueSlug)}</Badge>
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>THEN</strong> {getGroupName(rule.thenOptionGroupSlug)} only allows: {rule.thenOptionValueSlugs.map((s) => (
                          <Badge key={s} tone="success">{getValueName(rule.thenOptionGroupSlug, s)}</Badge>
                        ))}
                      </Text>
                      {rule.name && <Text as="p" variant="bodySm" tone="subdued">{rule.name}</Text>}
                    </BlockStack>
                    <Button size="slim" tone="critical" onClick={() => handleDeleteRule('dep', rule.id)}>Delete</Button>
                  </InlineStack>
                </Card>
              ))}
              {deps.length === 0 && <Text as="p" tone="subdued">No dependency rules.</Text>}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Exclusion Rules</Text>
                <Button size="slim" onClick={() => setShowAddExc(true)}>Add Exclusion</Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                When a specific value is selected, disable certain values in another group.
              </Text>
              {excs.map((rule) => (
                <Card key={rule.id}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd">
                        <strong>WHEN</strong> {getGroupName(rule.whenOptionGroupSlug)} = <Badge>{getValueName(rule.whenOptionGroupSlug, rule.whenOptionValueSlug)}</Badge>
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>EXCLUDE</strong> {getGroupName(rule.excludeOptionGroupSlug)} → {rule.excludeOptionValueSlugs.map((s) => (
                          <Badge key={s} tone="critical">{getValueName(rule.excludeOptionGroupSlug, s)}</Badge>
                        ))}
                      </Text>
                      {rule.name && <Text as="p" variant="bodySm" tone="subdued">{rule.name}</Text>}
                    </BlockStack>
                    <Button size="slim" tone="critical" onClick={() => handleDeleteRule('exc', rule.id)}>Delete</Button>
                  </InlineStack>
                </Card>
              ))}
              {excs.length === 0 && <Text as="p" tone="subdued">No exclusion rules.</Text>}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Add Dependency Modal */}
      <Modal open={showAddDep} onClose={() => setShowAddDep(false)} title="Add Dependency Rule"
        primaryAction={{ content: 'Create', onAction: handleAddDep, loading: saving, disabled: !newDep.whenGroup || !newDep.whenValue || !newDep.thenGroup || newDep.thenValues.length === 0 }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowAddDep(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Rule Name (optional)" value={newDep.name} onChange={(v) => setNewDep((s) => ({ ...s, name: v }))} autoComplete="off" />
            <Select label="WHEN group" options={[{ label: 'Select...', value: '' }, ...groupOptions]} value={newDep.whenGroup} onChange={(v) => setNewDep((s) => ({ ...s, whenGroup: v, whenValue: '' }))} />
            {newDep.whenGroup && (
              <Select label="WHEN value" options={[{ label: 'Select...', value: '' }, ...getValuesForGroup(newDep.whenGroup)]} value={newDep.whenValue} onChange={(v) => setNewDep((s) => ({ ...s, whenValue: v }))} />
            )}
            <Select label="THEN group (restrict)" options={[{ label: 'Select...', value: '' }, ...groupOptions.filter((g) => g.value !== newDep.whenGroup)]} value={newDep.thenGroup} onChange={(v) => setNewDep((s) => ({ ...s, thenGroup: v, thenValues: [] }))} />
            {newDep.thenGroup && (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">Select allowed values:</Text>
                {getValuesForGroup(newDep.thenGroup).map((opt) => (
                  <label key={opt.value} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newDep.thenValues.includes(opt.value)}
                      onChange={(e) => {
                        setNewDep((s) => ({
                          ...s,
                          thenValues: e.currentTarget.checked
                            ? [...s.thenValues, opt.value]
                            : s.thenValues.filter((v) => v !== opt.value),
                        }));
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </BlockStack>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Add Exclusion Modal */}
      <Modal open={showAddExc} onClose={() => setShowAddExc(false)} title="Add Exclusion Rule"
        primaryAction={{ content: 'Create', onAction: handleAddExc, loading: saving, disabled: !newExc.whenGroup || !newExc.whenValue || !newExc.excludeGroup || newExc.excludeValues.length === 0 }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowAddExc(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Rule Name (optional)" value={newExc.name} onChange={(v) => setNewExc((s) => ({ ...s, name: v }))} autoComplete="off" />
            <Select label="WHEN group" options={[{ label: 'Select...', value: '' }, ...groupOptions]} value={newExc.whenGroup} onChange={(v) => setNewExc((s) => ({ ...s, whenGroup: v, whenValue: '' }))} />
            {newExc.whenGroup && (
              <Select label="WHEN value" options={[{ label: 'Select...', value: '' }, ...getValuesForGroup(newExc.whenGroup)]} value={newExc.whenValue} onChange={(v) => setNewExc((s) => ({ ...s, whenValue: v }))} />
            )}
            <Select label="EXCLUDE from group" options={[{ label: 'Select...', value: '' }, ...groupOptions.filter((g) => g.value !== newExc.whenGroup)]} value={newExc.excludeGroup} onChange={(v) => setNewExc((s) => ({ ...s, excludeGroup: v, excludeValues: [] }))} />
            {newExc.excludeGroup && (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">Select values to exclude:</Text>
                {getValuesForGroup(newExc.excludeGroup).map((opt) => (
                  <label key={opt.value} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newExc.excludeValues.includes(opt.value)}
                      onChange={(e) => {
                        setNewExc((s) => ({
                          ...s,
                          excludeValues: e.currentTarget.checked
                            ? [...s.excludeValues, opt.value]
                            : s.excludeValues.filter((v) => v !== opt.value),
                        }));
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </BlockStack>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
