'use client';

import { useState, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
} from '@shopify/polaris';
import { useRouter } from 'next/navigation';

export default function NewProductFamilyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    basePrice: '0',
  });

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/product-families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          basePrice: parseFloat(form.basePrice) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to create product family');
        return;
      }

      router.push(`/admin/product-families/${data.family.id}`);
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, [form, router]);

  return (
    <Page
      title="Create Product Family"
      backAction={{ content: 'Product Families', url: '/admin/product-families' }}
    >
      <Layout>
        <Layout.Section>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <Banner tone="critical">{error}</Banner>
            </div>
          )}

          <Card>
            <FormLayout>
              <TextField
                label="Name"
                value={form.name}
                onChange={(v) => setForm((s) => ({ ...s, name: v, slug: s.slug || generateSlug(v) }))}
                placeholder="e.g. Zure Vanity"
                autoComplete="off"
              />
              <TextField
                label="Slug"
                value={form.slug}
                onChange={(v) => setForm((s) => ({ ...s, slug: v }))}
                helpText="URL-friendly identifier"
                autoComplete="off"
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(v) => setForm((s) => ({ ...s, description: v }))}
                multiline={3}
                autoComplete="off"
              />
              <TextField
                label="Base Price (AUD)"
                value={form.basePrice}
                onChange={(v) => setForm((s) => ({ ...s, basePrice: v }))}
                type="number"
                prefix="$"
                autoComplete="off"
              />
              <Button variant="primary" onClick={handleSave} loading={saving}>
                Create Product Family
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
