import { h } from 'preact';
import type { OptionGroupData, AvailableOptionData } from '../api/client';
import * as state from '../state/configuration';

interface Props {
  group: OptionGroupData;
  available: AvailableOptionData[];
  selected: string | undefined;
  onSelect: (groupSlug: string, valueSlug: string) => void;
}

export function OptionGroup({ group, available, selected, onSelect }: Props) {
  return (
    <div class="zc-option-group" data-group={group.slug}>
      <div class="zc-option-group__header">
        <h3 class="zc-option-group__title">
          {group.name}
          {group.isRequired && <span class="zc-required">*</span>}
        </h3>
        {group.helperText && (
          <p class="zc-option-group__helper">{group.helperText}</p>
        )}
      </div>

      <div class="zc-option-group__values" data-display={group.displayType}>
        {available.map((option) => {
          const isSelected = selected === option.slug;
          const isDisabled = !option.isAvailable;

          return (
            <button
              key={option.slug}
              type="button"
              class={`zc-option ${isSelected ? 'zc-option--selected' : ''} ${isDisabled ? 'zc-option--disabled' : ''}`}
              data-display={group.displayType}
              onClick={() => !isDisabled && onSelect(group.slug, option.slug)}
              disabled={isDisabled}
              title={isDisabled ? option.isDisabledReason : option.name}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
            >
              {/* Swatch display */}
              {group.displayType === 'SWATCH' && (
                <span class="zc-option__swatch">
                  {option.swatchImage ? (
                    <img src={option.swatchImage} alt={option.name} class="zc-option__swatch-img" />
                  ) : (
                    <span
                      class="zc-option__swatch-color"
                      style={{ backgroundColor: option.swatchColor ?? '#ccc' }}
                    />
                  )}
                </span>
              )}

              {/* Thumbnail display */}
              {group.displayType === 'THUMBNAIL' && option.thumbnailUrl && (
                <img src={option.thumbnailUrl} alt={option.name} class="zc-option__thumbnail" />
              )}

              {/* Label */}
              <span class="zc-option__label">{option.name}</span>

              {/* Price delta */}
              {option.priceDelta != null && option.priceDelta !== 0 && (
                <span class="zc-option__price-delta">
                  {option.priceDelta > 0 ? '+' : ''}${Math.abs(option.priceDelta).toFixed(2)}
                </span>
              )}

              {/* Disabled overlay */}
              {isDisabled && (
                <span class="zc-option__disabled-overlay" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
