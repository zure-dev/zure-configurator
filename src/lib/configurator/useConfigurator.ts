/**
 * useConfigurator — React hook for the configurator state machine
 *
 * Usage:
 *   const configurator = useConfigurator('product-family-id-here');
 *
 *   configurator.select('vanity-size', '900mm');
 *   configurator.isDisabled('basin-position', 'double');
 *   configurator.state.pricing?.total;         // 1968.00
 *   configurator.state.pricing?.lineItems;     // [{ description: "+$400.00 (900mm)", ... }]
 *   configurator.state.firedRules;             // [{ type: 'dependency', ... }]
 *
 * Flow:
 *   1. Init: load option groups → set defaults
 *   2. On selection change (debounced 200ms):
 *      a. Call POST /api/rules/evaluate → update allowed/disabled
 *      b. Reconcile: auto-clear invalid selections
 *      c. Call POST /api/pricing/calculate → update pricing breakdown
 *   3. If reconciliation changed selections, re-evaluate (loop back to 2a)
 */

'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import {
  configuratorReducer,
  initialState,
  reconcileSelections,
  isValueDisabled as _isValueDisabled,
  getDisabledReason as _getDisabledReason,
  getAllowedValues as _getAllowedValues,
} from './state';
import type { ConfiguratorState, EvaluateResponse, PricingResponse, OptionGroup } from './types';

// ──────────────────────────────────────────────
// API fetch helper
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

const DEBOUNCE_MS = 200;

export interface UseConfiguratorReturn {
  /** Full state object */
  state: ConfiguratorState;
  /** Select a value for a group — triggers evaluation + pricing */
  select: (groupSlug: string, valueSlug: string) => void;
  /** Clear a selection — triggers evaluation + pricing */
  clearSelection: (groupSlug: string) => void;
  /** Check if a value is disabled */
  isDisabled: (groupSlug: string, valueSlug: string) => boolean;
  /** Get the reason a value is disabled, or null */
  getDisabledReason: (groupSlug: string, valueSlug: string) => string | null;
  /** Get all allowed value slugs for a group */
  getAllowedValues: (groupSlug: string) => string[];
  /** Reset to initial state and re-initialize */
  reset: () => void;
}

export function useConfigurator(productFamilyId: string): UseConfiguratorReturn {
  const [state, dispatch] = useReducer(configuratorReducer, initialState);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvalPayload = useRef<string>('');
  const lastPricePayload = useRef<string>('');
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Initialize: load option groups ──

  useEffect(() => {
    if (!productFamilyId) return;

    let cancelled = false;

    async function init() {
      dispatch({ type: 'INIT_START' });

      try {
        const res = await apiFetch(`/api/options?familyId=${productFamilyId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        const groups: OptionGroup[] = data.optionGroups ?? [];

        if (!cancelled) {
          dispatch({ type: 'INIT_SUCCESS', productFamilyId, optionGroups: groups });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: 'INIT_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load configurator',
          });
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [productFamilyId]);

  // ── Calculate pricing ──

  const fetchPricing = useCallback(async () => {
    const s = stateRef.current;
    if (!s.productFamilyId) return;

    // Skip if selections haven't changed since last pricing call
    const payload = JSON.stringify(s.selections);
    if (payload === lastPricePayload.current) return;
    lastPricePayload.current = payload;

    dispatch({ type: 'PRICING_START' });

    try {
      const res = await apiFetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: s.productFamilyId,
          selections: s.selections,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const pricing: PricingResponse = await res.json();
      dispatch({ type: 'PRICING_SUCCESS', pricing });
    } catch (err) {
      dispatch({
        type: 'PRICING_ERROR',
        error: err instanceof Error ? err.message : 'Pricing failed',
      });
    }
  }, []);

  // ── Evaluate rules + pricing whenever selections change ──

  const evaluate = useCallback(async () => {
    const s = stateRef.current;
    if (!s.productFamilyId || s.optionGroups.length === 0) return;

    // Skip if selections haven't changed since last evaluation
    const payload = JSON.stringify(s.selections);
    if (payload === lastEvalPayload.current) return;
    lastEvalPayload.current = payload;

    dispatch({ type: 'EVALUATE_START' });

    try {
      const res = await apiFetch('/api/rules/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productFamilyId: s.productFamilyId,
          selections: s.selections,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const result: EvaluateResponse = await res.json();

      // Reconcile: if any current selection is now invalid, auto-clear it
      const { cleanedSelections, clearedGroups } = reconcileSelections(
        s.selections,
        result.allowed,
        s.optionGroups
      );

      dispatch({
        type: 'EVALUATE_SUCCESS',
        result,
        autoClearedGroups: clearedGroups,
      });

      if (clearedGroups.length > 0) {
        // Apply cleaned selections — this will re-trigger the debounced evaluate
        for (const groupSlug of Object.keys(cleanedSelections)) {
          if (cleanedSelections[groupSlug] !== s.selections[groupSlug]) {
            dispatch({
              type: 'SELECT',
              groupSlug,
              valueSlug: cleanedSelections[groupSlug]!,
            });
          }
        }
        for (const groupSlug of Object.keys(s.selections)) {
          if (!(groupSlug in cleanedSelections)) {
            dispatch({ type: 'CLEAR_SELECTION', groupSlug });
          }
        }
        // Don't fetch pricing yet — the re-evaluate cycle will do it
      } else {
        // Selections are stable — fetch pricing now
        await fetchPricing();
      }
    } catch (err) {
      dispatch({
        type: 'EVALUATE_ERROR',
        error: err instanceof Error ? err.message : 'Evaluation failed',
      });
    }
  }, [fetchPricing]);

  // Debounced trigger
  useEffect(() => {
    if (state.isLoading || state.optionGroups.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(evaluate, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state.selections, state.isLoading, state.optionGroups.length, evaluate]);

  // ── Public API ──

  const select = useCallback((groupSlug: string, valueSlug: string) => {
    dispatch({ type: 'SELECT', groupSlug, valueSlug });
  }, []);

  const clearSelection = useCallback((groupSlug: string) => {
    dispatch({ type: 'CLEAR_SELECTION', groupSlug });
  }, []);

  const isDisabled = useCallback(
    (groupSlug: string, valueSlug: string) =>
      _isValueDisabled(stateRef.current, groupSlug, valueSlug),
    []
  );

  const getDisabledReasonFn = useCallback(
    (groupSlug: string, valueSlug: string) =>
      _getDisabledReason(stateRef.current, groupSlug, valueSlug),
    []
  );

  const getAllowedValuesFn = useCallback(
    (groupSlug: string) => _getAllowedValues(stateRef.current, groupSlug),
    []
  );

  const reset = useCallback(() => {
    lastEvalPayload.current = '';
    lastPricePayload.current = '';
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    select,
    clearSelection,
    isDisabled,
    getDisabledReason: getDisabledReasonFn,
    getAllowedValues: getAllowedValuesFn,
    reset,
  };
}
