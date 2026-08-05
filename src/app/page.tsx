'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Page, Layout, Card, Text, BlockStack, InlineStack,
  Spinner, Banner, Button, Badge, Divider,
} from '@shopify/polaris';
import { useRouter } from 'next/navigation';
import { apiFetch, getShopDomain } from '@/lib/api-client';

interface DashboardStats {
  totalFamilies: number;
  activeFamilies: number;
  draftFamilies: number;
  linkedFamilies: number;
  totalGroups: number;
  totalValues: number;
  totalMappings: number;
  totalProfiles: number;
}

interface RecentFamily {
  id: string;
  name: string;
  handle: string;
  status: string;
  _count: { optionGroups: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFamilies, setRecentFamilies] = useState<RecentFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/dashboard/stats');
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Failed to load'); }
      const data = await res.json();
      setStats(data.stats);
      setRecentFamilies(data.recentFamilies ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const shop = getShopDomain();
  const nav = (path: string) => {
    const url = shop ? `${path}?shop=${encodeURIComponent(shop)}` : path;
    router.push(url);
  };

  if (loading) {
    return (
      <Page title="Zure Configurator">
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

  return (
    <Page title="Zure Configurator">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical">{error}</Banner>
          </Layout.Section>
        )}

        {/* ── Stats Cards ── */}
        <Layout.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <StatCard label="Product Families" value={stats?.totalFamilies ?? 0} />
            <StatCard label="Active" value={stats?.activeFamilies ?? 0} tone="success" />
            <StatCard label="Draft" value={stats?.draftFamilies ?? 0} tone="warning" />
            <StatCard label="Linked to Shopify" value={stats?.linkedFamilies ?? 0} tone="info" />
            <StatCard label="Option Groups" value={stats?.totalGroups ?? 0} />
            <StatCard label="Option Values" value={stats?.totalValues ?? 0} />
            <StatCard label="Product Mappings" value={stats?.totalMappings ?? 0} />
            <StatCard label="Variant Profiles" value={stats?.totalProfiles ?? 0} />
          </div>
        </Layout.Section>

        {/* ── Quick Actions ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">Quick Actions</Text>
              <InlineStack gap="200" wrap>
                <Button onClick={() => nav('/product-families')} variant="primary">Manage Product Families</Button>
                <Button onClick={() => nav('/rules')} variant="secondary">Rules Engine</Button>
                <Button onClick={() => nav('/orders')} variant="secondary">Orders</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Recent Active Families ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingSm">Recently Updated Families</Text>
                <Button size="slim" variant="plain" onClick={() => nav('/product-families')}>View all</Button>
              </InlineStack>
              {recentFamilies.length === 0 && (
                <Text as="p" variant="bodySm" tone="subdued">No active product families yet. Create your first one to get started.</Text>
              )}
              {recentFamilies.map((family) => (
                <div key={family.id}
                  onClick={() => nav(`/product-families/${family.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e1e3e5', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f6f6f7'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                >
                  <div>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{family.name}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{family.handle}</Text>
                  </div>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={family.status === 'ACTIVE' ? 'success' : 'attention'}>{family.status}</Badge>
                    <Text as="span" variant="bodySm" tone="subdued">{`${family._count.optionGroups} groups`}</Text>
                  </InlineStack>
                </div>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Getting Started Guide ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">Getting Started</Text>
              <Divider />
              <GuideStep number={1} title="Create a Product Family" description="A product family groups all the configuration options for a product line. E.g. 'Boston Wall Hung Vanity' includes all sizes, finishes, and add-ons." />
              <GuideStep number={2} title="Link to Shopify" description="Connect your product family to a Shopify product. This enables the configurator to appear on that product's page." />
              <GuideStep number={3} title="Add Option Groups" description="Create groups like 'Stone Top', 'Basin', 'Handles'. Each group contains the values customers choose from." />
              <GuideStep number={4} title="Add Option Values" description="Add individual options like 'Carrara Marble', 'Matte White'. Link each to a Shopify product/variant for pricing and inventory." />
              <GuideStep number={5} title="Import Variant Profiles (Optional)" description="If your product has size variants (900mm, 1200mm), import them from Shopify. Assign option groups to specific sizes." />
              <GuideStep number={6} title="Add Product Mappings" description="For bundle products, add multiple Shopify products to a single option value. Each becomes a separate line item in the cart." />
              <GuideStep number={7} title="Set to Active" description="Change your product family status from Draft to Active. The configurator will appear on the storefront immediately." />
              <GuideStep number={8} title="Test on Storefront" description="Open the product page in the theme editor or live store. Select options, verify pricing, and test Add to Cart." />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const colors: Record<string, string> = { success: '#34d399', warning: '#fbbf24', info: '#60a5fa' };
  const accentColor = tone ? colors[tone] ?? '#e5e7eb' : '#e5e7eb';
  return (
    <div style={{ padding: '20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', borderTop: `3px solid ${accentColor}` }}>
      <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
      <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#111' }}>{value}</div>
    </div>
  );
}

function GuideStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '8px 0' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
        {number}
      </div>
      <div>
        <Text as="span" variant="bodyMd" fontWeight="semibold">{title}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
      </div>
    </div>
  );
}
