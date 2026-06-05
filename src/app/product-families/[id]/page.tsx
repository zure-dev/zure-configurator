'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Page, Layout, Card, Text, Badge, Button, BlockStack, InlineStack,
  Spinner, Banner, Modal, FormLayout, TextField, Select, Checkbox,
  Divider, DropZone,
} from '@shopify/polaris';
import { useParams, useRouter } from 'next/navigation';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ConditionRow {
  sourceGroupSlug: string;
  operator: 'equals' | 'not_equals';
  sourceValueSlug: string;
  connector: 'AND' | 'OR' | null;
}

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
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  shopifyProductTitle: string | null;
  shopifyVariantTitle: string | null;
  shopifySku: string | null;
  shopifyImageUrl: string | null;
  shopifyPrice: string | null;
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
  isConditional: boolean;
  visibilityConditions: ConditionRow[] | null;
  values: OptionValue[];
}

interface ProductFamily {
  id: string; name: string; handle: string; slug: string;
  category: string | null; description: string | null;
  status: string; basePrice: string; shopifyProductId: string | null;
}

interface ShopifyVariant {
  id: string; title: string; price: string; sku: string | null;
  imageUrl: string | null; imageAlt: string | null;
  inventoryQuantity: number | null;
  selectedOptions: { name: string; value: string }[];
}

interface ShopifyProductWithVariants {
  id: string; title: string; handle: string; status: string;
  featuredImageUrl: string | null; featuredImageAlt: string | null;
  variants: ShopifyVariant[];
}

interface GroupFormState {
  name: string; slug: string; displayType: string; sortOrder: string;
  isRequired: boolean; helperText: string; stepNumber: string;
  isConditional: boolean; conditions: ConditionRow[];
}

interface ValueFormState {
  name: string; slug: string; sortOrder: string; isDefault: boolean;
  swatchColor: string; thumbnailUrl: string; description: string;
  shopifyProductId: string; shopifyVariantId: string;
  shopifyProductTitle: string; shopifyVariantTitle: string;
  shopifySku: string; shopifyImageUrl: string; shopifyPrice: string;
}

const BLANK_GROUP: GroupFormState = {
  name: '', slug: '', displayType: 'TILE', sortOrder: '', isRequired: true,
  helperText: '', stepNumber: '', isConditional: false, conditions: [],
};

const BLANK_VALUE: ValueFormState = {
  name: '', slug: '', sortOrder: '', isDefault: false,
  swatchColor: '', thumbnailUrl: '', description: '',
  shopifyProductId: '', shopifyVariantId: '', shopifyProductTitle: '',
  shopifyVariantTitle: '', shopifySku: '', shopifyImageUrl: '', shopifyPrice: '',
};

const DISPLAY_TYPE_OPTIONS = [
  { label: 'Tile', value: 'TILE' }, { label: 'Swatch', value: 'SWATCH' },
  { label: 'Thumbnail', value: 'THUMBNAIL' }, { label: 'Dropdown', value: 'DROPDOWN' },
  { label: 'Radio', value: 'RADIO' }, { label: 'Toggle', value: 'TOGGLE' },
];

const OPERATOR_OPTIONS = [
  { label: 'equals', value: 'equals' },
  { label: 'not equals', value: 'not_equals' },
];

const COLOR_PRESETS = [
  '#FFFFFF', '#F5F5DC', '#D2B48C', '#8B6914', '#4A3728',
  '#2C2C2C', '#000000', '#808080', '#C0C0C0', '#B5651D',
  '#556B2F', '#1E3A5F', '#8B0000', '#4B0082', '#CD853F',
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let shopDomain = '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    shopDomain = params.get('shop') ?? '';
  }
  const separator = path.includes('?') ? '&' : '?';
  const url = shopDomain ? `${path}${separator}shop=${shopDomain}` : path;
  return fetch(url, { credentials: 'include', ...options });
}

function displayTypeBadge(dt: string) {
  const tones: Record<string, 'info' | 'success' | 'attention' | undefined> = {
    SWATCH: 'success', TILE: 'info', THUMBNAIL: 'attention',
  };
  return <Badge tone={tones[dt]}>{dt}</Badge>;
}

function isValidHex(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
}

/**
 * Evaluate conditional visibility for an option group.
 * Logic: split conditions by OR connectors into segments.
 * Within each segment, all conditions must be AND-satisfied.
 * If ANY segment passes, the group is visible.
 * Empty conditions = always visible.
 */
function evaluateVisibility(
  conditions: ConditionRow[] | null | undefined,
  selections: Record<string, string>
): boolean {
  if (!conditions || conditions.length === 0) return true;

  // Split into OR-segments
  const segments: ConditionRow[][] = [];
  let current: ConditionRow[] = [];

  for (const cond of conditions) {
    current.push(cond);
    if (cond.connector === 'OR' || cond.connector === null) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);

  // Any segment passing = visible
  return segments.some((segment) =>
    segment.every((cond) => {
      const selected = selections[cond.sourceGroupSlug];
      if (cond.operator === 'equals') return selected === cond.sourceValueSlug;
      if (cond.operator === 'not_equals') return selected !== cond.sourceValueSlug;
      return true;
    })
  );
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ProductFamilyBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const familyId = params.id as string;

  const [family, setFamily] = useState<ProductFamily | null>(null);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(BLANK_GROUP);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [groupSlugTouched, setGroupSlugTouched] = useState(false);

  // Value modal
  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<OptionValue | null>(null);
  const [valueTargetGroupId, setValueTargetGroupId] = useState('');
  const [valueForm, setValueForm] = useState<ValueFormState>(BLANK_VALUE);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueError, setValueError] = useState('');
  const [valueSlugTouched, setValueSlugTouched] = useState(false);

  // Image + color
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Shopify picker
  const [shopifyPickerOpen, setShopifyPickerOpen] = useState(false);
  const [shopifySearchQuery, setShopifySearchQuery] = useState('');
  const [shopifySearchResults, setShopifySearchResults] = useState<ShopifyProductWithVariants[]>([]);
  const [shopifySearchLoading, setShopifySearchLoading] = useState(false);
  const [shopifySearchError, setShopifySearchError] = useState('');
  const shopifySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'group' | 'value'; id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Duplicate
  const [duplicating, setDuplicating] = useState(false);

  // Preview
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>({});

  // ── FETCH ──
  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [famRes, grpRes] = await Promise.all([
        apiFetch(`/api/product-families/${familyId}`),
        apiFetch(`/api/options?familyId=${familyId}`),
      ]);
      if (!famRes.ok) { const b = await famRes.json().catch(() => ({})); throw new Error(b.error ?? 'Failed to load product family'); }
      if (!grpRes.ok) { const b = await grpRes.json().catch(() => ({})); throw new Error(b.error ?? 'Failed to load option groups'); }
      const famData = await famRes.json();
      const grpData = await grpRes.json();
      setFamily(famData.family);
      setGroups(grpData.optionGroups ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [familyId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (!successMsg) return; const t = setTimeout(() => setSuccessMsg(''), 3000); return () => clearTimeout(t); }, [successMsg]);

  // ── IMAGE UPLOAD ──
  const handleImageUpload = useCallback(async (file: File) => {
    setImageUploading(true); setImageUploadError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await apiFetch('/api/media/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setImageUploadError(data.error ?? 'Upload failed'); return; }
      setValueForm((prev) => ({ ...prev, thumbnailUrl: data.url }));
    } catch (err: unknown) { setImageUploadError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setImageUploading(false); }
  }, []);

  const handleDropZoneDrop = useCallback((_dropFiles: File[], acceptedFiles: File[]) => {
    const file = acceptedFiles[0]; if (!file) return; handleImageUpload(file);
  }, [handleImageUpload]);

  const removeImage = useCallback(() => { setValueForm((prev) => ({ ...prev, thumbnailUrl: '' })); setImageUploadError(''); }, []);

  // ── SHOPIFY PICKER ──
  const searchShopifyForValue = useCallback(async (query: string) => {
    setShopifySearchLoading(true); setShopifySearchError('');
    try {
      const res = await apiFetch(`/api/shopify/products?query=${encodeURIComponent(query)}&includeVariants=true&limit=10`);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Search failed'); }
      const data = await res.json(); setShopifySearchResults(data.products ?? []);
    } catch (err: unknown) { setShopifySearchError(err instanceof Error ? err.message : 'Search failed'); }
    finally { setShopifySearchLoading(false); }
  }, []);

  const openShopifyPicker = useCallback(() => {
    setShopifyPickerOpen(true); setShopifySearchQuery(''); setShopifySearchResults([]); setShopifySearchError('');
    searchShopifyForValue('');
  }, [searchShopifyForValue]);

  const handleShopifySearchChange = useCallback((value: string) => {
    setShopifySearchQuery(value);
    if (shopifySearchTimer.current) clearTimeout(shopifySearchTimer.current);
    shopifySearchTimer.current = setTimeout(() => searchShopifyForValue(value), 400);
  }, [searchShopifyForValue]);

  const selectShopifyVariant = useCallback((product: ShopifyProductWithVariants, variant: ShopifyVariant) => {
    setValueForm((prev) => ({
      ...prev,
      shopifyProductId: product.id, shopifyVariantId: variant.id,
      shopifyProductTitle: product.title, shopifyVariantTitle: variant.title,
      shopifySku: variant.sku ?? '', shopifyImageUrl: variant.imageUrl ?? product.featuredImageUrl ?? '',
      shopifyPrice: variant.price,
      ...(prev.name ? {} : { name: variant.title === 'Default Title' ? product.title : `${product.title} — ${variant.title}` }),
      ...(prev.thumbnailUrl ? {} : { thumbnailUrl: variant.imageUrl ?? product.featuredImageUrl ?? '' }),
    }));
    setShopifyPickerOpen(false);
  }, []);

  const unlinkShopifyProduct = useCallback(() => {
    setValueForm((prev) => ({ ...prev, shopifyProductId: '', shopifyVariantId: '', shopifyProductTitle: '', shopifyVariantTitle: '', shopifySku: '', shopifyImageUrl: '', shopifyPrice: '' }));
  }, []);

  // ── GROUP CRUD ──
  const openAddGroup = useCallback(() => {
    setEditingGroup(null);
    setGroupForm({ ...BLANK_GROUP, sortOrder: String(groups.length) });
    setGroupSlugTouched(false); setGroupError(''); setGroupModalOpen(true);
  }, [groups.length]);

  const openEditGroup = useCallback((group: OptionGroup) => {
    setEditingGroup(group);
    const conditions: ConditionRow[] = Array.isArray(group.visibilityConditions)
      ? (group.visibilityConditions as ConditionRow[])
      : [];
    setGroupForm({
      name: group.name, slug: group.slug, displayType: group.displayType,
      sortOrder: String(group.sortOrder), isRequired: group.isRequired,
      helperText: group.helperText ?? '', stepNumber: group.stepNumber != null ? String(group.stepNumber) : '',
      isConditional: group.isConditional, conditions,
    });
    setGroupSlugTouched(true); setGroupError(''); setGroupModalOpen(true);
  }, []);

  const saveGroup = useCallback(async () => {
    if (!groupForm.name.trim()) { setGroupError('Name is required'); return; }
    setGroupSaving(true); setGroupError('');
    const slug = (groupForm.slug || toSlug(groupForm.name)).trim();
    const payload: Record<string, unknown> = {
      productFamilyId: familyId, name: groupForm.name.trim(), slug,
      displayType: groupForm.displayType, isRequired: groupForm.isRequired,
      helperText: groupForm.helperText.trim() || null,
      stepNumber: groupForm.stepNumber ? parseInt(groupForm.stepNumber, 10) : null,
      isConditional: groupForm.isConditional,
      visibilityConditions: groupForm.isConditional && groupForm.conditions.length > 0
        ? groupForm.conditions : null,
    };
    if (groupForm.sortOrder) payload.sortOrder = parseInt(groupForm.sortOrder, 10);
    try {
      const isEdit = editingGroup !== null;
      const url = isEdit ? `/api/options/${editingGroup?.id ?? ''}` : '/api/options';
      const res = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setGroupError(data.error ?? 'Save failed'); return; }
      setGroupModalOpen(false); setSuccessMsg(isEdit ? `"${groupForm.name}" updated` : `"${groupForm.name}" added`); await loadData();
    } catch (err: unknown) { setGroupError(err instanceof Error ? err.message : 'Network error'); }
    finally { setGroupSaving(false); }
  }, [groupForm, editingGroup, familyId, loadData]);

  // ── DUPLICATE GROUP ──
  const handleDuplicateGroup = useCallback(async (groupId: string, groupName: string) => {
    setDuplicating(true);
    try {
      const res = await apiFetch(`/api/options/${groupId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Duplicate failed'); return; }
      setSuccessMsg(`"${groupName}" duplicated`); await loadData();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Duplicate failed'); }
    finally { setDuplicating(false); }
  }, [loadData]);

  // ── VALUE CRUD ──
  const openAddValue = useCallback((groupId: string) => {
    setValueTargetGroupId(groupId); setEditingValue(null);
    const group = groups.find((g) => g.id === groupId);
    setValueForm({ ...BLANK_VALUE, sortOrder: String(group?.values.length ?? 0) });
    setValueSlugTouched(false); setValueError(''); setImageUploadError(''); setShowColorPicker(false); setValueModalOpen(true);
  }, [groups]);

  const openEditValue = useCallback((groupId: string, value: OptionValue) => {
    setValueTargetGroupId(groupId); setEditingValue(value);
    setValueForm({
      name: value.name, slug: value.slug, sortOrder: String(value.sortOrder), isDefault: value.isDefault,
      swatchColor: value.swatchColor ?? '', thumbnailUrl: value.thumbnailUrl ?? '', description: value.description ?? '',
      shopifyProductId: value.shopifyProductId ?? '', shopifyVariantId: value.shopifyVariantId ?? '',
      shopifyProductTitle: value.shopifyProductTitle ?? '', shopifyVariantTitle: value.shopifyVariantTitle ?? '',
      shopifySku: value.shopifySku ?? '', shopifyImageUrl: value.shopifyImageUrl ?? '', shopifyPrice: value.shopifyPrice ?? '',
    });
    setValueSlugTouched(true); setValueError(''); setImageUploadError(''); setShowColorPicker(false); setValueModalOpen(true);
  }, []);

  const saveValue = useCallback(async () => {
    if (!valueForm.name.trim()) { setValueError('Name is required'); return; }
    setValueSaving(true); setValueError('');
    const slug = (valueForm.slug || toSlug(valueForm.name)).trim();
    const isEdit = editingValue !== null;
    const payload: Record<string, unknown> = {
      optionGroupId: valueTargetGroupId, name: valueForm.name.trim(), slug,
      isDefault: valueForm.isDefault, swatchColor: valueForm.swatchColor.trim() || null,
      thumbnailUrl: valueForm.thumbnailUrl.trim() || null, description: valueForm.description.trim() || null,
      shopifyProductId: valueForm.shopifyProductId.trim() || null, shopifyVariantId: valueForm.shopifyVariantId.trim() || null,
      shopifyProductTitle: valueForm.shopifyProductTitle.trim() || null, shopifyVariantTitle: valueForm.shopifyVariantTitle.trim() || null,
      shopifySku: valueForm.shopifySku.trim() || null, shopifyImageUrl: valueForm.shopifyImageUrl.trim() || null,
      shopifyPrice: valueForm.shopifyPrice ? parseFloat(valueForm.shopifyPrice) : null,
    };
    if (valueForm.sortOrder) payload.sortOrder = parseInt(valueForm.sortOrder, 10);
    try {
      const url = isEdit ? `/api/option-values/${editingValue?.id ?? ''}` : '/api/option-values';
      const res = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setValueError(data.error ?? 'Save failed'); return; }
      setValueModalOpen(false); setSuccessMsg(isEdit ? `"${valueForm.name}" updated` : `"${valueForm.name}" added`); await loadData();
    } catch (err: unknown) { setValueError(err instanceof Error ? err.message : 'Network error'); }
    finally { setValueSaving(false); }
  }, [valueForm, editingValue, valueTargetGroupId, loadData]);

  // ── DELETE ──
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return; setDeleteLoading(true); setDeleteError('');
    try {
      const url = deleteTarget.type === 'group' ? `/api/options/${deleteTarget.id}` : `/api/option-values/${deleteTarget.id}`;
      const res = await apiFetch(url, { method: 'DELETE' });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setDeleteError(b.error ?? 'Delete failed'); return; }
      setDeleteTarget(null); setSuccessMsg(`"${deleteTarget.name}" deleted`); await loadData();
    } catch (err: unknown) { setDeleteError(err instanceof Error ? err.message : 'Network error'); }
    finally { setDeleteLoading(false); }
  }, [deleteTarget, loadData]);

  // ── CONDITION ROWS ──
  const addConditionRow = useCallback(() => {
    setGroupForm((prev) => {
      const updated = prev.conditions.map((c, i) =>
        i === prev.conditions.length - 1 ? { ...c, connector: 'AND' as const } : c
      );
      return { ...prev, conditions: [...updated, { sourceGroupSlug: '', operator: 'equals' as const, sourceValueSlug: '', connector: null }] };
    });
  }, []);

  const removeConditionRow = useCallback((index: number) => {
    setGroupForm((prev) => {
      const next = prev.conditions.filter((_, i) => i !== index);
      const last = next[next.length - 1];
      if (last) { next[next.length - 1] = { ...last, connector: null }; }
      return { ...prev, conditions: next };
    });
  }, []);

  const updateConditionRow = useCallback((index: number, field: keyof ConditionRow, value: string | null) => {
    setGroupForm((prev) => {
      const next = [...prev.conditions];
      const row = next[index];
      if (!row) return prev;
      let updatedRow: ConditionRow = { ...row, [field]: value };
      // Reset value when group changes
      if (field === 'sourceGroupSlug') updatedRow = { ...updatedRow, sourceValueSlug: '' };
      next[index] = updatedRow;
      return { ...prev, conditions: next };
    });
  }, []);

  // ── LOADING ──
  if (loading) {
    return (<Page title="Loading..."><Layout><Layout.Section><Card>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner size="large" /></div>
    </Card></Layout.Section></Layout></Page>);
  }

  if (error || !family) {
    return (<Page title="Product Family" backAction={{ content: 'Back', onAction: () => router.push('/product-families') }}>
      <Layout><Layout.Section>
        <Banner tone="critical" title="Could not load product family" action={{ content: 'Retry', onAction: loadData }}>
          <p>{error || 'Product family not found'}</p>
        </Banner>
      </Layout.Section></Layout></Page>);
  }

  // ── CONDITIONAL GROUP OPTIONS (for dropdowns in condition UI) ──
  // Exclude the group being edited from condition sources
  const editingGroupSlug = editingGroup?.slug ?? groupForm.slug;
  const otherGroups = groups.filter((g) => g.slug !== editingGroupSlug);
  const groupOptions = [{ label: '— Select group —', value: '' }, ...otherGroups.map((g) => ({ label: g.name, value: g.slug }))];

  function getValueOptionsForGroup(groupSlug: string): { label: string; value: string }[] {
    const group = groups.find((g) => g.slug === groupSlug);
    if (!group) return [{ label: '— Select value —', value: '' }];
    return [{ label: '— Select value —', value: '' }, ...group.values.map((v) => ({ label: v.name, value: v.slug }))];
  }

  // ── RENDER: Preview ──
  function renderPreview() {
    if (groups.length === 0) {
      return (<Card><BlockStack gap="200">
        <Text as="h2" variant="headingSm">Live Preview</Text>
        <Text as="p" variant="bodySm" tone="subdued">Add option groups to see a preview.</Text>
      </BlockStack></Card>);
    }

    const visibleGroups = groups.filter((g) =>
      !g.isConditional || evaluateVisibility(g.visibilityConditions, previewSelections)
    );

    return (<Card><BlockStack gap="400">
      <Text as="h2" variant="headingSm">Live Preview</Text>
      {visibleGroups.map((group) => (
        <BlockStack key={group.id} gap="200">
          <InlineStack gap="100" blockAlign="center">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{group.name}</Text>
            {group.isRequired && <Text as="span" variant="bodySm" tone="critical">*</Text>}
          </InlineStack>
          {group.helperText && <Text as="span" variant="bodySm" tone="subdued">{group.helperText}</Text>}
          <InlineStack gap="200" wrap>
            {group.values.map((val) => {
              const selected = previewSelections[group.slug] === val.slug;
              const base: React.CSSProperties = {
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', minWidth: '60px',
                textAlign: 'center', transition: 'all 0.15s ease',
                border: selected ? '2px solid var(--p-color-border-interactive, #2c6ecb)' : '1px solid var(--p-color-border-subdued, #ddd)',
                background: selected ? 'var(--p-color-bg-surface-selected, #f0f5ff)' : 'transparent',
              };
              if (group.displayType === 'SWATCH' && val.swatchColor) {
                return (<div key={val.id} onClick={() => setPreviewSelections((p) => ({ ...p, [group.slug]: val.slug }))}
                  style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: val.swatchColor, border: '1px solid #ccc' }} />
                  <Text as="span" variant="bodySm">{val.name}</Text>
                </div>);
              }
              if ((group.displayType === 'THUMBNAIL' || group.displayType === 'TILE') && val.thumbnailUrl) {
                return (<div key={val.id} onClick={() => setPreviewSelections((p) => ({ ...p, [group.slug]: val.slug }))}
                  style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px' }}>
                  <img src={val.thumbnailUrl} alt={val.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                  <Text as="span" variant="bodySm">{val.name}</Text>
                </div>);
              }
              return (<div key={val.id} onClick={() => setPreviewSelections((p) => ({ ...p, [group.slug]: val.slug }))} style={base}>
                <Text as="span" variant="bodySm">{val.name}</Text>
              </div>);
            })}
          </InlineStack>
        </BlockStack>
      ))}
      {visibleGroups.length < groups.length && (
        <Text as="p" variant="bodySm" tone="subdued">
          {`${groups.length - visibleGroups.length} group${groups.length - visibleGroups.length !== 1 ? 's' : ''} hidden by conditional rules`}
        </Text>
      )}
    </BlockStack></Card>);
  }

  // ── RENDER: Option Builder ──
  function renderOptionBuilder() {
    return (<BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h2" variant="headingSm">Option Groups</Text>
        <Button onClick={openAddGroup}>Add Option Group</Button>
      </InlineStack>
      {groups.length === 0 && (<Card><BlockStack gap="200">
        <Text as="p" variant="bodyMd">No option groups yet.</Text>
        <Text as="p" variant="bodySm" tone="subdued">Create your first option group to start building the configurator.</Text>
      </BlockStack></Card>)}
      {groups.map((group) => {
        const isVisible = !group.isConditional || evaluateVisibility(group.visibilityConditions, previewSelections);
        return (
        <Card key={group.id}>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodyMd" fontWeight="bold">{group.name}</Text>
                {displayTypeBadge(group.displayType)}
                {group.isRequired && <Badge tone="info">Required</Badge>}
                {group.isConditional && <Badge tone="warning">Conditional</Badge>}
                {group.isConditional && !isVisible && <Badge tone="attention">Hidden</Badge>}
                <Text as="span" variant="bodySm" tone="subdued">{group.slug}</Text>
              </InlineStack>
              <InlineStack gap="100">
                <Button size="slim" variant="plain" onClick={() => openEditGroup(group)}>Edit</Button>
                <Button size="slim" variant="plain" onClick={() => handleDuplicateGroup(group.id, group.name)} loading={duplicating}>Duplicate</Button>
                <Button size="slim" variant="plain" tone="critical" onClick={() => setDeleteTarget({ type: 'group', id: group.id, name: group.name })}>Delete</Button>
              </InlineStack>
            </InlineStack>
            {group.helperText && <Text as="span" variant="bodySm" tone="subdued">{group.helperText}</Text>}
            <Divider />
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodySm" fontWeight="semibold">{`Values (${group.values.length})`}</Text>
                <Button size="slim" onClick={() => openAddValue(group.id)}>Add Value</Button>
              </InlineStack>
              {group.values.length === 0 && <Text as="p" variant="bodySm" tone="subdued">No values yet.</Text>}
              {group.values.map((val) => (
                <div key={val.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--p-color-border-subdued, #e1e3e5)' }}>
                  {val.swatchColor && <div style={{ width: 20, height: 20, borderRadius: '50%', background: val.swatchColor, border: '1px solid #ccc', flexShrink: 0 }} />}
                  {val.thumbnailUrl && !val.swatchColor && <img src={val.thumbnailUrl} alt={val.name} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text as="span" variant="bodySm" fontWeight="semibold">{val.name}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{` (${val.slug})`}</Text>
                  </div>
                  {val.isDefault && <Badge tone="success">Default</Badge>}
                  {val.shopifyProductId && <Badge>Linked</Badge>}
                  <Button size="slim" variant="plain" onClick={() => openEditValue(group.id, val)}>Edit</Button>
                  <Button size="slim" variant="plain" tone="critical" onClick={() => setDeleteTarget({ type: 'value', id: val.id, name: val.name })}>Delete</Button>
                </div>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      );})}
    </BlockStack>);
  }

  // ── RENDER: Group Modal ──
  function renderGroupModal() {
    const isEdit = editingGroup !== null;
    return (<Modal open={groupModalOpen} onClose={() => setGroupModalOpen(false)}
      title={isEdit ? `Edit: ${editingGroup?.name ?? ''}` : 'Add Option Group'}
      primaryAction={{ content: isEdit ? 'Save' : 'Add', onAction: saveGroup, loading: groupSaving, disabled: !groupForm.name.trim() }}
      secondaryActions={[{ content: 'Cancel', onAction: () => setGroupModalOpen(false) }]}>
      <Modal.Section>
        {groupError && <div style={{ marginBottom: 12 }}><Banner tone="critical" onDismiss={() => setGroupError('')}>{groupError}</Banner></div>}
        <FormLayout>
          <TextField label="Name" value={groupForm.name} autoComplete="off" requiredIndicator
            onChange={(v: string) => setGroupForm((p) => ({ ...p, name: v, ...(groupSlugTouched ? {} : { slug: toSlug(v) }) }))}
            placeholder="e.g. Vanity Size" />
          <TextField label="Slug" value={groupForm.slug} autoComplete="off"
            onChange={(v: string) => { setGroupSlugTouched(true); setGroupForm((p) => ({ ...p, slug: v })); }} helpText="Auto-generated from name" />
          <Select label="Display Type" options={DISPLAY_TYPE_OPTIONS} value={groupForm.displayType}
            onChange={(v: string) => setGroupForm((p) => ({ ...p, displayType: v }))} />
          <Checkbox label="Required" checked={groupForm.isRequired}
            onChange={(v: boolean) => setGroupForm((p) => ({ ...p, isRequired: v }))} />
          <FormLayout.Group>
            <TextField label="Sort Order" value={groupForm.sortOrder} type="number" autoComplete="off"
              onChange={(v: string) => setGroupForm((p) => ({ ...p, sortOrder: v }))} />
            <TextField label="Step Number" value={groupForm.stepNumber} type="number" autoComplete="off"
              onChange={(v: string) => setGroupForm((p) => ({ ...p, stepNumber: v }))} placeholder="Optional" />
          </FormLayout.Group>
          <TextField label="Helper Text" value={groupForm.helperText} autoComplete="off"
            onChange={(v: string) => setGroupForm((p) => ({ ...p, helperText: v }))} placeholder="Shown below the group name" />
        </FormLayout>
      </Modal.Section>

      {/* ── Conditional Visibility ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Checkbox label="Enable conditional visibility" checked={groupForm.isConditional}
            onChange={(v: boolean) => setGroupForm((p) => ({ ...p, isConditional: v }))}
            helpText="When enabled, this group only appears if the conditions are met" />

          {groupForm.isConditional && (
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" fontWeight="semibold">Conditions</Text>

              {groupForm.conditions.map((cond, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <Select label={idx === 0 ? 'When group' : ''} labelHidden={idx > 0}
                      options={groupOptions} value={cond.sourceGroupSlug}
                      onChange={(v: string) => updateConditionRow(idx, 'sourceGroupSlug', v)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Select label={idx === 0 ? 'Operator' : ''} labelHidden={idx > 0}
                      options={OPERATOR_OPTIONS} value={cond.operator}
                      onChange={(v: string) => updateConditionRow(idx, 'operator', v)} />
                  </div>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <Select label={idx === 0 ? 'Value' : ''} labelHidden={idx > 0}
                      options={getValueOptionsForGroup(cond.sourceGroupSlug)} value={cond.sourceValueSlug}
                      onChange={(v: string) => updateConditionRow(idx, 'sourceValueSlug', v)} />
                  </div>
                  {idx < groupForm.conditions.length - 1 && (
                    <div style={{ minWidth: 70 }}>
                      <Select label="" labelHidden options={[{ label: 'AND', value: 'AND' }, { label: 'OR', value: 'OR' }]}
                        value={cond.connector ?? 'AND'}
                        onChange={(v: string) => updateConditionRow(idx, 'connector', v)} />
                    </div>
                  )}
                  <Button size="slim" variant="plain" tone="critical" onClick={() => removeConditionRow(idx)}>✕</Button>
                </div>
              ))}

              <Button size="slim" onClick={addConditionRow}>Add condition</Button>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>);
  }

  // ── RENDER: Value Modal ──
  function renderValueModal() {
    const isEdit = editingValue !== null;
    const hasImage = !!valueForm.thumbnailUrl;
    const hasColor = !!valueForm.swatchColor && isValidHex(valueForm.swatchColor);
    return (<Modal open={valueModalOpen} onClose={() => setValueModalOpen(false)}
      title={isEdit ? `Edit: ${editingValue?.name ?? ''}` : 'Add Option Value'}
      primaryAction={{ content: isEdit ? 'Save' : 'Add', onAction: saveValue, loading: valueSaving, disabled: !valueForm.name.trim() }}
      secondaryActions={[{ content: 'Cancel', onAction: () => setValueModalOpen(false) }]}>
      <Modal.Section>
        {valueError && <div style={{ marginBottom: 12 }}><Banner tone="critical" onDismiss={() => setValueError('')}>{valueError}</Banner></div>}
        <FormLayout>
          <TextField label="Name" value={valueForm.name} autoComplete="off" requiredIndicator
            onChange={(v: string) => setValueForm((p) => ({ ...p, name: v, ...(valueSlugTouched ? {} : { slug: toSlug(v) }) }))}
            placeholder="e.g. 900mm, Woodland Oak" />
          <TextField label="Slug" value={valueForm.slug} autoComplete="off"
            onChange={(v: string) => { setValueSlugTouched(true); setValueForm((p) => ({ ...p, slug: v })); }} helpText="Auto-generated from name" />
          <FormLayout.Group>
            <TextField label="Sort Order" value={valueForm.sortOrder} type="number" autoComplete="off"
              onChange={(v: string) => setValueForm((p) => ({ ...p, sortOrder: v }))} />
            <div style={{ paddingTop: 24 }}>
              <Checkbox label="Default selection" checked={valueForm.isDefault}
                onChange={(v: boolean) => setValueForm((p) => ({ ...p, isDefault: v }))} />
            </div>
          </FormLayout.Group>
        </FormLayout>
      </Modal.Section>

      {/* Linked Shopify Product */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="span" variant="bodyMd" fontWeight="semibold">Linked Shopify Product</Text>
          {valueForm.shopifyProductId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid var(--p-color-border-subdued, #ddd)', background: 'var(--p-color-bg-surface-secondary, #f6f6f7)' }}>
              {valueForm.shopifyImageUrl && <img src={valueForm.shopifyImageUrl} alt={valueForm.shopifyProductTitle} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <Text as="span" variant="bodySm" fontWeight="semibold">{valueForm.shopifyProductTitle}</Text>
                {valueForm.shopifyVariantTitle && valueForm.shopifyVariantTitle !== 'Default Title' && <Text as="p" variant="bodySm" tone="subdued">{valueForm.shopifyVariantTitle}</Text>}
                <InlineStack gap="200">
                  {valueForm.shopifySku && <Text as="span" variant="bodySm" tone="subdued">{`SKU: ${valueForm.shopifySku}`}</Text>}
                  {valueForm.shopifyPrice && <Text as="span" variant="bodySm" tone="subdued">{`$${parseFloat(valueForm.shopifyPrice).toFixed(2)}`}</Text>}
                </InlineStack>
              </div>
              <Button size="slim" variant="plain" tone="critical" onClick={unlinkShopifyProduct}>Unlink</Button>
            </div>
          ) : (
            <Button onClick={openShopifyPicker} variant="secondary">Link Shopify Product / Variant</Button>
          )}
          <Text as="span" variant="bodySm" tone="subdued">Optional. Link to a Shopify product so inventory updates correctly.</Text>
        </BlockStack>
      </Modal.Section>

      {/* Image */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="span" variant="bodyMd" fontWeight="semibold">Image</Text>
          {hasImage ? (
            <InlineStack gap="300" blockAlign="center">
              <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f7' }}>
                <img src={valueForm.thumbnailUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
              </div>
              <Button size="slim" variant="plain" tone="critical" onClick={removeImage}>Remove</Button>
            </InlineStack>
          ) : (
            <DropZone accept="image/*" type="image" onDrop={handleDropZoneDrop} allowMultiple={false} variableHeight>
              {imageUploading ? (
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                  <InlineStack gap="200" blockAlign="center"><Spinner size="small" /><Text as="span" variant="bodySm">Uploading...</Text></InlineStack>
                </div>
              ) : <DropZone.FileUpload actionTitle="Upload image" actionHint="or drag and drop (JPEG, PNG, WebP — max 5MB)" />}
            </DropZone>
          )}
          {imageUploadError && <Banner tone="critical" onDismiss={() => setImageUploadError('')}>{imageUploadError}</Banner>}
          {!hasImage && <TextField label="Or paste image URL" value={valueForm.thumbnailUrl} autoComplete="off"
            onChange={(v: string) => setValueForm((p) => ({ ...p, thumbnailUrl: v }))} placeholder="https://..." />}
        </BlockStack>
      </Modal.Section>

      {/* Swatch Color */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="span" variant="bodyMd" fontWeight="semibold">Swatch Color</Text>
          <InlineStack gap="300" blockAlign="center">
            <div onClick={() => setShowColorPicker((p) => !p)} style={{
              width: 40, height: 40, borderRadius: 8, cursor: 'pointer',
              background: hasColor ? valueForm.swatchColor : 'linear-gradient(135deg, #f0f0f0 25%, #ddd 25%, #ddd 50%, #f0f0f0 50%, #f0f0f0 75%, #ddd 75%)',
              backgroundSize: hasColor ? undefined : '8px 8px',
              border: '2px solid #ccc', boxShadow: hasColor ? `0 2px 8px ${valueForm.swatchColor}40` : 'none',
            }} title="Click to open color picker" />
            <div style={{ flex: 1 }}>
              <TextField label="Hex color" value={valueForm.swatchColor} autoComplete="off" labelHidden prefix="#"
                onChange={(v: string) => setValueForm((p) => ({ ...p, swatchColor: v }))} placeholder="8B6914" />
            </div>
            {hasColor && <Button size="slim" variant="plain" tone="critical" onClick={() => setValueForm((p) => ({ ...p, swatchColor: '' }))}>Clear</Button>}
          </InlineStack>
          {showColorPicker && (
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Quick select</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLOR_PRESETS.map((color) => (
                  <div key={color} onClick={() => { setValueForm((p) => ({ ...p, swatchColor: color })); setShowColorPicker(false); }}
                    style={{ width: 28, height: 28, borderRadius: 6, cursor: 'pointer', background: color,
                      border: valueForm.swatchColor === color ? '2px solid #2c6ecb' : '1px solid #ccc' }} title={color} />
                ))}
              </div>
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodySm" tone="subdued">Custom:</Text>
                <input type="color" value={hasColor ? valueForm.swatchColor : '#000000'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValueForm((p) => ({ ...p, swatchColor: e.target.value }))}
                  style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'transparent' }} />
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>

      {/* Description */}
      <Modal.Section>
        <TextField label="Description" value={valueForm.description} autoComplete="off" multiline={2}
          onChange={(v: string) => setValueForm((p) => ({ ...p, description: v }))} placeholder="Short description shown as tooltip" />
      </Modal.Section>
    </Modal>);
  }

  // ── RENDER: Shopify Picker Modal ──
  function renderShopifyPickerModal() {
    return (<Modal open={shopifyPickerOpen} onClose={() => setShopifyPickerOpen(false)} title="Link Shopify Product / Variant">
      <Modal.Section>
        <BlockStack gap="300">
          <TextField label="Search products" value={shopifySearchQuery} onChange={handleShopifySearchChange}
            placeholder="Search by name or SKU..." autoComplete="off" clearButton onClearButtonClick={() => handleShopifySearchChange('')} />
          {shopifySearchLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><Spinner size="small" /></div>}
          {shopifySearchError && <Banner tone="critical">{shopifySearchError}</Banner>}
          {!shopifySearchLoading && shopifySearchResults.length === 0 && !shopifySearchError && <Text as="p" variant="bodySm" tone="subdued">No products found.</Text>}
          {!shopifySearchLoading && shopifySearchResults.map((product) => (
            <div key={product.id} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--p-color-bg-surface-secondary, #f6f6f7)' }}>
                {product.featuredImageUrl && <img src={product.featuredImageUrl} alt={product.title} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}><Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text></div>
                <Badge tone={product.status === 'ACTIVE' ? 'success' : undefined}>{product.status}</Badge>
              </div>
              {product.variants.map((variant) => (
                <div key={variant.id} onClick={() => selectShopifyVariant(product, variant)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px 8px 24px', cursor: 'pointer', borderTop: '1px solid #eee' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f2f3'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  {variant.imageUrl && <img src={variant.imageUrl} alt={variant.title} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <Text as="span" variant="bodySm">{variant.title === 'Default Title' ? 'Default' : variant.title}</Text>
                    {variant.sku && <Text as="span" variant="bodySm" tone="subdued">{` · SKU: ${variant.sku}`}</Text>}
                  </div>
                  <Text as="span" variant="bodySm" tone="subdued">{`$${parseFloat(variant.price).toFixed(2)}`}</Text>
                </div>
              ))}
            </div>
          ))}
        </BlockStack>
      </Modal.Section>
    </Modal>);
  }

  // ── RENDER: Delete Modal ──
  function renderDeleteModal() {
    if (!deleteTarget) return null;
    return (<Modal open={true} onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
      title={`Delete ${deleteTarget.type}`}
      primaryAction={{ content: 'Delete', onAction: confirmDelete, loading: deleteLoading, destructive: true }}
      secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteTarget(null) }]}>
      <Modal.Section>
        {deleteError && <div style={{ marginBottom: 12 }}><Banner tone="critical">{deleteError}</Banner></div>}
        <Text as="p" variant="bodyMd">
          Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
          {deleteTarget.type === 'group' && ' This will also delete all values in this group.'}
        </Text>
      </Modal.Section>
    </Modal>);
  }

  // ── RENDER: Main ──
  const shopParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('shop') ?? '' : '';
  const backUrl = shopParam ? `/product-families?shop=${shopParam}` : '/product-families';

  return (
    <Page title={family.name} subtitle={family.handle}
      titleMetadata={<InlineStack gap="200">
        <Badge tone={family.status === 'ACTIVE' ? 'success' : family.status === 'ARCHIVED' ? 'warning' : undefined}>{family.status}</Badge>
        {family.shopifyProductId && <Badge>{family.shopifyProductId.replace('gid://shopify/Product/', 'Shopify #')}</Badge>}
      </InlineStack>}
      backAction={{ content: 'Product Families', onAction: () => router.push(backUrl) }}>

      {successMsg && <div style={{ marginBottom: 16 }}><Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner></div>}

      <Layout>
        <Layout.Section>{renderOptionBuilder()}</Layout.Section>
        <Layout.Section variant="oneThird">{renderPreview()}</Layout.Section>
      </Layout>

      {renderGroupModal()}
      {renderValueModal()}
      {renderShopifyPickerModal()}
      {renderDeleteModal()}
    </Page>
  );
}
