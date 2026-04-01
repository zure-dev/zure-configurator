import { h } from 'preact';
import * as state from '../state/configuration';
import { useCart } from '../hooks/useConfigSession';

export function AddToCartButton() {
  const { addToCart } = useCart();
  const isAdding = state.isAddingToCart.value;
  const valid = state.isValid.value;
  const success = state.cartSuccess.value;
  const error = state.cartError.value;
  const price = state.formattedPrice.value;

  if (success) {
    return (
      <div class="zc-cart">
        <div class="zc-cart__success">
          <svg class="zc-cart__success-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>Added to cart!</span>
        </div>
        <button
          type="button"
          class="zc-btn zc-btn--secondary"
          onClick={() => state.resetCart()}
        >
          Configure another
        </button>
      </div>
    );
  }

  return (
    <div class="zc-cart">
      {error && (
        <div class="zc-cart__error" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        class={`zc-btn zc-btn--primary zc-btn--large zc-cart__button ${
          !valid ? 'zc-btn--disabled' : ''
        }`}
        onClick={addToCart}
        disabled={!valid || isAdding}
        aria-busy={isAdding}
      >
        {isAdding ? (
          <span class="zc-cart__loading">
            <span class="zc-spinner" />
            Processing...
          </span>
        ) : (
          <span>
            Add to Cart — {price}
          </span>
        )}
      </button>

      {!valid && state.errors.value.length > 0 && (
        <p class="zc-cart__validation-hint">
          Please complete all required selections
        </p>
      )}
    </div>
  );
}
