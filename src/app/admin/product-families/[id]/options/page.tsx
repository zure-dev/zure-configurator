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
  Divider,
  Modal,
  Checkbox,
  Icon,
} from '@shopify/polaris';
import { DeleteIcon, DragHandleIcon, PlusIcon } from '@shopify/polaris-icons';
import { useParams } from 'next/navigation';

interface OptionValue {
  id?: string;
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor?: string;
  swatchImage?: string;
  thumbnailUrl?: string;
  description?: string;
}

interface OptionGroup {
  id: string;
  name: string;
  slug: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText: string | null;
  stepNumber: number | null;
  values: OptionValue[];
}

const DISPLAY_TYPES = [
  { label: 'Tile', value: 'TILE' },
  { label: 'Swatch', value: 'SWATCH' },
  { label: 'Thumbnail', value: 'THUMBNAIL' },
  { label: 'Dropdown', value: 'DROPDOWN' },
  { label: 'Radio', value: 'RADIO' },
  { label: 'Toggle', value: 'TOGGLE' },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function OptionsEditorPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal state for editing a group
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '', slug: '', displayType: 'TILE', isRequired: true, helperText: '', stepNumber: '',
  });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/options?familyId=${familyId}`);
      const data = await res.json();
      setGroups(data.optionGroups ?? []);
    } catch (e) {
      setErrorMsg('Failed to load option groups');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleAddGroup = useCallback(async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: familyId,
          name: newGroup.name,
          slug: newGroup.slug || slugify(newGroup.name),
          displayType: newGroup.displayType,
          isRequired: newGroup.isRequired,
          helperText: newGroup.helperText || null,
          stepNumber: newGroup.stepNumber ? parseInt(newGroup.stepNumber) : null,
          sortOrder: groups.length,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error ?? 'Failed to create option group');
        return;
      }

      setShowAddGroup(false);
      setNewGroup({ name: '', slug: '', displayType: 'TILE', isRequired: true, helperText: '', stepNumber: '' });
      setSuccessMsg('Option group created');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchGroups();
    } catch (e) {
      setErrorMsg('Network error');
    } finally {
      setSaving(false);
    }
  }, [familyId, newGroup, groups.length, fetchGroups]);

  const handleSaveGroup = useCallback(async (group: OptionGroup) => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/options/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: group.name,
          slug: group.slug,
          displayType: group.displayType,
          isRequired: group.isRequired,
          helperText: group.helperText,
          stepNumber: group.stepNumber,
          values: group.values.map((v, i) => ({
            name: v.name,
            slug: v.slug,
            sortOrder: i,
            isDefault: v.isDefault,
            swatchColor: v.swatchColor,
            swatchImage: v.swatchImage,
            thumbnailUrl: v.thumbnailUrl,
            description: v.description,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error ?? 'Failed to save');
        return;
      }

      setEditingGroup(null);
      setSuccessMsg(`"${group.name}" saved`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchGroups();
    } catch (e) {
      setErrorMsg('Network error');
    } finally {
      setSaving(false);
    }
  }, [fetchGroups]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (!confirm('Delete this option group and all its values?')) return;
    try {
      await fetch(`/api/options/${groupId}`, { method: 'DELETE' });
      setSuccessMsg('Option group deleted');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchGroups();
    } catch (e) {
      setErrorMsg('Failed to delete');
    }
  }, [fetchGroups]);

  if (loading) {
    return (
      <Page title="Option Groups" backAction={{ content: 'Back', url: `/admin/product-families/${familyId}` }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="large" /></div>
      </Page>
    );
  }

  return (
    <Page
      title="Option Groups"
      backAction={{ content: 'Product Family', url: `/admin/product-families/${familyId}` }}
      primaryAction={{ content: 'Add Option Group', onAction: () => setShowAddGroup(true) }}
    >
      {successMsg && <div style={{ marginBottom: 16 }}><Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner></div>}
      {errorMsg && <div style={{ marginBottom: 16 }}><Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner></div>}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {groups.map((group, index) => (
              <Card key={group.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" variant="headingMd">{group.name}</Text>
                      <Badge>{group.displayType}</Badge>
                      {group.isRequired && <Badge tone="info">Required</Badge>}
                      <Text as="span" variant="bodySm" tone="subdued">Step {group.stepNumber ?? index + 1}</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Button size="slim" onClick={() => setEditingGroup({ ...group, values: [...group.values] })}>
                        Edit
                      </Button>
                      <Button size="slim" tone="critical" onClick={() => handleDeleteGroup(group.id)}>
                        Delete
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {group.values.map((v) => (
                      <div
                        key={v.slug}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #e5e5e5',
                          borderRadius: 6,
                          fontSize: 13,
                          background: v.isDefault ? '#f0f9ff' : '#fff',
                        }}
                      >
                        {v.swatchColor && (
                          <span style={{
                            display: 'inline-block', width: 12, height: 12,
                            borderRadius: '50%', backgroundColor: v.swatchColor,
                            marginRight: 6, verticalAlign: 'middle', border: '1px solid #ddd',
                          }} />
                        )}
                        {v.name}
                        {v.isDefault && <span style={{ marginLeft: 4, color: '#2563eb', fontSize: 11 }}>(default)</span>}
                      </div>
                    ))}
                  </div>

                  {group.helperText && (
                    <Text as="p" variant="bodySm" tone="subdued">{group.helperText}</Text>
                  )}
                </BlockStack>
              </Card>
            ))}

            {groups.length === 0 && (
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="bodyMd" tone="subdued">No option groups yet.</Text>
                  <Button onClick={() => setShowAddGroup(true)}>Add your first option group</Button>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Add Group Modal */}
      <Modal
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        title="Add Option Group"
        primaryAction={{ content: 'Create', onAction: handleAddGroup, loading: saving }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setShowAddGroup(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={newGroup.name} onChange={(v) => setNewGroup((s) => ({ ...s, name: v, slug: s.slug || slugify(v) }))} autoComplete="off" />
            <TextField label="Slug" value={newGroup.slug} onChange={(v) => setNewGroup((s) => ({ ...s, slug: v }))} autoComplete="off" />
            <Select label="Display Type" options={DISPLAY_TYPES} value={newGroup.displayType} onChange={(v) => setNewGroup((s) => ({ ...s, displayType: v }))} />
            <Checkbox label="Required" checked={newGroup.isRequired} onChange={(v) => setNewGroup((s) => ({ ...s, isRequired: v }))} />
            <TextField label="Helper Text" value={newGroup.helperText} onChange={(v) => setNewGroup((s) => ({ ...s, helperText: v }))} autoComplete="off" />
            <TextField label="Step Number" value={newGroup.stepNumber} onChange={(v) => setNewGroup((s) => ({ ...s, stepNumber: v }))} type="number" autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Edit Group Modal */}
      {editingGroup && (
        <Modal
          open={true}
          onClose={() => setEditingGroup(null)}
          title={`Edit: ${editingGroup.name}`}
          primaryAction={{ content: 'Save', onAction: () => handleSaveGroup(editingGroup), loading: saving }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setEditingGroup(null) }]}
          large
        >
          <Modal.Section>
            <FormLayout>
              <TextField label="Name" value={editingGroup.name} onChange={(v) => setEditingGroup((g) => g ? { ...g, name: v } : null)} autoComplete="off" />
              <Select label="Display Type" options={DISPLAY_TYPES} value={editingGroup.displayType} onChange={(v) => setEditingGroup((g) => g ? { ...g, displayType: v } : null)} />
              <Checkbox label="Required" checked={editingGroup.isRequired} onChange={(v) => setEditingGroup((g) => g ? { ...g, isRequired: v } : null)} />
              <TextField label="Helper Text" value={editingGroup.helperText ?? ''} onChange={(v) => setEditingGroup((g) => g ? { ...g, helperText: v || null } : null)} autoComplete="off" />
            </FormLayout>
          </Modal.Section>

          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">Values</Text>
                <Button
                  size="slim"
                  onClick={() => {
                    setEditingGroup((g) => {
                      if (!g) return null;
                      return {
                        ...g,
                        values: [...g.values, {
                          name: '',
                          slug: '',
                          sortOrder: g.values.length,
                          isDefault: false,
                        }],
                      };
                    });
                  }}
                >
                  Add Value
                </Button>
              </InlineStack>

              {editingGroup.values.map((value, vi) => (
                <Card key={vi}>
                  <InlineStack gap="200" blockAlign="start" wrap={false}>
                    <div style={{ flex: 1 }}>
                      <FormLayout>
                        <FormLayout.Group>
                          <TextField
                            label="Name"
                            value={value.name}
                            onChange={(v) => {
                              setEditingGroup((g) => {
                                if (!g) return null;
                                const vals = [...g.values];
                                vals[vi] = { ...vals[vi]!, name: v, slug: vals[vi]!.slug || slugify(v) };
                                return { ...g, values: vals };
                              });
                            }}
                            autoComplete="off"
                          />
                          <TextField
                            label="Slug"
                            value={value.slug}
                            onChange={(v) => {
                              setEditingGroup((g) => {
                                if (!g) return null;
                                const vals = [...g.values];
                                vals[vi] = { ...vals[vi]!, slug: v };
                                return { ...g, values: vals };
                              });
                            }}
                            autoComplete="off"
                          />
                        </FormLayout.Group>
                        <FormLayout.Group>
                          <TextField
                            label="Swatch Color"
                            value={value.swatchColor ?? ''}
                            onChange={(v) => {
                              setEditingGroup((g) => {
                                if (!g) return null;
                                const vals = [...g.values];
                                vals[vi] = { ...vals[vi]!, swatchColor: v || undefined };
                                return { ...g, values: vals };
                              });
                            }}
                            placeholder="#FFFFFF"
                            autoComplete="off"
                          />
                          <TextField
                            label="Thumbnail URL"
                            value={value.thumbnailUrl ?? ''}
                            onChange={(v) => {
                              setEditingGroup((g) => {
                                if (!g) return null;
                                const vals = [...g.values];
                                vals[vi] = { ...vals[vi]!, thumbnailUrl: v || undefined };
                                return { ...g, values: vals };
                              });
                            }}
                            autoComplete="off"
                          />
                        </FormLayout.Group>
                        <Checkbox
                          label="Default value"
                          checked={value.isDefault}
                          onChange={(v) => {
                            setEditingGroup((g) => {
                              if (!g) return null;
                              const vals = g.values.map((val, i) => ({
                                ...val,
                                isDefault: i === vi ? v : false,
                              }));
                              return { ...g, values: vals };
                            });
                          }}
                        />
                      </FormLayout>
                    </div>
                    <Button
                      tone="critical"
                      size="slim"
                      onClick={() => {
                        setEditingGroup((g) => {
                          if (!g) return null;
                          return { ...g, values: g.values.filter((_, i) => i !== vi) };
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
