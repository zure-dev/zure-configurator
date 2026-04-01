import { h } from 'preact';
import * as state from '../state/configuration';

export function ConfigSummary() {
  const summaryData = state.summary.value;
  const pricingData = state.pricing.value;

  if (!summaryData || !pricingData) return null;

  return (
    <div class="zc-summary">
      <h3 class="zc-summary__title">Your Configuration</h3>

      <div class="zc-summary__lines">
        {summaryData.structured.map((line) => (
          <div key={line.label} class="zc-summary__line">
            <span class="zc-summary__line-label">{line.label}</span>
            <span class="zc-summary__line-value">
              {line.value}
              {line.priceDelta && (
                <span class="zc-summary__line-delta">{line.priceDelta}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div class="zc-summary__total">
        {pricingData.compareAtPrice && (
          <span class="zc-summary__compare-price">
            ${pricingData.compareAtPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </span>
        )}
        <span class="zc-summary__price">
          ${pricingData.totalPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
        </span>
        {pricingData.isTradePrice && (
          <span class="zc-summary__trade-badge">Trade Price</span>
        )}
      </div>
    </div>
  );
}
