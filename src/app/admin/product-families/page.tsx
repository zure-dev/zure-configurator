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
  useIndexResourceState,
} from '@shopify/polaris';
import { useRouter } from 'next/navigation';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ProductFamily {
  id: string;
  name: string;
  handle: string;
  slug: string;
  category: string | null;
  description: string | null;
  status: string;
  basePrice: string;
  shopifyProductId: string | null;
  shopifyLink: { shopifyProductHandle: string } | null;
  _count: {
    optionGroups: number;
    priceRules: number;
    dependencyRules: number;
    exclusionRules: number;
    mediaRules: number;
    components: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  handle: string;
  category: string;
  status: string;
  shopifyProductId: string;
  description: string;
}

interface FormErrors {
  name?: string;
  handle?: string;
}

const BLANK_FORM: FormState = {
  name: '',
  handle: '',
  category: '',
  status: 'DRAFT',
  shopifyProductId: '',
  description: '',
};

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
];

const CATEGORY_OPTIONS = [
  { label: '— None —', value: '' },
  { label: 'Vanities', value: 'vanities' },
  { label: 'Cabinetry', value: 'cabinetry' },
  { label: 'Benchtops', value: 'benchtops' },
  { label: 'Fixtures', value: 'fixtures' },
  { label: 'Accessories', value: 'accessories' },
  { label: 'Other', value: 'other' },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function toHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return <Badge tone="success">Active</Badge>;
    case 'DRAFT':
      return <Badge>Draft</Badge>;
    case 'ARCHIVED':
      return <Badge tone="warning">Archived</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
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
  families: ProductFamily[],
  editingId: string | null
): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Name is required';
  }

  const handle = (form.handle || toHandle(form.name)).trim();
  if (!handle) {
    errors.handle = 'Handle is required';
  } else {
    const conflict = families.find(
      (f) => (f.handle === handle || f.slug === handle) && f.id !== editingId
    );
    if (conflict) {
      errors.handle = `Handle "${handle}" is already used by "${conflict.name}"`;
    }
  }

  return errors;
}

// ──────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────

export default function ProductFamiliesPage() {
  const router = useRouter();

  // ── List ──
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // ── Form modal (shared for create + edit) ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<ProductFamily | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Feedback ──
  const [successMsg, setSuccessMsg] = useState('');

  // ── Derived ──
  const isEditMode = editingFamily !== null;
  const formErrors = useMemo(
    () => validateForm(form, families, editingFamily?.id ?? null),
    [form, families, editingFamily]
  );
  const isFormValid = Object.keys(formErrors).length === 0;

  // ────────────────────────────────────────────
  // FETCH
  // ────────────────────────────────────────────

  const loadFamilies = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await apiFetch('/api/product-families');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const data = await res.json();
      setFamilies(data.families ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not load product families');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFamilies(); }, [loadFamilies]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ────────────────────────────────────────────
  // MODAL open / close
  // ────────────────────────────────────────────

  const openCreateModal = useCallback(() => {
    setEditingFamily(null);
    setForm(BLANK_FORM);
    setHandleTouched(false);
    setTouched(new Set());
    setSaveError('');
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((family: ProductFamily) => {
    setEditingFamily(family);
    setForm({
      name: family.name,
      handle: family.handle || family.slug,
      category: family.category ?? '',
      status: family.status,
      shopifyProductId: family.shopifyProductId ?? '',
      description: family.description ?? '',
    });
    setHandleTouched(true);
    setTouched(new Set());
    setSaveError('');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingFamily(null);
    setSaveError('');
  }, []);

  // ────────────────────────────────────────────
  // FORM field handlers
  // ────────────────────────────────────────────

  const setField = useCallback(
    (field: keyof FormState) => (value: string) => {
      setTouched((prev) => new Set(prev).add(field));
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'name' && !handleTouched) {
          next.handle = toHandle(value);
        }
        return next;
      });
    },
    [handleTouched]
  );

  const setHandleField = useCallback((value: string) => {
    setHandleTouched(true);
    setTouched((prev) => new Set(prev).add('handle'));
    setForm((prev) => ({ ...prev, handle: value }));
  }, []);

  const fieldError = useCallback(
    (field: keyof FormErrors): string | undefined => {
      return touched.has(field) ? formErrors[field] : undefined;
    },
    [formErrors, touched]
  );

  // ────────────────────────────────────────────
  // SAVE (create or update)
  // ────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setTouched(new Set(['name', 'handle']));
    if (!isFormValid) return;

    setSaving(true);
    setSaveError('');

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      handle: (form.handle || toHandle(form.name)).trim(),
      status: form.status || 'DRAFT',
      category: form.category || null,
      description: form.description.trim() || null,
      shopifyProductId: form.shopifyProductId.trim() || null,
    };

    try {
      const url = isEditMode
        ? `/api/product-families/${editingFamily!.id}`
        : '/api/product-families';

      const res = await apiFetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? `Failed to ${isEditMode ? 'update' : 'create'}`);
        return;
      }

      const name = data.family?.name ?? form.name;
      setModalOpen(false);
      setEditingFamily(null);
      setForm(BLANK_FORM);
      setHandleTouched(false);
      setTouched(new Set());
      setSuccessMsg(isEditMode ? `"${name}" updated` : `"${name}" created`);
      await loadFamilies();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [form, isFormValid, isEditMode, editingFamily, loadFamilies]);

  // ────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────

  const openDeleteConfirm = useCallback((family: ProductFamily) => {
    setDeleteTarget(family);
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
      const res = await apiFetch(`/api/product-families/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? 'Failed to delete');
        return;
      }

      const name = deleteTarget.name;
      setDeleteTarget(null);
      setSuccessMsg(`"${name}" deleted`);
      await loadFamilies();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadFamilies]);

  // ── IndexTable ──
  const resourceName = { singular: 'product family', plural: 'product families' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(families.map((f) => ({ id: f.id })));

  // ────────────────────────────────────────────
  // RENDER: Loading
  // ────────────────────────────────────────────

  if (loading) {
    return (
      <Page title="Product Families">
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

  // ────────────────────────────────────────────
  // RENDER: Fetch error
  // ────────────────────────────────────────────

  if (fetchError) {
    return (
      <Page title="Product Families">
        <Layout>
          <Layout.Section>
            <Banner
              tone="critical"
              title="Could not load product families"
              action={{ content: 'Try again', onAction: loadFamilies }}
            >
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

  if (families.length === 0 && !successMsg) {
    return (
      <Page title="Product Families">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No product families yet"
                action={{ content: 'Create product family', onAction: openCreateModal }}
                image=""
              >
                <p>
                  Product families define the configurable products in your store.
                  Create your first one to get started.
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

  const rows = families.map((family, index) => {
    const rules = (family._count?.dependencyRules ?? 0) + (family._count?.exclusionRules ?? 0);
    const options = family._count?.optionGroups ?? 0;
    const components = family._count?.components ?? 0;

    return (
      <IndexTable.Row
        id={family.id}
        key={family.id}
        position={index}
        selected={selectedResources.includes(family.id)}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {family.name}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {family.handle || family.slug}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          {family.category
            ? <Badge>{family.category}</Badge>
            : <Text as="span" variant="bodySm" tone="subdued">—</Text>}
        </IndexTable.Cell>

        <IndexTable.Cell>{statusBadge(family.status)}</IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {family.shopifyProductId
              ? family.shopifyProductId.replace('gid://shopify/Product/', '#')
              : '—'}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {`${options} options · ${rules} rules · ${components} components`}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {shortDate(family.updatedAt)}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Button size="slim" variant="plain" onClick={() => openEditModal(family)}>
              Edit
            </Button>
            <Button size="slim" variant="plain" tone="critical" onClick={() => openDeleteConfirm(family)}>
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ────────────────────────────────────────────
  // RENDER: Create / Edit modal
  // ────────────────────────────────────────────

  function renderFormModal() {
    const title = isEditMode ? `Edit: ${editingFamily!.name}` : 'Create Product Family';
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
              <Banner tone="critical" onDismiss={() => setSaveError('')}>
                {saveError}
              </Banner>
            </div>
          )}

          <FormLayout>
            <TextField
              label="Name"
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Zure Vanity 600-1500mm"
              helpText="Display name for this product family"
              autoComplete="off"
              requiredIndicator
              error={fieldError('name')}
            />

            <TextField
              label="Handle"
              value={form.handle}
              onChange={setHandleField}
              placeholder="e.g. zure-vanity-600-1500mm"
              helpText={
                handleTouched
                  ? 'URL-friendly identifier. Must be unique per store.'
                  : 'Auto-generated from name. Edit to override.'
              }
              autoComplete="off"
              requiredIndicator
              error={fieldError('handle')}
            />

            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={setField('category')}
              helpText="Used to group and filter product families"
            />

            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={setField('status')}
            />

            <TextField
              label="Shopify Product ID"
              value={form.shopifyProductId}
              onChange={setField('shopifyProductId')}
              placeholder="e.g. gid://shopify/Product/123456789"
              helpText="Optional. Link to the parent Shopify product."
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={form.description}
              onChange={setField('description')}
              placeholder="Brief description of this configurable product..."
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Delete confirmation modal
  // ────────────────────────────────────────────

  function renderDeleteModal() {
    if (!deleteTarget) return null;

    return (
      <Modal
        open={true}
        onClose={closeDeleteConfirm}
        title="Delete product family"
        primaryAction={{
          content: 'Delete',
          onAction: handleDelete,
          loading: deleting,
          destructive: true,
        }}
        secondaryActions={[{ content: 'Cancel', onAction: closeDeleteConfirm }]}
      >
        <Modal.Section>
          {deleteError && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical" onDismiss={() => setDeleteError('')}>
                {deleteError}
              </Banner>
            </div>
          )}

          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This will permanently remove this product family and all its option groups,
              rules, pricing, media mappings, and component mappings. This cannot be undone.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Main page
  // ────────────────────────────────────────────

  return (
    <Page
      title="Product Families"
      primaryAction={{
        content: 'Create product family',
        onAction: openCreateModal,
      }}
    >
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>
              {successMsg}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={families.length}
              selectedItemsCount={
                allResourcesSelected ? 'All' : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: 'Name' },
                { title: 'Category' },
                { title: 'Status' },
                { title: 'Shopify Product' },
                { title: 'Configuration' },
                { title: 'Updated' },
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
