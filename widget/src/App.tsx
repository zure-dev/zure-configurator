import { h } from 'preact';
import { useConfigSession, useRuleEvaluation } from '../hooks/useConfigSession';
import { OptionGroup } from './OptionGroup';
import { StepNavigator } from './StepNavigator';
import { MediaGallery } from './MediaGallery';
import { ConfigSummary } from './ConfigSummary';
import { AddToCartButton } from './AddToCartButton';
import * as state from '../state/configuration';

interface AppProps {
  shopifyProductId: string;
}

export function App({ shopifyProductId }: AppProps) {
  // Initialize session
  useConfigSession(shopifyProductId);

  // Set up debounced rule evaluation
  useRuleEvaluation();

  // Loading state
  if (state.isLoading.value) {
    return (
      <div class="zc-configurator zc-configurator--loading">
        <div class="zc-loading">
          <div class="zc-loading__spinner" />
          <p class="zc-loading__text">Loading configurator...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.initError.value) {
    return (
      <div class="zc-configurator zc-configurator--error">
        <div class="zc-error">
          <p>Unable to load the product configurator.</p>
          <p class="zc-error__detail">{state.initError.value}</p>
        </div>
      </div>
    );
  }

  const currentGroups = state.currentStepGroups.value;
  const isLastStep = state.isLastStep.value;

  return (
    <div class="zc-configurator">
      {/* Header */}
      <div class="zc-configurator__header">
        <h2 class="zc-configurator__title">
          Configure Your {state.productFamilyName.value}
        </h2>
        <div class="zc-configurator__price">
          {state.pricing.value?.compareAtPrice && (
            <span class="zc-configurator__price-compare">
              {state.formattedCompareAtPrice.value}
            </span>
          )}
          <span class="zc-configurator__price-current">
            {state.formattedPrice.value}
          </span>
          {state.pricing.value?.isTradePrice && (
            <span class="zc-configurator__trade-badge">Trade</span>
          )}
        </div>
      </div>

      {/* Layout: Gallery + Options side by side on desktop */}
      <div class="zc-configurator__layout">
        {/* Media gallery */}
        <div class="zc-configurator__media">
          <MediaGallery />
        </div>

        {/* Options panel */}
        <div class="zc-configurator__options">
          {/* Step navigator */}
          <StepNavigator />

          {/* Current step option groups */}
          <div class="zc-configurator__step-content">
            {currentGroups.map((group) => {
              const available = state.availableOptions.value[group.slug] ?? [];
              const selected = state.selections.value[group.slug];

              return (
                <OptionGroup
                  key={group.slug}
                  group={group}
                  available={available}
                  selected={selected}
                  onSelect={(groupSlug, valueSlug) => {
                    state.setSelection(groupSlug, valueSlug);
                  }}
                />
              );
            })}
          </div>

          {/* Validating indicator */}
          {state.isValidating.value && (
            <div class="zc-configurator__validating">
              Updating...
            </div>
          )}

          {/* Summary + Add to Cart on last step */}
          {isLastStep && (
            <div class="zc-configurator__checkout">
              <ConfigSummary />
              <AddToCartButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
