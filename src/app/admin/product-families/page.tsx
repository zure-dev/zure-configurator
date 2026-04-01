'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
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

interface CreateFormState {
  name: string;
  handle: string;
  category: string;
  status: string;
  shopifyProductId: string;
  description: string;
}

const EMPTY_FORM: CreateFormState = {
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
  { label: 'None', value: '' },
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

function generateHandle(name: string): string {
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

function formatDate(iso: string): string {
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

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ProductFamiliesPage() {
  const router = useRouter();

  // ── List state ──
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // ── Create modal state ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Track whether handle was manually edited ──
  const [handleTouched, setHandleTouched] = useState(false);

  // ── Fetch families ──
  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/product-families');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFamilies(data.families ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load product families';
      setFetchError(msg);
      console.error('[ProductFamilies] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  // ── Create handler ──
  const handleCreate = useCallback(async () => {
    setSaving(true);
    setSaveError('');

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        handle: (form.handle || generateHandle(form.name)).trim(),
        status: form.status,
      };

      // Only include optional fields if they have values
      if (form.category) payload.category = form.category;
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.shopifyProductId.trim()) payload.shopifyProductId = form.shopifyProductId.trim();

      const res = await fetch('/api/product-families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to create product family');
        return;
      }

      // Success — close modal, reset form, refresh list
      setCreateModalOpen(false);
      setForm(EMPTY_FORM);
      setHandleTouched(false);
      await fetchFamilies();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [form, fetchFamilies]);

  // ── Open/close modal ──
  const openCreateModal = useCallback(() => {
    setForm(EMPTY_FORM);
    setHandleTouched(false);
    setSaveError('');
    setCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setSaveError('');
  }, []);

  // ── Form field handlers ──
  const updateField = useCallback(
    (field: keyof CreateFormState) => (value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        // Auto-generate handle from name unless user manually edited it
        if (field === 'name' && !handleTouched) {
          next.handle = generateHandle(value);
        }
        return next;
      });
    },
    [handleTouched]
  );

  const updateHandle = useCallback((value: string) => {
    setHandleTouched(true);
    setForm((prev) => ({ ...prev, handle: value }));
  }, []);

  // ── Index table selection (for future bulk actions) ──
  const resourceName = { singular: 'product family', plural: 'product families' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(families);

  // ──────────────────────────────────────────
  // Render: Loading
  // ──────────────────────────────────────────

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

  // ──────────────────────────────────────────
  // Render: Error
  // ──────────────────────────────────────────

  if (fetchError) {
    return (
      <Page title="Product Families">
        <Layout>
          <Layout.Section>
            <Banner
              tone="critical"
              title="Failed to load product families"
              action={{ content: 'Retry', onAction: fetchFamilies }}
            >
              <p>{fetchError}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // ──────────────────────────────────────────
  // Render: Empty state
  // ──────────────────────────────────────────

  if (families.length === 0) {
    return (
      <Page title="Product Families">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Create your first configurable product"
                action={{ content: 'Create product family', onAction: openCreateModal }}
                image=""
              >
                <p>
                  Product families define the option groups, rules, pricing, and media
                  for your configurable products. Start by creating one.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
        {renderCreateModal()}
      </Page>
    );
  }

  // ──────────────────────────────────────────
  // Render: Table rows
  // ──────────────────────────────────────────

  const rowMarkup = families.map((family, index) => {
    const ruleCount =
      (family._count?.dependencyRules ?? 0) +
      (family._count?.exclusionRules ?? 0);
    const optionCount = family._count?.optionGroups ?? 0;
    const componentCount = family._count?.components ?? 0;

    return (
      <IndexTable.Row
        id={family.id}
        key={family.id}
        position={index}
        selected={selectedResources.includes(family.id)}
        onClick={() => router.push(`/admin/product-families/${family.id}`)}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {family.name}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {family.handle}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          {family.category ? (
            <Badge>{family.category}</Badge>
          ) : (
            <Text as="span" variant="bodySm" tone="subdued">—</Text>
          )}
        </IndexTable.Cell>

        <IndexTable.Cell>
          {statusBadge(family.status)}
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {family.shopifyProductId
              ? family.shopifyProductId.replace('gid://shopify/Product/', '#')
              : '—'}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {optionCount} options · {ruleCount} rules · {componentCount} components
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {formatDate(family.updatedAt)}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ──────────────────────────────────────────
  // Render: Create modal
  // ──────────────────────────────────────────

  function renderCreateModal() {
    return (
      <Modal
        open={createModalOpen}
        onClose={closeCreateModal}
        title="Create Product Family"
        primaryAction={{
          content: 'Create',
          onAction: handleCreate,
          loading: saving,
          disabled: !form.name.trim(),
        }}
        secondaryActions={[
          { content: 'Cancel', onAction: closeCreateModal },
        ]}
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
              onChange={updateField('name')}
              placeholder="e.g. Zure Vanity 600-1500mm"
              helpText="The display name for this product family"
              autoComplete="off"
              requiredIndicator
            />

            <TextField
              label="Handle"
              value={form.handle}
              onChange={updateHandle}
              placeholder="e.g. zure-vanity-600-1500mm"
              helpText="URL-friendly identifier. Auto-generated from name if left empty."
              autoComplete="off"
              connectedLeft={
                <Text as="span" variant="bodySm" tone="subdued">/</Text>
              }
            />

            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={updateField('category')}
              helpText="Group product families by type"
            />

            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={updateField('status')}
            />

            <TextField
              label="Shopify Product ID"
              value={form.shopifyProductId}
              onChange={updateField('shopifyProductId')}
              placeholder="e.g. gid://shopify/Product/123456789"
              helpText="Link to the parent Shopify product. Can be set later."
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={form.description}
              onChange={updateField('description')}
              placeholder="Describe this configurable product..."
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  // ──────────────────────────────────────────
  // Render: Main page
  // ──────────────────────────────────────────

  return (
    <Page
      title="Product Families"
      primaryAction={{
        content: 'Create product family',
        onAction: openCreateModal,
      }}
    >
      <Layout>
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
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {renderCreateModal()}
    </Page>
  );
}
