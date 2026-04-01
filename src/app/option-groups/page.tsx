'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  EmptyState,
  Spinner,
  Banner,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  useIndexResourceState,
} from '@shopify/polaris';

// ──────────────────────────────────────────────
// Types (matching Prisma schema exactly)
// ──────────────────────────────────────────────

interface OptionValue {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor: string | null;
  swatchImage: string | null;
  thumbnailUrl: string | null;
  description: string | null;
}

interface OptionGroup {
  id: string;
  productFamilyId: string;
  name: string;
  slug: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText: string | null;
  stepNumber: number | null;
  values: OptionValue[];
  productFamily: { id: string; name: string; handle?: string };
}

interface ProductFamilyOption {
  id: string;
  name: string;
  handle: string;
}

interface FormState {
  productFamilyId: string;
  name: string;
  slug: string;
  displayType: string;
  sortOrder: string;
  isRequired: boolean;
  helperText: string;
  stepNumber: string;
}

interface FormErrors {
  productFamilyId?: string;
  name?: string;
  slug?: string;
}

const BLANK_FORM: FormState = {
  productFamilyId: '',
  name: '',
  slug: '',
  displayType: 'TILE',
  sortOrder: '',
  isRequired: true,
  helperText: '',
  stepNumber: '',
};

const DISPLAY_TYPE_OPTIONS = [
  { label: 'Tile', value: 'TILE' },
  { label: 'Swatch', value: 'SWATCH' },
  { label: 'Thumbnail', value: 'THUMBNAIL' },
  { label: 'Dropdown', value: 'DROPDOWN' },
  { label: 'Radio', value: 'RADIO' },
  { label: 'Toggle', value: 'TOGGLE' },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function displayTypeBadge(dt: string) {
  const tones: Record<string, 'info' | 'success' | 'attention' | 'warning' | undefined> = {
    SWATCH: 'success',
    TILE: 'info',
    THUMBNAIL: 'attention',
    DROPDOWN: undefined,
    RADIO: undefined,
    TOGGLE: 'warning',
  };
  return <Badge tone={tones[dt]}>{dt}</Badge>;
}

function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let shopDomain = '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    shopDomain = params.get('shop') ?? '';
  }
  const separator = path.includes('?') ? '&' : '?';
  const url = shopDomain ? `${path}${separator}shop=${shopDomain}` : path;
  return fetch(url, options);
}

function validateForm(
  form: FormState,
  groups: OptionGroup[],
  editingId: string | null
): FormErrors {
  const errors: FormErrors = {};

  if (!form.productFamilyId) {
    errors.productFamilyId = 'Product family is required';
  }
  if (!form.name.trim()) {
    errors.name = 'Name is required';
  }

  const slug = (form.slug || toSlug(form.name)).trim();
  if (!slug) {
    errors.slug = 'Slug is required';
  } else if (form.productFamilyId) {
    const conflict = groups.find(
      (g) =>
        g.slug === slug &&
        g.productFamilyId === form.productFamilyId &&
        g.id !== editingId
    );
    if (conflict) {
      errors.slug = `Slug "${slug}" already exists in this product family`;
    }
  }

  return errors;
}

// ──────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────

export default function OptionGroupsPage() {
  // ── List ──
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [families, setFamilies] = useState<ProductFamilyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filterFamilyId, setFilterFamilyId] = useState('');

  // ── Form modal ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<OptionGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Feedback ──
  const [successMsg, setSuccessMsg] = useState('');

  // ── Derived ──
  const isEditMode = editingGroup !== null;
  const formErrors = useMemo(
    () => validateForm(form, groups, editingGroup?.id ?? null),
    [form, groups, editingGroup]
  );
  const isFormValid = Object.keys(formErrors).length === 0;

  const filteredGroups = useMemo(() => {
    if (!filterFamilyId) return groups;
    return groups.filter((g) => g.productFamilyId === filterFamilyId);
  }, [groups, filterFamilyId]);

  const familySelectOptions = useMemo(() => {
    return [
      { label: 'All families', value: '' },
      ...families.map((f) => ({ label: f.name, value: f.id })),
    ];
  }, [families]);

  const familyFormOptions = useMemo(() => {
    return [
      { label: '— Select product family —', value: '' },
      ...families.map((f) => ({ label: f.name, value: f.id })),
    ];
  }, [families]);

  // ────────────────────────────────────────────
  // FETCH
  // ────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [groupsRes, familiesRes] = await Promise.all([
        apiFetch('/api/options'),
        apiFetch('/api/product-families'),
      ]);

      if (!groupsRes.ok) {
        const body = await groupsRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Groups: ${groupsRes.status}`);
      }
      if (!familiesRes.ok) {
        const body = await familiesRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Families: ${familiesRes.status}`);
      }

      const groupsData = await groupsRes.json();
      const familiesData = await familiesRes.json();

      setGroups(groupsData.optionGroups ?? []);
      setFamilies(
        (familiesData.families ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          handle: f.handle ?? f.slug,
        }))
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ────────────────────────────────────────────
  // MODAL
  // ────────────────────────────────────────────

  const openCreateModal = useCallback(() => {
    setEditingGroup(null);
    setForm({
      ...BLANK_FORM,
      productFamilyId: filterFamilyId, // pre-select if filtering
    });
    setSlugTouched(false);
    setTouched(new Set());
    setSaveError('');
    setModalOpen(true);
  }, [filterFamilyId]);

  const openEditModal = useCallback((group: OptionGroup) => {
    setEditingGroup(group);
    setForm({
      productFamilyId: group.productFamilyId,
      name: group.name,
      slug: group.slug,
      displayType: group.displayType,
      sortOrder: String(group.sortOrder),
      isRequired: group.isRequired,
      helperText: group.helperText ?? '',
      stepNumber: group.stepNumber != null ? String(group.stepNumber) : '',
    });
    setSlugTouched(true);
    setTouched(new Set());
    setSaveError('');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingGroup(null);
    setSaveError('');
  }, []);

  // ────────────────────────────────────────────
  // FORM
  // ────────────────────────────────────────────

  const setField = useCallback(
    (field: keyof FormState) => (value: string) => {
      setTouched((prev) => new Set(prev).add(field));
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'name' && !slugTouched) {
          next.slug = toSlug(value);
        }
        return next;
      });
    },
    [slugTouched]
  );

  const setSlugField = useCallback((value: string) => {
    setSlugTouched(true);
    setTouched((prev) => new Set(prev).add('slug'));
    setForm((prev) => ({ ...prev, slug: value }));
  }, []);

  const setRequired = useCallback((value: boolean) => {
    setForm((prev) => ({ ...prev, isRequired: value }));
  }, []);

  const fieldError = useCallback(
    (field: keyof FormErrors): string | undefined => {
      return touched.has(field) ? formErrors[field] : undefined;
    },
    [formErrors, touched]
  );

  // ────────────────────────────────────────────
  // SAVE
  // ────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setTouched(new Set(['productFamilyId', 'name', 'slug']));
    if (!isFormValid) return;

    setSaving(true);
    setSaveError('');

    const payload: Record<string, unknown> = {
      productFamilyId: form.productFamilyId,
      name: form.name.trim(),
      slug: (form.slug || toSlug(form.name)).trim(),
      displayType: form.displayType,
      isRequired: form.isRequired,
      helperText: form.helperText.trim() || null,
      stepNumber: form.stepNumber ? parseInt(form.stepNumber, 10) : null,
    };
    if (form.sortOrder) payload.sortOrder = parseInt(form.sortOrder, 10);

    try {
      const url = isEditMode ? `/api/options/${editingGroup!.id}` : '/api/options';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save');
        return;
      }

      const name = data.optionGroup?.name ?? form.name;
      setModalOpen(false);
      setEditingGroup(null);
      setForm(BLANK_FORM);
      setSlugTouched(false);
      setTouched(new Set());
      setSuccessMsg(isEditMode ? `"${name}" updated` : `"${name}" created`);
      await loadData();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [form, isFormValid, isEditMode, editingGroup, loadData]);

  // ────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────

  const openDeleteConfirm = useCallback((group: OptionGroup) => {
    setDeleteTarget(group);
    setDeleteError('');
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError('');
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');

    try {
      const res = await apiFetch(`/api/options/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? 'Failed to delete');
        return;
      }

      const name = deleteTarget.name;
      setDeleteTarget(null);
      setSuccessMsg(`"${name}" deleted`);
      await loadData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadData]);

  // ── IndexTable ──
  const resourceName = { singular: 'option group', plural: 'option groups' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredGroups);

  // ────────────────────────────────────────────
  // RENDER: Loading
  // ────────────────────────────────────────────

  if (loading) {
    return (
      <Page title="Option Groups">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Spinner size="large" />
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (fetchError) {
    return (
      <Page title="Option Groups">
        <Layout>
          <Layout.Section>
            <Banner tone="critical" title="Could not load option groups" action={{ content: 'Try again', onAction: loadData }}>
              <p>{fetchError}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Empty
  // ────────────────────────────────────────────

  if (groups.length === 0 && !successMsg) {
    return (
      <Page title="Option Groups">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No option groups yet"
                action={
                  families.length > 0
                    ? { content: 'Create option group', onAction: openCreateModal }
                    : { content: 'Create a product family first', url: '/product-families' }
                }
                image=""
              >
                <p>
                  Option groups define the selections customers make when configuring a product,
                  such as size, finish, or basin type.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
        {renderFormModal()}
      </Page>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Table rows
  // ────────────────────────────────────────────

  const rows = filteredGroups.map((group, index) => (
    <IndexTable.Row
      id={group.id}
      key={group.id}
      position={index}
      selected={selectedResources.includes(group.id)}
    >
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="semibold">{group.name}</Text>
          <Text as="span" variant="bodySm" tone="subdued">{group.slug}</Text>
        </BlockStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {group.productFamily.name}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        {displayTypeBadge(group.displayType)}
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {group.values.length} value{group.values.length !== 1 ? 's' : ''}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200">
          {group.isRequired && <Badge tone="info">Required</Badge>}
          {group.stepNumber != null && (
            <Text as="span" variant="bodySm" tone="subdued">Step {group.stepNumber}</Text>
          )}
        </InlineStack>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {group.sortOrder}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Button size="slim" variant="plain" onClick={() => openEditModal(group)}>Edit</Button>
          <Button size="slim" variant="plain" tone="critical" onClick={() => openDeleteConfirm(group)}>Delete</Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  // ────────────────────────────────────────────
  // RENDER: Form modal
  // ────────────────────────────────────────────

  function renderFormModal() {
    const title = isEditMode ? `Edit: ${editingGroup!.name}` : 'Create Option Group';
    const submitLabel = isEditMode ? 'Save changes' : 'Create';

    return (
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={title}
        primaryAction={{
          content: submitLabel,
          onAction: handleSave,
          loading: saving,
          disabled: saving || (touched.size > 0 && !isFormValid),
        }}
        secondaryActions={[{ content: 'Cancel', onAction: closeModal }]}
      >
        <Modal.Section>
          {saveError && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical" onDismiss={() => setSaveError('')}>{saveError}</Banner>
            </div>
          )}

          <FormLayout>
            <Select
              label="Product Family"
              options={familyFormOptions}
              value={form.productFamilyId}
              onChange={setField('productFamilyId')}
              requiredIndicator
              error={fieldError('productFamilyId')}
              disabled={isEditMode}
            />

            <TextField
              label="Name"
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Vanity Size"
              helpText="Display name shown to customers in the configurator"
              autoComplete="off"
              requiredIndicator
              error={fieldError('name')}
            />

            <TextField
              label="Slug"
              value={form.slug}
              onChange={setSlugField}
              placeholder="e.g. vanity-size"
              helpText={
                slugTouched
                  ? 'Identifier used in rules and API. Must be unique within the product family.'
                  : 'Auto-generated from name. Edit to override.'
              }
              autoComplete="off"
              requiredIndicator
              error={fieldError('slug')}
            />

            <Select
              label="Display Type"
              options={DISPLAY_TYPE_OPTIONS}
              value={form.displayType}
              onChange={setField('displayType')}
              helpText="Controls how options render in the storefront configurator"
            />

            <Checkbox
              label="Required"
              checked={form.isRequired}
              onChange={setRequired}
              helpText="If checked, the customer must make a selection in this group"
            />

            <FormLayout.Group>
              <TextField
                label="Sort Order"
                value={form.sortOrder}
                onChange={setField('sortOrder')}
                type="number"
                placeholder="0"
                helpText="Lower numbers appear first"
                autoComplete="off"
              />

              <TextField
                label="Step Number"
                value={form.stepNumber}
                onChange={setField('stepNumber')}
                type="number"
                placeholder="Optional"
                helpText="Groups with the same step appear together"
                autoComplete="off"
              />
            </FormLayout.Group>

            <TextField
              label="Helper Text"
              value={form.helperText}
              onChange={setField('helperText')}
              placeholder="Optional help text shown below the group name"
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Delete modal
  // ────────────────────────────────────────────

  function renderDeleteModal() {
    if (!deleteTarget) return null;

    return (
      <Modal
        open={true}
        onClose={closeDeleteConfirm}
        title="Delete option group"
        primaryAction={{ content: 'Delete', onAction: handleDelete, loading: deleting, destructive: true }}
        secondaryActions={[{ content: 'Cancel', onAction: closeDeleteConfirm }]}
      >
        <Modal.Section>
          {deleteError && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical" onDismiss={() => setDeleteError('')}>{deleteError}</Banner>
            </div>
          )}
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> from {deleteTarget.productFamily.name}?
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This will also delete all {deleteTarget.values.length} option value{deleteTarget.values.length !== 1 ? 's' : ''} in this group.
              Any rules referencing this group will break. This cannot be undone.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Main
  // ────────────────────────────────────────────

  return (
    <Page
      title="Option Groups"
      primaryAction={{ content: 'Create option group', onAction: openCreateModal }}
    >
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingSm">
                {filteredGroups.length} option group{filteredGroups.length !== 1 ? 's' : ''}
                {filterFamilyId && families.find((f) => f.id === filterFamilyId)
                  ? ` in ${families.find((f) => f.id === filterFamilyId)!.name}`
                  : ' across all families'}
              </Text>
              <div style={{ width: 250 }}>
                <Select
                  label="Filter by family"
                  labelHidden
                  options={familySelectOptions}
                  value={filterFamilyId}
                  onChange={setFilterFamilyId}
                />
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredGroups.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: 'Name' },
                { title: 'Product Family' },
                { title: 'Display Type' },
                { title: 'Values' },
                { title: 'Settings' },
                { title: 'Order' },
                { title: 'Actions' },
              ]}
              selectable={false}
            >
              {rows}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {renderFormModal()}
      {renderDeleteModal()}
    </Page>
  );
}
