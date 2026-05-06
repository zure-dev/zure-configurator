'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Thumbnail,
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

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  firstVariantId: string | null;
  firstVariantPrice: string;
}

interface ManualFormState {
  name: string;
  handle: string;
  category: string;
  status: string;
  shopifyProductId: string;
  description: string;
}

interface ManualFormErrors {
  name?: string;
  handle?: string;
}

const BLANK_MANUAL_FORM: ManualFormState = {
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
  return fetch(url, {
    credentials: 'include',
    ...options,
  });
}

function validateManualForm(
  form: ManualFormState,
  families: ProductFamily[],
  editingId: string | null
): ManualFormErrors {
  const errors: ManualFormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
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

  // ── List state ──
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Shopify picker modal ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopifySearch, setShopifySearch] = useState('');
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Manual create/edit modal ──
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
  const [manualForm, setManualForm] = useState<ManualFormState>(BLANK_MANUAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<ProductFamily | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Derived ──
  const isEditMode = editingFamily !== null;
  const manualFormErrors = useMemo(
    () => validateManualForm(manualForm, families, editingFamily?.id ?? null),
    [manualForm, families, editingFamily]
  );
  const isManualFormValid = Object.keys(manualFormErrors).length === 0;

  // ────────────────────────────────────────────
  // FETCH families
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
  // SHOPIFY PRODUCT PICKER
  // ────────────────────────────────────────────

  const searchShopifyProducts = useCallback(async (query: string) => {
    setShopifyLoading(true);
    setShopifyError('');
    try {
      const res = await apiFetch(`/api/shopify/products?query=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to search products');
      }
      const data = await res.json();
      setShopifyProducts(data.products ?? []);
    } catch (err) {
      setShopifyError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setShopifySearch('');
    setShopifyProducts([]);
    setShopifyError('');
    setLinkError('');
    // Load all products initially
    searchShopifyProducts('');
  }, [searchShopifyProducts]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setShopifyProducts([]);
    setShopifySearch('');
    setLinkError('');
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setShopifySearch(value);
      // Debounce search
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        searchShopifyProducts(value);
      }, 400);
    },
    [searchShopifyProducts]
  );

  const handleSelectProduct = useCallback(
    async (product: ShopifyProduct) => {
      setLinking(true);
      setLinkError('');
      try {
        const res = await apiFetch('/api/product-families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: product.title,
            handle: product.handle,
            shopifyProductId: product.id,
            shopifyVariantId: product.firstVariantId,
            shopifyProductHandle: product.handle,
            basePrice: parseFloat(product.firstVariantPrice) || 0,
            status: 'DRAFT',
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setLinkError(data.error ?? 'Failed to create product family');
          return;
        }

        const familyId = data.family?.id;
        setPickerOpen(false);
        setSuccessMsg(`"${product.title}" linked successfully`);
        await loadFamilies();

        // Navigate to the new product family detail page
        if (familyId) {
          const shopParam = typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('shop') ?? ''
            : '';
          const detailUrl = shopParam
            ? `/product-families/${familyId}?shop=${shopParam}`
            : `/product-families/${familyId}`;
          router.push(detailUrl);
        }
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLinking(false);
      }
    },
    [loadFamilies, router]
  );

  // ────────────────────────────────────────────
  // MANUAL CREATE/EDIT MODAL
  // ────────────────────────────────────────────

  const openManualCreate = useCallback(() => {
    setEditingFamily(null);
    setManualForm(BLANK_MANUAL_FORM);
    setHandleTouched(false);
    setTouched(new Set());
    setSaveError('');
    setManualModalOpen(true);
  }, []);

  const openEditModal = useCallback((family: ProductFamily) => {
    setEditingFamily(family);
    setManualForm({
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
    setManualModalOpen(true);
  }, []);

  const closeManualModal = useCallback(() => {
    setManualModalOpen(false);
    setEditingFamily(null);
    setSaveError('');
  }, []);

  const setField = useCallback(
    (field: keyof ManualFormState) => (value: string) => {
      setTouched((prev) => new Set(prev).add(field));
      setManualForm((prev) => {
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
    setManualForm((prev) => ({ ...prev, handle: value }));
  }, []);

  const fieldError = useCallback(
    (field: keyof ManualFormErrors): string | undefined => {
      return touched.has(field) ? manualFormErrors[field] : undefined;
    },
    [manualFormErrors, touched]
  );

  const handleManualSave = useCallback(async () => {
    setTouched(new Set(['name', 'handle']));
    if (!isManualFormValid) return;

    setSaving(true);
    setSaveError('');

    const payload: Record<string, unknown> = {
      name: manualForm.name.trim(),
      handle: (manualForm.handle || toHandle(manualForm.name)).trim(),
      status: manualForm.status || 'DRAFT',
      category: manualForm.category || null,
      description: manualForm.description.trim() || null,
      shopifyProductId: manualForm.shopifyProductId.trim() || null,
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

      const name = data.family?.name ?? manualForm.name;
      setManualModalOpen(false);
      setEditingFamily(null);
      setManualForm(BLANK_MANUAL_FORM);
      setHandleTouched(false);
      setTouched(new Set());
      setSuccessMsg(isEditMode ? `"${name}" updated` : `"${name}" created`);
      await loadFamilies();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [manualForm, isManualFormValid, isEditMode, editingFamily, loadFamilies]);

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
      const res = await apiFetch(`/api/product-families/${deleteTarget.id}`, { method: 'DELETE' });
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
  const resourceItems = useMemo(
    () => families.map((family) => ({ id: family.id })),
    [families]
  );
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(resourceItems);

  // ────────────────────────────────────────────
  // Helpers: which Shopify products are already linked
  // ────────────────────────────────────────────

  const linkedShopifyIds = useMemo(
    () => new Set(families.map((f) => f.shopifyProductId).filter(Boolean)),
    [families]
  );

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
  // RENDER: Empty state
  // ────────────────────────────────────────────

  if (families.length === 0 && !successMsg) {
    return (
      <Page title="Product Families">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Link your first Shopify product"
                action={{ content: 'Link Shopify Product', onAction: openPicker }}
                secondaryAction={{ content: 'Create manually', onAction: openManualCreate }}
                image=""
              >
                <p>
                  Select a product from your Shopify store to start building
                  configurator options, rules, and pricing.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
        {renderPickerModal()}
        {renderManualModal()}
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
  // RENDER: Shopify product picker modal
  // ────────────────────────────────────────────

  function renderPickerModal() {
    return (
      <Modal
        open={pickerOpen}
        onClose={closePicker}
        title="Link a Shopify Product"
      >
        <Modal.Section>
          {linkError && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical" onDismiss={() => setLinkError('')}>
                {linkError}
              </Banner>
            </div>
          )}

          <BlockStack gap="400">
            <TextField
              label="Search products"
              value={shopifySearch}
              onChange={handleSearchChange}
              placeholder="Search by product name..."
              autoComplete="off"
              clearButton
              onClearButtonClick={() => handleSearchChange('')}
            />

            {shopifyLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Spinner size="small" />
              </div>
            )}

            {shopifyError && (
              <Banner tone="critical">
                {shopifyError}
              </Banner>
            )}

            {!shopifyLoading && shopifyProducts.length === 0 && !shopifyError && (
              <Text as="p" variant="bodySm" tone="subdued">
                No products found. Try a different search term.
              </Text>
            )}

            {!shopifyLoading && shopifyProducts.length > 0 && (
              <BlockStack gap="200">
                {shopifyProducts.map((product) => {
                  const alreadyLinked = linkedShopifyIds.has(product.id);

                  return (
                    <div
                      key={product.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--p-color-border-subdued, #ddd)',
                        opacity: alreadyLinked ? 0.5 : 1,
                        cursor: alreadyLinked || linking ? 'default' : 'pointer',
                        background: alreadyLinked
                          ? 'var(--p-color-bg-surface-secondary, #f6f6f7)'
                          : 'transparent',
                      }}
                      onClick={() => {
                        if (!alreadyLinked && !linking) {
                          handleSelectProduct(product);
                        }
                      }}
                    >
                      <Thumbnail
                        source={product.featuredImageUrl ?? ''}
                        alt={product.featuredImageAlt ?? product.title}
                        size="small"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {product.title}
                        </Text>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {product.handle}
                          </Text>
                          <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>
                            {product.status}
                          </Badge>
                          {alreadyLinked && (
                            <Badge tone="info">Already linked</Badge>
                          )}
                        </div>
                      </div>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {`$${parseFloat(product.firstVariantPrice).toFixed(2)}`}
                      </Text>
                    </div>
                  );
                })}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>

        {linking && (
          <Modal.Section>
            <InlineStack gap="200" blockAlign="center">
              <Spinner size="small" />
              <Text as="span" variant="bodySm">Linking product...</Text>
            </InlineStack>
          </Modal.Section>
        )}
      </Modal>
    );
  }

  // ────────────────────────────────────────────
  // RENDER: Manual create/edit modal
  // ────────────────────────────────────────────

  function renderManualModal() {
    const title = isEditMode ? `Edit: ${editingFamily!.name}` : 'Create Product Family (Manual)';
    const submitLabel = isEditMode ? 'Save changes' : 'Create';

    return (
      <Modal
        open={manualModalOpen}
        onClose={closeManualModal}
        title={title}
        primaryAction={{
          content: submitLabel,
          onAction: handleManualSave,
          loading: saving,
          disabled: saving || (touched.size > 0 && !isManualFormValid),
        }}
        secondaryActions={[{ content: 'Cancel', onAction: closeManualModal }]}
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
              value={manualForm.name}
              onChange={setField('name')}
              placeholder="e.g. Zure Vanity 600-1500mm"
              helpText="Display name for this product family"
              autoComplete="off"
              requiredIndicator
              error={fieldError('name')}
            />

            <TextField
              label="Handle"
              value={manualForm.handle}
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
              value={manualForm.category}
              onChange={setField('category')}
              helpText="Used to group and filter product families"
            />

            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={manualForm.status}
              onChange={setField('status')}
            />

            <TextField
              label="Shopify Product ID"
              value={manualForm.shopifyProductId}
              onChange={setField('shopifyProductId')}
              placeholder="e.g. gid://shopify/Product/123456789"
              helpText="Optional. Link to the parent Shopify product."
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={manualForm.description}
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
  // RENDER: Delete modal
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
        content: 'Link Shopify Product',
        onAction: openPicker,
      }}
      secondaryActions={[
        { content: 'Create manually', onAction: openManualCreate },
      ]}
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

      {renderPickerModal()}
      {renderManualModal()}
      {renderDeleteModal()}
    </Page>
  );
}
