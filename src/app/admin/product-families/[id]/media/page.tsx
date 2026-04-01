'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page, Layout, Card, FormLayout, TextField, Select, Button, Banner,
  InlineStack, BlockStack, Text, Badge, Spinner, Modal, Divider,
} from '@shopify/polaris';
import { useParams } from 'next/navigation';

interface MediaRuleData {
  id: string;
  name: string | null;
  priority: number;
  conditions: { optionGroupSlug: string; optionValueSlug: string }[];
  mediaSet: { url: string; alt: string; sortOrder: number; type: string }[];
  isActive: boolean;
}

export default function MediaEditorPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [rules, setRules] = useState<MediaRuleData[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [newRule, setNewRule] = useState({
    name: '',
    priority: '10',
    conditions: [{ optionGroupSlug: '', optionValueSlug: '' }] as { optionGroupSlug: string; optionValueSlug: string }[],
    mediaSet: [{ url: '', alt: '', sortOrder: 0, type: 'hero' }] as { url: string; alt: string; sortOrder: number; type: string }[],
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, optionsRes] = await Promise.all([
        fetch(`/api/media-rules?familyId=${familyId}`),
        fetch(`/api/options?familyId=${familyId}`),
      ]);
      setRules((await rulesRes.json()).rules ?? []);
      setGroups((await optionsRes.json()).optionGroups ?? []);
    } catch (e) {
      setErrorMsg('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupOptions = groups.map((g: any) => ({ label: g.name, value: g.slug }));
  const getValuesForGroup = (slug: string) =>
    (groups.find((g: any) => g.slug === slug)?.values ?? []).map((v: any) => ({ label: v.name, value: v.slug }));
  const getGroupName = (slug: string) => groups.find((g: any) => g.slug === slug)?.name ?? slug;
  const getValueName = (gs: string, vs: string) => {
    const g = groups.find((gr: any) => gr.slug === gs);
    return g?.values?.find((v: any) => v.slug === vs)?.name ?? vs;
  };

  const priorityLabel = (p: number) => {
    if (p <= 0) return 'Default';
    if (p <= 10) return 'Finish Override';
    if (p <= 20) return 'Category Override';
    return 'Exact Match';
  };

  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      const validConditions = newRule.conditions.filter((c) => c.optionGroupSlug && c.optionValueSlug);
      const validMedia = newRule.mediaSet.filter((m) => m.url);
      if (validConditions.length === 0 || validMedia.length === 0) {
        setErrorMsg('At least one condition and one media item required');
        return;
      }
      const res = await fetch('/api/media-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: familyId,
          name: newRule.name || null,
          priority: parseInt(newRule.priority) || 10,
          conditions: validConditions,
          mediaSet: validMedia,
        }),
      });
      if (!res.ok) { setErrorMsg('Failed to create'); return; }
      setShowAdd(false);
      setNewRule({
        name: '', priority: '10',
        conditions: [{ optionGroupSlug: '', optionValueSlug: '' }],
        mediaSet: [{ url: '', alt: '', sortOrder: 0, type: 'hero' }],
      });
      setSuccessMsg('Media rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } finally { setSaving(false); }
  }, [familyId, newRule, fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this media rule?')) return;
    await fetch(`/api/media-rules?id=${id}`, { method: 'DELETE' });
    setSuccessMsg('Deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Page title="Media Rules" backAction={{ content: 'Back', url: `/admin/product-families/${familyId}` }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
      </Page>
    );
  }

  return (
    <Page title="Media Rules" backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
      primaryAction={{ content: 'Add Media Rule', onAction: () => setShowAdd(true) }}>

      {successMsg && <div style={{ marginBottom: 16 }}><Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner></div>}
      {errorMsg && <div style={{ marginBottom: 16 }}><Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner></div>}

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Priority Cascade</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Higher priority rules override lower. Priority 0 = family default, 10 = finish override, 20 = category override, 30 = exact match.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
              <Card key={rule.id}>
                <InlineStack align="space-between" blockAlign="start">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" variant="headingSm">{rule.name ?? 'Unnamed'}</Text>
                      <Badge tone="info">Priority {rule.priority}</Badge>
                      <Badge>{priorityLabel(rule.priority)}</Badge>
                      {!rule.isActive && <Badge tone="warning">Inactive</Badge>}
                    </InlineStack>
                    <Text as="p" variant="bodySm">
                      <strong>Conditions:</strong>{' '}
                      {rule.conditions.map((c, i) => (
                        <span key={i}>
                          {i > 0 && ' AND '}
                          {getGroupName(c.optionGroupSlug)} = <Badge>{getValueName(c.optionGroupSlug, c.optionValueSlug)}</Badge>
                        </span>
                      ))}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Media:</strong> {rule.mediaSet.length} image(s)
                      {rule.mediaSet.map((m: any, i: number) => (
                        <span key={i} style={{ marginLeft: 8 }}>
                          <Badge>{m.type}</Badge> {m.url.split('/').pop()}
                        </span>
                      ))}
                    </Text>
                  </BlockStack>
                  <Button size="slim" tone="critical" onClick={() => handleDelete(rule.id)}>Delete</Button>
                </InlineStack>
              </Card>
            ))}
            {rules.length === 0 && (
              <Card>
                <Text as="p" tone="subdued" alignment="center">No media rules. The product family default images will be used.</Text>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Add Media Rule Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Media Rule" large
        primaryAction={{ content: 'Create', onAction: handleCreate, loading: saving }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowAdd(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Rule Name" value={newRule.name} onChange={(v) => setNewRule((s) => ({ ...s, name: v }))} autoComplete="off" />
            <Select label="Priority" options={[
              { label: '0 — Default', value: '0' },
              { label: '10 — Finish Override', value: '10' },
              { label: '20 — Category Override', value: '20' },
              { label: '30 — Exact Match', value: '30' },
            ]} value={newRule.priority} onChange={(v) => setNewRule((s) => ({ ...s, priority: v }))} />
          </FormLayout>
        </Modal.Section>

        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">Conditions (all must match)</Text>
              <Button size="slim" onClick={() => setNewRule((s) => ({
                ...s, conditions: [...s.conditions, { optionGroupSlug: '', optionValueSlug: '' }],
              }))}>Add Condition</Button>
            </InlineStack>
            {newRule.conditions.map((cond, ci) => (
              <InlineStack key={ci} gap="200" blockAlign="end">
                <Select label={ci === 0 ? 'Group' : ''} options={[{ label: 'Select...', value: '' }, ...groupOptions]}
                  value={cond.optionGroupSlug}
                  onChange={(v) => setNewRule((s) => {
                    const c = [...s.conditions]; c[ci] = { ...c[ci]!, optionGroupSlug: v, optionValueSlug: '' }; return { ...s, conditions: c };
                  })} />
                {cond.optionGroupSlug && (
                  <Select label={ci === 0 ? 'Value' : ''} options={[{ label: 'Select...', value: '' }, ...getValuesForGroup(cond.optionGroupSlug)]}
                    value={cond.optionValueSlug}
                    onChange={(v) => setNewRule((s) => {
                      const c = [...s.conditions]; c[ci] = { ...c[ci]!, optionValueSlug: v }; return { ...s, conditions: c };
                    })} />
                )}
                {newRule.conditions.length > 1 && (
                  <Button size="slim" tone="critical" onClick={() => setNewRule((s) => ({
                    ...s, conditions: s.conditions.filter((_, i) => i !== ci),
                  }))}>×</Button>
                )}
              </InlineStack>
            ))}
          </BlockStack>
        </Modal.Section>

        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">Media Set</Text>
              <Button size="slim" onClick={() => setNewRule((s) => ({
                ...s, mediaSet: [...s.mediaSet, { url: '', alt: '', sortOrder: s.mediaSet.length, type: 'gallery' }],
              }))}>Add Image</Button>
            </InlineStack>
            {newRule.mediaSet.map((media, mi) => (
              <Card key={mi}>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField label="Image URL" value={media.url} onChange={(v) => setNewRule((s) => {
                      const m = [...s.mediaSet]; m[mi] = { ...m[mi]!, url: v }; return { ...s, mediaSet: m };
                    })} autoComplete="off" />
                    <TextField label="Alt Text" value={media.alt} onChange={(v) => setNewRule((s) => {
                      const m = [...s.mediaSet]; m[mi] = { ...m[mi]!, alt: v }; return { ...s, mediaSet: m };
                    })} autoComplete="off" />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <Select label="Type" options={[
                      { label: 'Hero', value: 'hero' }, { label: 'Gallery', value: 'gallery' }, { label: 'Thumbnail', value: 'thumbnail' },
                    ]} value={media.type} onChange={(v) => setNewRule((s) => {
                      const m = [...s.mediaSet]; m[mi] = { ...m[mi]!, type: v }; return { ...s, mediaSet: m };
                    })} />
                    <TextField label="Sort Order" value={String(media.sortOrder)} onChange={(v) => setNewRule((s) => {
                      const m = [...s.mediaSet]; m[mi] = { ...m[mi]!, sortOrder: parseInt(v) || 0 }; return { ...s, mediaSet: m };
                    })} type="number" autoComplete="off" />
                  </FormLayout.Group>
                </FormLayout>
              </Card>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
