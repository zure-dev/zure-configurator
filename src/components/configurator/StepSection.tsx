'use client';

import { useCallback } from 'react';
import type { OptionGroup, OptionValue, PriceLineItem } from '@/lib/configurator/types';
import type { PreviewData } from './HoverPreview';
import { OptionTile, SwatchTile } from './OptionTile';

interface StepSectionProps {
  groups: OptionGroup[];
  selections: Record<string, string>;
  disabled: Record<string, Array<{ slug: string; reason: string }>>;
  pricingLineItems: PriceLineItem[];
  isDisabledFn: (groupSlug: string, valueSlug: string) => boolean;
  getReasonFn: (groupSlug: string, valueSlug: string) => string | null;
  onSelect: (groupSlug: string, valueSlug: string) => void;
  onPreviewEnter: (data: PreviewData, rect: DOMRect) => void;
  onPreviewLeave: () => void;
  onMobileTap: (data: PreviewData) => void;
  isMobile: boolean;
  isOptional?: boolean;
}

export function StepSection({
  groups, selections, pricingLineItems, isDisabledFn, getReasonFn,
  onSelect, onPreviewEnter, onPreviewLeave, onMobileTap, isMobile, isOptional,
}: StepSectionProps) {
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <GroupBlock
          key={group.id}
          group={group}
          selectedSlug={selections[group.slug]}
          pricingLineItems={pricingLineItems}
          isDisabledFn={(vs) => isDisabledFn(group.slug, vs)}
          getReasonFn={(vs) => getReasonFn(group.slug, vs)}
          onSelect={(vs) => onSelect(group.slug, vs)}
          onPreviewEnter={onPreviewEnter}
          onPreviewLeave={onPreviewLeave}
          onMobileTap={onMobileTap}
          isMobile={isMobile}
          isOptional={isOptional}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────

interface GroupBlockProps {
  group: OptionGroup;
  selectedSlug: string | undefined;
  pricingLineItems: PriceLineItem[];
  isDisabledFn: (valueSlug: string) => boolean;
  getReasonFn: (valueSlug: string) => string | null;
  onSelect: (valueSlug: string) => void;
  onPreviewEnter: (data: PreviewData, rect: DOMRect) => void;
  onPreviewLeave: () => void;
  onMobileTap: (data: PreviewData) => void;
  isMobile: boolean;
  isOptional?: boolean;
}

function GroupBlock({
  group, selectedSlug, pricingLineItems, isDisabledFn, getReasonFn,
  onSelect, onPreviewEnter, onPreviewLeave, onMobileTap, isMobile, isOptional,
}: GroupBlockProps) {

  const isSwatch = group.displayType === 'SWATCH';

  const getPriceDelta = useCallback((value: OptionValue): string | null => {
    const line = pricingLineItems.find(
      (li) => li.optionGroupSlug === group.slug && li.optionValueSlug === value.slug
    );
    if (!line || line.amount === 0) return null;
    return `${line.amount >= 0 ? '+' : '-'}$${Math.abs(line.amount).toFixed(2)}`;
  }, [group.slug, pricingLineItems]);

  const buildPreviewData = useCallback((value: OptionValue): PreviewData => ({
    groupSlug: group.slug,
    groupName: group.name,
    valueSlug: value.slug,
    valueName: value.name,
    description: value.description,
    thumbnailUrl: value.thumbnailUrl,
    swatchColor: value.swatchColor,
    swatchImage: value.swatchImage,
    priceDelta: getPriceDelta(value),
    isDisabled: isDisabledFn(value.slug),
    disabledReason: getReasonFn(value.slug),
  }), [group, getPriceDelta, isDisabledFn, getReasonFn]);

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-stone-900">{group.name}</h3>
          {isOptional && (
            <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Optional
            </span>
          )}
        </div>
        {group.helperText && (
          <p className="text-[13px] text-stone-400 mt-1">{group.helperText}</p>
        )}
      </div>

      {/* Grid */}
      {isSwatch ? (
        <div className="flex flex-wrap gap-3">
          {group.values.map((value) => (
            <SwatchTile
              key={value.slug}
              value={value}
              groupSlug={group.slug}
              groupName={group.name}
              isSelected={selectedSlug === value.slug}
              isDisabled={isDisabledFn(value.slug)}
              disabledReason={getReasonFn(value.slug)}
              onSelect={() => onSelect(value.slug)}
              onPreviewEnter={(rect) => onPreviewEnter(buildPreviewData(value), rect)}
              onPreviewLeave={onPreviewLeave}
              onMobileTap={() => onMobileTap(buildPreviewData(value))}
              isMobile={isMobile}
            />
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-4'}`}>
          {group.values.map((value) => (
            <OptionTile
              key={value.slug}
              value={value}
              groupSlug={group.slug}
              groupName={group.name}
              isSelected={selectedSlug === value.slug}
              isDisabled={isDisabledFn(value.slug)}
              disabledReason={getReasonFn(value.slug)}
              priceDelta={getPriceDelta(value)}
              onSelect={() => onSelect(value.slug)}
              onPreviewEnter={(rect) => onPreviewEnter(buildPreviewData(value), rect)}
              onPreviewLeave={onPreviewLeave}
              onMobileTap={() => onMobileTap(buildPreviewData(value))}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
