'use client';

import type { PricingResponse } from '@/lib/configurator/types';

interface MobileBottomBarProps {
  pricing: PricingResponse;
  onAddToCart: () => void;
  isSubmitting: boolean;
  allRequiredSelected: boolean;
}

export function MobileBottomBar({ pricing, onAddToCart, isSubmitting, allRequiredSelected }: MobileBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9000] bg-white border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div>
          <div className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Total</div>
          <div className="font-display text-2xl font-semibold text-stone-900 tracking-tight leading-none mt-0.5">
            ${pricing.total.toFixed(2)}
          </div>
        </div>
        <button
          onClick={onAddToCart}
          disabled={isSubmitting || !allRequiredSelected}
          className={`
            px-8 py-3 text-sm font-medium rounded-lg transition-all
            ${isSubmitting
              ? 'bg-stone-600 text-white cursor-wait'
              : allRequiredSelected
                ? 'bg-stone-900 text-white active:bg-stone-800'
                : 'bg-stone-300 text-stone-500 cursor-default'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting…
            </span>
          ) : allRequiredSelected ? 'Add to Cart' : 'Complete selections'}
        </button>
      </div>
    </div>
  );
}
