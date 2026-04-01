import { useCallback, useEffect, useRef } from 'preact/hooks';
import {
  startSession,
  validateConfiguration,
  prepareCart,
  addToShopifyCart,
} from '../api/client';
import * as state from '../state/configuration';

/**
 * Initialize the configuration session on mount.
 */
export function useConfigSession(shopifyProductId: string) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      state.isLoading.value = true;
      state.initError.value = null;

      try {
        const response = await startSession(shopifyProductId);

        state.sessionId.value = response.sessionId;
        state.productFamilyName.value = response.productFamily.name;
        state.optionGroups.value = response.productFamily.optionGroups;
        state.selections.value = response.defaults;

        // Apply initial evaluation
        applyEvaluation(response.initialEvaluation);
      } catch (error) {
        state.initError.value =
          error instanceof Error ? error.message : 'Failed to load configurator';
      } finally {
        state.isLoading.value = false;
      }
    }

    init();
  }, [shopifyProductId]);
}

/**
 * Debounced rule evaluation — fires when selections change.
 */
export function useRuleEvaluation() {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelections = useRef<string>('');

  const evaluate = useCallback(async () => {
    const sid = state.sessionId.value;
    if (!sid) return;

    const selectionsJson = JSON.stringify(state.selections.value);
    if (selectionsJson === lastSelections.current) return;
    lastSelections.current = selectionsJson;

    state.isValidating.value = true;

    try {
      const result = await validateConfiguration(
        sid,
        state.selections.value
      );
      applyEvaluation(result);
    } catch (error) {
      console.error('[Configurator] Validation error:', error);
    } finally {
      state.isValidating.value = false;
    }
  }, []);

  // Trigger evaluation when selections change
  useEffect(() => {
    if (!state.sessionId.value) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(evaluate, 150);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [state.selections.value, evaluate]);
}

/**
 * Add to cart handler.
 */
export function useCart() {
  const addToCart = useCallback(async () => {
    const sid = state.sessionId.value;
    if (!sid) return;

    state.isAddingToCart.value = true;
    state.cartError.value = null;

    try {
      // Server-side validation + snapshot creation
      const resolution = await prepareCart(sid, state.selections.value);

      if (!resolution.success) {
        state.cartError.value =
          resolution.errors?.[0]?.message ?? 'Invalid configuration';
        return;
      }

      if (!resolution.cartPayload) {
        state.cartError.value = 'Cart payload missing';
        return;
      }

      // Add to Shopify cart via Ajax API
      await addToShopifyCart(resolution.cartPayload);

      state.cartSuccess.value = true;

      // Dispatch custom event for theme integration
      document.dispatchEvent(
        new CustomEvent('zure:cart-add', {
          detail: {
            snapshotId: resolution.snapshotId,
            price: resolution.resolvedPrice,
            summary: resolution.summary,
          },
        })
      );

      // Optionally trigger cart drawer / redirect
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    } catch (error) {
      state.cartError.value =
        error instanceof Error ? error.message : 'Failed to add to cart';
    } finally {
      state.isAddingToCart.value = false;
    }
  }, []);

  return { addToCart };
}

// ──── Helpers ────

function applyEvaluation(result: import('../api/client').EvaluationResult) {
  state.isValid.value = result.isValid;
  state.errors.value = result.errors;
  state.availableOptions.value = result.availableOptions;
  state.pricing.value = result.pricing;
  state.media.value = result.media;
  state.summary.value = result.summary;

  // Dispatch price update for theme integration
  if (result.pricing) {
    document.dispatchEvent(
      new CustomEvent('zure:price-update', {
        detail: {
          price: result.pricing.totalPrice,
          compareAt: result.pricing.compareAtPrice,
          isTradePrice: result.pricing.isTradePrice,
        },
      })
    );
  }

  // Dispatch media update for theme integration
  if (result.media) {
    document.dispatchEvent(
      new CustomEvent('zure:media-update', {
        detail: {
          heroImage: result.media.heroImage,
          gallery: result.media.gallery,
        },
      })
    );
  }
}
