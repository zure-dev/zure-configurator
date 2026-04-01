'use client';

import type { ConfiguratorState, OptionGroup, PriceLineItem } from '@/lib/configurator/types';

interface StickySummaryProps {
  state: ConfiguratorState;
  steps: { required: OptionGroup[][]; optional: OptionGroup[] };
  onStepClick: (step: number) => void;
  onAddToCart: () => void;
  isSubmitting: boolean;
  allRequiredSelected: boolean;
}

export function StickySummary({ state, steps, onStepClick, onAddToCart, isSubmitting, allRequiredSelected }: StickySummaryProps) {
  const pricing = state.pricing;

  return (
    <aside className="w-[360px] border-l border-stone-200 bg-white sticky top-0 h-screen overflow-y-auto flex flex-col">
      <div className="flex-1 px-6 pt-8 pb-4">
        <h2 className="font-display text-xl font-medium text-stone-900 mb-5 tracking-tight">
          Your Configuration
        </h2>

        <div className="divide-y divide-stone-100">
          {state.optionGroups.map((group) => {
            const selectedSlug = state.selections[group.slug];
            const selectedValue = group.values.find((v) => v.slug === selectedSlug);
            const stepIdx = steps.required.findIndex((gs) => gs.some((g) => g.id === group.id));
            const isOptionalGroup = stepIdx === -1;
            const targetStep = isOptionalGroup ? steps.required.length : stepIdx;

            const priceLine = pricing?.lineItems?.find(
              (li: PriceLineItem) => li.optionGroupSlug === group.slug && li.optionValueSlug === selectedSlug
            );

            return (
              <button
                key={group.id}
                onClick={() => onStepClick(targetStep)}
                className="w-full flex justify-between items-center py-3.5 text-left hover:bg-stone-50/50 transition-colors -mx-2 px-2 rounded-lg"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-0.5">
                    {group.name}
                    {isOptionalGroup && <span className="ml-1.5 text-stone-300">· optional</span>}
                  </div>
                  <div className={`text-sm truncate ${selectedValue ? 'font-medium text-stone-900' : 'text-stone-300'}`}>
                    {selectedValue?.name ?? 'Not selected'}
                  </div>
                </div>
                <div className="shrink-0 ml-3">
                  {priceLine && priceLine.amount !== 0 ? (
                    <span className="text-[13px] font-medium text-success whitespace-nowrap">
                      {priceLine.amount >= 0 ? '+' : ''}${Math.abs(priceLine.amount).toFixed(2)}
                    </span>
                  ) : selectedValue ? (
                    <span className="text-[11px] text-stone-300 uppercase tracking-wider">Included</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {pricing && (
        <div className="px-6 py-5 border-t border-stone-200 bg-stone-50">
          <div className="flex justify-between mb-1">
            <span className="text-[13px] text-stone-400">Base price</span>
            <span className="text-[13px] text-stone-600">${pricing.basePrice.toFixed(2)}</span>
          </div>
          {pricing.subtotal !== 0 && (
            <div className="flex justify-between mb-3">
              <span className="text-[13px] text-stone-400">Options &amp; upgrades</span>
              <span className="text-[13px] font-medium text-success">
                {pricing.subtotal >= 0 ? '+' : ''}${pricing.subtotal.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-3 border-t border-stone-200">
            <span className="text-sm font-medium text-stone-700">Total</span>
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-stone-900 tracking-tight">
                ${pricing.total.toFixed(2)}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">{pricing.currency}</div>
            </div>
          </div>

          <button
            onClick={onAddToCart}
            disabled={isSubmitting || !allRequiredSelected}
            className={`
              w-full mt-5 py-3.5 text-sm font-medium rounded-lg transition-all
              ${isSubmitting
                ? 'bg-stone-600 text-white cursor-wait'
                : allRequiredSelected
                  ? 'bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950'
                  : 'bg-stone-300 text-stone-500 cursor-default'
              }
            `}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating order…
              </span>
            ) : allRequiredSelected ? (
              'Add to Cart'
            ) : (
              'Complete all selections'
            )}
          </button>

          <p className="text-[10px] text-stone-400 text-center mt-3 leading-relaxed">
            Free shipping on orders over $499
          </p>
        </div>
      )}
    </aside>
  );
}
