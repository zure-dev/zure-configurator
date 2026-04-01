'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfigurator } from '@/lib/configurator';
import {
  StepSection,
  StickySummary,
  MobileBottomBar,
  HoverPreview,
  MobilePreviewSheet,
} from '@/components/configurator';
import type { PreviewData } from '@/components/configurator';
import type { OptionGroup } from '@/lib/configurator/types';
import './globals.css';

// ──────────────────────────────────────────────
// API FETCH HELPER
// ──────────────────────────────────────────────

function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let shopDomain = '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    shopDomain = params.get('shop') ?? '';
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = shopDomain ? `${path}${sep}shop=${shopDomain}` : path;
  return fetch(url, options);
}

// ──────────────────────────────────────────────
// PAGE ENTRY — dev ID input OR direct load
// ──────────────────────────────────────────────

export default function ProductDetailPage() {
  const [familyId, setFamilyId] = useState('');
  const [activeFamilyId, setActiveFamilyId] = useState('');

  return (
    <div className="font-body bg-stone-50 min-h-screen text-stone-900">
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap"
        rel="stylesheet"
      />

      {!activeFamilyId ? (
        <div className="max-w-md mx-auto px-6 pt-24 text-center">
          <h1 className="font-display text-4xl font-medium tracking-tight mb-2">Zure Product Page</h1>
          <p className="text-stone-400 text-sm mb-8">Enter a product family ID to preview the PDP</p>
          <input
            type="text"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            placeholder="Product Family ID"
            className="w-full px-4 py-3.5 text-[15px] border border-stone-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-shadow"
          />
          <button
            onClick={() => setActiveFamilyId(familyId)}
            disabled={!familyId.trim()}
            className="w-full mt-4 py-3.5 text-[15px] font-medium bg-stone-900 text-white rounded-lg disabled:bg-stone-300 disabled:cursor-default hover:bg-stone-800 transition-colors"
          >
            Load Product Page
          </button>
        </div>
      ) : (
        <PDPShell key={activeFamilyId} productFamilyId={activeFamilyId} onBack={() => setActiveFamilyId('')} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// PDP SHELL
// ──────────────────────────────────────────────

function PDPShell({ productFamilyId, onBack }: { productFamilyId: string; onBack: () => void }) {
  const configurator = useConfigurator(productFamilyId);
  const { state, select, isDisabled, getDisabledReason } = configurator;
  const isMobile = useIsMobile();

  // Steps
  const steps = useMemo(() => {
    const required = state.optionGroups.filter((g) => g.isRequired);
    const optional = state.optionGroups.filter((g) => !g.isRequired);
    const stepMap = new Map<number, OptionGroup[]>();
    for (const g of required) {
      const step = g.stepNumber ?? g.sortOrder;
      if (!stepMap.has(step)) stepMap.set(step, []);
      stepMap.get(step)!.push(g);
    }
    const sorted = [...stepMap.entries()].sort(([a], [b]) => a - b).map(([, groups]) => groups);
    return { required: sorted, optional };
  }, [state.optionGroups]);

  const [activeStep, setActiveStep] = useState(0);
  const totalSteps = steps.required.length;
  const isAddOnStep = activeStep >= totalSteps;
  const currentGroups = isAddOnStep ? steps.optional : (steps.required[activeStep] ?? []);

  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewRect, setPreviewRect] = useState<DOMRect | null>(null);
  const [mobilePreview, setMobilePreview] = useState<PreviewData | null>(null);

  const handlePreviewEnter = useCallback((data: PreviewData, rect: DOMRect) => {
    setPreview(data);
    setPreviewRect(rect);
  }, []);
  const handlePreviewLeave = useCallback(() => { setPreview(null); setPreviewRect(null); }, []);
  const handleMobileTap = useCallback((data: PreviewData) => { setMobilePreview(data); }, []);

  const stepComplete = currentGroups.every((g) => state.selections[g.slug]);
  const allRequiredSelected = useMemo(() =>
    state.optionGroups.filter((g) => g.isRequired).every((g) => state.selections[g.slug]),
    [state.optionGroups, state.selections]
  );

  // ── Cart / Draft Order state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartSuccess, setCartSuccess] = useState<{
    draftOrderName: string | null;
    invoiceUrl: string | null;
    adminUrl: string | null;
  } | null>(null);

  const handleAddToCart = useCallback(async () => {
    if (!allRequiredSelected || isSubmitting) return;
    setIsSubmitting(true);
    setCartError(null);
    setCartSuccess(null);

    try {
      const res = await apiFetch('/api/draft-order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: state.productFamilyId,
          selections: state.selections,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.errors?.join('. ') ?? data.error ?? 'Something went wrong';
        setCartError(msg);
        return;
      }

      setCartSuccess({
        draftOrderName: data.draftOrderName,
        invoiceUrl: data.invoiceUrl,
        adminUrl: data.adminUrl,
      });
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  }, [allRequiredSelected, isSubmitting, state.productFamilyId, state.selections]);

  // ── Loading ──
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin-slow" />
          <span className="text-sm text-stone-400">Loading product…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state.error && state.optionGroups.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 pt-24 text-center">
        <p className="text-danger mb-4">{state.error}</p>
        <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-600">← Go back</button>
      </div>
    );
  }

  // ── Success overlay ──
  if (cartSuccess) {
    return <SuccessScreen result={cartSuccess} onContinue={() => setCartSuccess(null)} onBack={onBack} />;
  }

  return (
    <>
      {/* ── TOP NAV BAR ── */}
      <nav className="border-b border-stone-200 bg-white">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-3">
          <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
            ← Back to products
          </button>
          <span className="font-display text-lg font-medium tracking-tight">Zure</span>
          <div className="w-20" />
        </div>
      </nav>

      {/* ── HERO: IMAGE GALLERY + PRODUCT INFO ── */}
      <section className="max-w-[1400px] mx-auto">
        <div className={`${isMobile ? 'flex flex-col' : 'grid grid-cols-2'} gap-0`}>
          {/* Image gallery */}
          <ImageGallery isMobile={isMobile} />

          {/* Product info header */}
          <div className={`${isMobile ? 'px-4 pt-5 pb-6' : 'px-10 pt-10 pb-8'} flex flex-col justify-center`}>
            <div className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.15em] mb-2">
              Zure Collection
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight mb-3">
              Zure Bathroom Vanity
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed mb-4 max-w-lg">
              Premium wall-hung vanity with engineered stone top. Available in multiple sizes, 
              finishes, and basin configurations. Australian designed, built to order.
            </p>

            {/* Reviews placeholder */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill={i <= 4 ? '#1A1A1A' : 'none'} stroke="#1A1A1A" strokeWidth="1">
                    <path d="M7 1.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.7l-3.2 1.7.6-3.6L1.8 5.3l3.6-.5z"/>
                  </svg>
                ))}
              </div>
              <span className="text-xs text-stone-400">4.8 (127 reviews)</span>
            </div>

            {/* Stock / shipping badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                In stock — made to order
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-xs font-medium">
                Ships in 10–15 business days
              </span>
            </div>

            {/* Starting price */}
            {state.pricing && (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tracking-tight">
                  ${state.pricing.total.toFixed(2)}
                </span>
                <span className="text-xs text-stone-400 uppercase tracking-wider">{state.pricing.currency}</span>
                {state.pricing.subtotal > 0 && (
                  <span className="text-xs text-stone-400 ml-1">
                    (base ${state.pricing.basePrice.toFixed(2)} + options)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── CONFIGURATOR SECTION ── */}
      <section id="configure" className="border-t border-stone-200 bg-white">
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} max-w-[1400px] mx-auto`}>

          {/* Main configurator */}
          <main className={`flex-1 ${isMobile ? 'px-4 pt-6 pb-36' : 'px-12 pt-10 pb-16'} max-w-[900px]`}>

            {/* Section title */}
            <div className="mb-6">
              <h2 className="font-display text-2xl md:text-3xl font-medium tracking-tight mb-1">
                Configure Your Vanity
              </h2>
              <p className="text-sm text-stone-400">
                Step {Math.min(activeStep + 1, totalSteps)} of {totalSteps}
                {steps.optional.length > 0 && ' + add-ons'}
              </p>
            </div>

            {/* Step pills */}
            <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
              {steps.required.map((groups, idx) => {
                const label = groups.map((g) => g.name).join(' & ');
                const isActive = idx === activeStep;
                const isComplete = groups.every((g) => state.selections[g.slug]);
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`shrink-0 px-4 py-2 text-[13px] rounded-full transition-all duration-200
                      ${isActive
                        ? 'bg-stone-900 text-white font-semibold shadow-md'
                        : isComplete
                          ? 'bg-stone-150 text-stone-700 font-medium hover:bg-stone-200'
                          : 'bg-stone-100 text-stone-400 hover:text-stone-500'
                      }`}
                  >
                    {isComplete && !isActive ? '✓ ' : ''}{label}
                  </button>
                );
              })}
              {steps.optional.length > 0 && (
                <button
                  onClick={() => setActiveStep(totalSteps)}
                  className={`shrink-0 px-4 py-2 text-[13px] rounded-full border border-dashed transition-all duration-200
                    ${isAddOnStep
                      ? 'bg-stone-900 text-white font-semibold border-stone-900 shadow-md'
                      : 'bg-stone-50 text-stone-400 border-stone-300 hover:text-stone-500'
                    }`}
                >
                  Add-ons
                </button>
              )}
            </div>

            {/* Cart error banner */}
            {cartError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg mb-6 text-sm text-danger flex items-start gap-2">
                <span className="shrink-0 mt-0.5">✕</span>
                <div>
                  <div className="font-medium mb-0.5">Could not create order</div>
                  <div className="text-xs text-red-600">{cartError}</div>
                </div>
                <button onClick={() => setCartError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs shrink-0">
                  Dismiss
                </button>
              </div>
            )}

            {/* Auto-clear notice */}
            {state.autoClearedGroups.length > 0 && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-[13px] text-amber-800">
                Some selections were adjusted for compatibility: {state.autoClearedGroups.join(', ')}
              </div>
            )}

            {/* Step content */}
            {isAddOnStep ? (
              <div>
                <div className="mb-6">
                  <h3 className="font-display text-xl font-medium tracking-tight mb-1">Optional Add-ons</h3>
                  <p className="text-sm text-stone-400">Enhance your vanity with premium accessories</p>
                </div>
                <StepSection
                  groups={steps.optional} selections={state.selections} disabled={state.disabled}
                  pricingLineItems={state.pricing?.lineItems ?? []}
                  isDisabledFn={isDisabled} getReasonFn={getDisabledReason}
                  onSelect={select} onPreviewEnter={handlePreviewEnter}
                  onPreviewLeave={handlePreviewLeave} onMobileTap={handleMobileTap}
                  isMobile={isMobile} isOptional
                />
              </div>
            ) : (
              <div>
                <StepSection
                  groups={currentGroups} selections={state.selections} disabled={state.disabled}
                  pricingLineItems={state.pricing?.lineItems ?? []}
                  isDisabledFn={isDisabled} getReasonFn={getDisabledReason}
                  onSelect={select} onPreviewEnter={handlePreviewEnter}
                  onPreviewLeave={handlePreviewLeave} onMobileTap={handleMobileTap}
                  isMobile={isMobile}
                />
                <div className="flex gap-3 mt-10">
                  {activeStep > 0 && (
                    <button
                      onClick={() => setActiveStep((s) => s - 1)}
                      className="px-6 py-3 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-200 rounded-lg hover:bg-stone-150 transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  <button
                    onClick={() => setActiveStep((s) => s + 1)}
                    disabled={!stepComplete}
                    className={`px-8 py-3 text-sm font-medium rounded-lg transition-all
                      ${stepComplete
                        ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm'
                        : 'bg-stone-200 text-stone-400 cursor-default'
                      }`}
                  >
                    {activeStep === totalSteps - 1 && steps.optional.length === 0
                      ? 'Review'
                      : activeStep === totalSteps - 1
                        ? 'Continue to Add-ons'
                        : 'Next Step'}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Desktop sidebar */}
          {!isMobile && (
            <StickySummary
              state={state} steps={steps} onStepClick={setActiveStep}
              onAddToCart={handleAddToCart} isSubmitting={isSubmitting}
              allRequiredSelected={allRequiredSelected}
            />
          )}

          {/* Mobile bottom bar */}
          {isMobile && state.pricing && (
            <MobileBottomBar
              pricing={state.pricing} onAddToCart={handleAddToCart}
              isSubmitting={isSubmitting} allRequiredSelected={allRequiredSelected}
            />
          )}

          {/* Hover preview */}
          {preview && previewRect && !isMobile && (
            <HoverPreview data={preview} anchorRect={previewRect} />
          )}

          {/* Mobile preview sheet */}
          {mobilePreview && isMobile && (
            <MobilePreviewSheet
              data={mobilePreview}
              onSelect={() => {
                if (!mobilePreview.isDisabled) select(mobilePreview.groupSlug, mobilePreview.valueSlug);
                setMobilePreview(null);
              }}
              onClose={() => setMobilePreview(null)}
            />
          )}
        </div>
      </section>

      {/* ── BELOW-THE-FOLD CONTENT ── */}
      <BelowFoldContent isMobile={isMobile} />
    </>
  );
}

// ──────────────────────────────────────────────
// IMAGE GALLERY (placeholder)
// ──────────────────────────────────────────────

function ImageGallery({ isMobile }: { isMobile: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const images = [
    { bg: 'linear-gradient(135deg, #E8E5E0 0%, #D0CDC6 100%)', label: 'Front View' },
    { bg: 'linear-gradient(135deg, #D0CDC6 0%, #A8A49D 100%)', label: 'Side View' },
    { bg: 'linear-gradient(135deg, #F0EDE8 0%, #E8E5E0 100%)', label: 'Detail' },
    { bg: 'linear-gradient(135deg, #E8E5E0 0%, #F5F4F1 100%)', label: 'Basin Close-up' },
  ];

  return (
    <div className={`${isMobile ? '' : 'sticky top-0'} bg-stone-100`}>
      {/* Main image */}
      <div
        className={`relative ${isMobile ? 'aspect-[4/3]' : 'aspect-square'} flex items-center justify-center`}
        style={{ background: images[activeIdx]!.bg }}
      >
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#A8A49D" strokeWidth="1.5">
              <rect x="8" y="14" width="32" height="24" rx="2" />
              <circle cx="20" cy="26" r="4" />
              <path d="M36 38L28 28L20 34L14 30L8 38" />
            </svg>
          </div>
          <span className="text-sm text-stone-400">{images[activeIdx]!.label}</span>
          <p className="text-[10px] text-stone-300 mt-1">Product images update with your selections</p>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 p-3">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIdx(idx)}
            className={`flex-1 aspect-square rounded-lg transition-all ${idx === activeIdx ? 'ring-2 ring-stone-900 ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
            style={{ background: img.bg }}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SUCCESS SCREEN
// ──────────────────────────────────────────────

function SuccessScreen({ result, onContinue, onBack }: {
  result: { draftOrderName: string | null; invoiceUrl: string | null; adminUrl: string | null };
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-6 pt-20 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14L12 20L22 8" />
        </svg>
      </div>
      <h2 className="font-display text-3xl font-medium tracking-tight mb-2">Order Created</h2>
      {result.draftOrderName && (
        <p className="text-stone-500 mb-6">Draft order {result.draftOrderName} has been created</p>
      )}
      <div className="flex flex-col gap-3">
        {result.invoiceUrl && (
          <a
            href={result.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors block text-center"
          >
            Proceed to Checkout
          </a>
        )}
        {result.adminUrl && (
          <a
            href={result.adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded-lg hover:bg-stone-150 transition-colors block text-center"
          >
            View in Shopify Admin
          </a>
        )}
        <button
          onClick={onContinue}
          className="text-sm text-stone-400 hover:text-stone-600 mt-2 transition-colors"
        >
          Modify configuration
        </button>
        <button
          onClick={onBack}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Start new configuration
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// BELOW-THE-FOLD CONTENT
// ──────────────────────────────────────────────

function BelowFoldContent({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="border-t border-stone-200 bg-stone-50">
      <div className={`max-w-[1400px] mx-auto ${isMobile ? 'px-4 py-10' : 'px-12 py-16'}`}>

        {/* Description + Specs grid */}
        <div className={`${isMobile ? 'flex flex-col gap-10' : 'grid grid-cols-2 gap-16'} mb-16`}>
          <div>
            <h3 className="font-display text-2xl font-medium tracking-tight mb-4">About This Product</h3>
            <div className="text-sm text-stone-600 leading-relaxed space-y-3">
              <p>
                The Zure Bathroom Vanity is a premium wall-hung unit designed for contemporary Australian bathrooms.
                Each vanity is built to order, allowing you to choose your preferred size, finish, stone top, and basin configuration.
              </p>
              <p>
                Constructed from moisture-resistant MDF with premium lacquer or laminate finishes, the Zure vanity
                is engineered for long-term durability in wet environments. Soft-close drawers come standard on all units.
              </p>
              <p>
                Every configuration is verified for compatibility — our system automatically ensures your chosen basin,
                stone top, and tap holes work together perfectly.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-2xl font-medium tracking-tight mb-4">Specifications</h3>
            <div className="divide-y divide-stone-200">
              {[
                ['Material', 'Moisture-resistant MDF'],
                ['Finish', 'Premium lacquer / laminate'],
                ['Mounting', 'Wall-hung with concealed bracket'],
                ['Drawers', '2 full-extension soft-close'],
                ['Stone Top', '20mm engineered stone'],
                ['Basin Options', 'Undermount, above counter, or no basin'],
                ['Tap Hole Options', 'No hole, 1 hole, or 3 holes'],
                ['Warranty', '10 years structural, 5 years finish'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-3 text-sm">
                  <span className="text-stone-400">{label}</span>
                  <span className="text-stone-700 font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-2xl">
          <h3 className="font-display text-2xl font-medium tracking-tight mb-6">Frequently Asked Questions</h3>
          <div className="divide-y divide-stone-200">
            {[
              {
                q: 'How long does delivery take?',
                a: 'Vanities are built to order and typically ship within 10–15 business days. Delivery to metro areas is usually 3–5 days after dispatch.',
              },
              {
                q: 'Can I change my configuration after ordering?',
                a: 'Changes can be made within 24 hours of placing your order by contacting our team. After production begins, modifications are not possible.',
              },
              {
                q: 'Why are some options greyed out?',
                a: 'Some options are incompatible with your current selections. For example, a double basin position is not available on the 600mm size. The configurator automatically manages compatibility for you.',
              },
              {
                q: 'Is installation included?',
                a: 'Installation is not included but we can recommend qualified installers in your area. All vanities come with detailed installation instructions and mounting hardware.',
              },
              {
                q: 'What is the return policy?',
                a: 'As each vanity is built to order, we cannot accept returns unless the product is faulty or damaged in transit. Please use the configurator carefully to ensure your selections are correct.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-stone-900 list-none">
                  {q}
                  <svg className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </summary>
                <p className="text-sm text-stone-500 leading-relaxed mt-3 pr-8">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Trust bar */}
        <div className={`mt-16 pt-10 border-t border-stone-200 ${isMobile ? 'grid grid-cols-2 gap-6' : 'flex justify-between'}`}>
          {[
            { icon: '🚚', label: 'Free Shipping', sub: 'On orders over $499' },
            { icon: '🛡️', label: '10 Year Warranty', sub: 'Structural guarantee' },
            { icon: '🇦🇺', label: 'Australian Made', sub: 'Designed & built locally' },
            { icon: '✓', label: 'Compatibility Verified', sub: 'Every configuration checked' },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <div>
                <div className="text-sm font-medium text-stone-700">{label}</div>
                <div className="text-xs text-stone-400">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// HOOKS
// ──────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}
