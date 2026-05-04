'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
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
  Modal,
} from '@shopify/polaris';
import { useParams } from 'next/navigation';

interface MediaCondition {
  optionGroupSlug: string;
  optionValueSlug: string;
}

interface MediaItem {
  url: string;
  alt: string;
  sortOrder: number;
  type: string;
}

interface MediaRuleData {
  id: string;
  name: string | null;
  priority: number;
  conditions: MediaCondition[];
  mediaSet: MediaItem[];
  isActive: boolean;
}

interface OptionValueData {
  slug: string;
  name: string;
}

interface OptionGroupData {
  slug: string;
  name: string;
  values: OptionValueData[];
}

export default function MediaEditorPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [rules, setRules] = useState<MediaRuleData[]>([]);
  const [groups, setGroups] = useState<OptionGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [newRule, setNewRule] = useState<{
    name: string;
    priority: string;
    conditions: MediaCondition[];
    mediaSet: MediaItem[];
  }>({
    name: '',
    priority: '10',
    conditions: [{ optionGroupSlug: '', optionValueSlug: '' }],
    mediaSet: [{ url: '', alt: '', sortOrder: 0, type: 'hero' }],
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, optionsRes] = await Promise.all([
        fetch(`/api/media-rules?familyId=${familyId}`),
        fetch(`/api/options?familyId=${familyId}`),
      ]);

      const rulesJson = await rulesRes.json();
      const optionsJson = await optionsRes.json();

      setRules(rulesJson.rules ?? []);
      setGroups(optionsJson.optionGroups ?? []);
    } catch {
      setErrorMsg('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupOptions = groups.map((g) => ({ label: g.name, value: g.slug }));

  const getValuesForGroup = (slug: string) =>
    (groups.find((g) => g.slug === slug)?.values ?? []).map((v) => ({
      label: v.name,
      value: v.slug,
    }));

  const getGroupName = (slug: string) =>
    groups.find((g) => g.slug === slug)?.name ?? slug;

  const getValueName = (groupSlug: string, valueSlug: string) => {
    const group = groups.find((g) => g.slug === groupSlug);
    return group?.values?.find((v) => v.slug === valueSlug)?.name ?? valueSlug;
  };

  const priorityLabel = (priority: number) => {
    if (priority <= 0) return 'Default';
    if (priority <= 10) return 'Finish Override';
    if (priority <= 20) return 'Category Override';
    return 'Exact Match';
  };

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setErrorMsg('');

    try {
      const validConditions = newRule.conditions.filter(
        (c) => c.optionGroupSlug && c.optionValueSlug
      );
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
          priority: parseInt(newRule.priority, 10) || 10,
          conditions: validConditions,
          mediaSet: validMedia,
        }),
      });

      if (!res.ok) {
        setErrorMsg('Failed to create');
        return;
      }

      setShowAdd(false);
      setNewRule({
        name: '',
        priority: '10',
        conditions: [{ optionGroupSlug: '', optionValueSlug: '' }],
        mediaSet: [{ url: '', alt: '', sortOrder: 0, type: 'hero' }],
      });
      setSuccessMsg('Media rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    } finally {
      setSaving(false);
    }
  }, [familyId, newRule, fetchData]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this media rule?')) return;

      await fetch(`/api/media-rules?id=${id}`, { method: 'DELETE' });
      setSuccessMsg('Deleted');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData();
    },
    [fetchData]
  );

  if (loading) {
    return (
      <Page
        title="Media Rules"
        backAction={{ content: 'Back', url: `/admin/product-families/${familyId}` }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Media Rules"
      backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
      primaryAction={{ content: 'Add Media Rule', onAction: () => setShowAdd(true) }}
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

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Priority Cascade
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Higher priority rules override lower. Priority 0 = family default, 10 = finish
                override, 20 = category override, 30 = exact match.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            {rules
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <Card key={rule.id}>
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" variant="headingSm">
                          {rule.name ?? 'Unnamed'}
                        </Text>
                        <Badge tone="info">{`Priority ${rule.priority}`}</Badge>
                        <Badge>{priorityLabel(rule.priority)}</Badge>
                        {!rule.isActive ? <Badge tone="warning">Inactive</Badge> : null}
                      </InlineStack>

                      <Text as="p" variant="bodySm">
                        <strong>Conditions:</strong>{' '}
                        {rule.conditions.length > 0
                          ? rule.conditions.map((c, i) => (
                              <span key={`${c.optionGroupSlug}-${c.optionValueSlug}-${i}`}>
                                {i > 0 ? ' AND ' : ''}
                                {getGroupName(c.optionGroupSlug)} ={' '}
                                <Badge>{String(getValueName(c.optionGroupSlug, c.optionValueSlug))}</Badge>
                              </span>
                            ))
                          : 'None'}
                      </Text>

                      <Text as="p" variant="bodySm">
                        <strong>Media:</strong> {rule.mediaSet.length} image(s)
                        {rule.mediaSet.map((m, i) => (
                          <span key={`${m.url}-${i}`} style={{ marginLeft: 8 }}>
                            <Badge>{String(m.type)}</Badge> {m.url.split('/').pop()}
                          </span>
                        ))}
                      </Text>
                    </BlockStack>

                    <Button size="slim" tone="critical" onClick={() => handleDelete(rule.id)}>
                      Delete
                    </Button>
                  </InlineStack>
                </Card>
              ))}

            {rules.length === 0 ? (
              <Card>
                <Text as="p" tone="subdued" alignment="center">
                  No media rules. The product family default images will be used.
                </Text>
              </Card>
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Media Rule"
        primaryAction={{
          content: 'Create',
          onAction: handleCreate,
          loading: saving,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowAdd(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Rule Name"
              value={newRule.name}
              onChange={(value) => setNewRule((s) => ({ ...s, name: value }))}
              autoComplete="off"
            />
            <Select
              label="Priority"
              options={[
                { label: '0 — Default', value: '0' },
                { label: '10 — Finish Override', value: '10' },
                { label: '20 — Category Override', value: '20' },
                { label: '30 — Exact Match', value: '30' },
              ]}
              value={newRule.priority}
              onChange={(value) => setNewRule((s) => ({ ...s, priority: value }))}
            />
          </FormLayout>
        </Modal.Section>

        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                Conditions (all must match)
              </Text>
              <Button
                size="slim"
                onClick={() =>
                  setNewRule((s) => ({
                    ...s,
                    conditions: [
                      ...s.conditions,
                      { optionGroupSlug: '', optionValueSlug: '' },
                    ],
                  }))
                }
              >
                Add Condition
              </Button>
            </InlineStack>

            {newRule.conditions.map((cond, ci) => (
              <InlineStack key={ci} gap="200" blockAlign="end">
                <Select
                  label={ci === 0 ? 'Group' : ''}
                  options={[{ label: 'Select...', value: '' }, ...groupOptions]}
                  value={cond.optionGroupSlug}
                  onChange={(value) =>
                    setNewRule((s) => {
                      const conditions = [...s.conditions];
                      conditions[ci] = {
                        ...conditions[ci]!,
                        optionGroupSlug: value,
                        optionValueSlug: '',
                      };
                      return { ...s, conditions };
                    })
                  }
                />

                {cond.optionGroupSlug ? (
                  <Select
                    label={ci === 0 ? 'Value' : ''}
                    options={[
                      { label: 'Select...', value: '' },
                      ...getValuesForGroup(cond.optionGroupSlug),
                    ]}
                    value={cond.optionValueSlug}
                    onChange={(value) =>
                      setNewRule((s) => {
                        const conditions = [...s.conditions];
                        conditions[ci] = {
                          ...conditions[ci]!,
                          optionValueSlug: value,
                        };
                        return { ...s, conditions };
                      })
                    }
                  />
                ) : null}

                {newRule.conditions.length > 1 ? (
                  <Button
                    size="slim"
                    tone="critical"
                    onClick={() =>
                      setNewRule((s) => ({
                        ...s,
                        conditions: s.conditions.filter((_, i) => i !== ci),
                      }))
                    }
                  >
                    ×
                  </Button>
                ) : null}
              </InlineStack>
            ))}
          </BlockStack>
        </Modal.Section>

        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                Media Set
              </Text>
              <Button
                size="slim"
                onClick={() =>
                  setNewRule((s) => ({
                    ...s,
                    mediaSet: [
                      ...s.mediaSet,
                      {
                        url: '',
                        alt: '',
                        sortOrder: s.mediaSet.length,
                        type: 'gallery',
                      },
                    ],
                  }))
                }
              >
                Add Image
              </Button>
            </InlineStack>

            {newRule.mediaSet.map((media, mi) => (
              <Card key={mi}>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Image URL"
                      value={media.url}
                      onChange={(value) =>
                        setNewRule((s) => {
                          const mediaSet = [...s.mediaSet];
                          mediaSet[mi] = { ...mediaSet[mi]!, url: value };
                          return { ...s, mediaSet };
                        })
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Alt Text"
                      value={media.alt}
                      onChange={(value) =>
                        setNewRule((s) => {
                          const mediaSet = [...s.mediaSet];
                          mediaSet[mi] = { ...mediaSet[mi]!, alt: value };
                          return { ...s, mediaSet };
                        })
                      }
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <FormLayout.Group>
                    <Select
                      label="Type"
                      options={[
                        { label: 'Hero', value: 'hero' },
                        { label: 'Gallery', value: 'gallery' },
                        { label: 'Thumbnail', value: 'thumbnail' },
                      ]}
                      value={media.type}
                      onChange={(value) =>
                        setNewRule((s) => {
                          const mediaSet = [...s.mediaSet];
                          mediaSet[mi] = { ...mediaSet[mi]!, type: value };
                          return { ...s, mediaSet };
                        })
                      }
                    />
                    <TextField
                      label="Sort Order"
                      value={String(media.sortOrder)}
                      onChange={(value) =>
                        setNewRule((s) => {
                          const mediaSet = [...s.mediaSet];
                          mediaSet[mi] = {
                            ...mediaSet[mi]!,
                            sortOrder: parseInt(value, 10) || 0,
                          };
                          return { ...s, mediaSet };
                        })
                      }
                      type="number"
                      autoComplete="off"
                    />
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