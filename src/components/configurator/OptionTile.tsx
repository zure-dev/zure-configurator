'use client';

import { useRef, useCallback } from 'react';
import type { OptionValue } from '@/lib/configurator/types';

export interface OptionTileProps {
  value: OptionValue;
  groupSlug: string;
  groupName: string;
  isSelected: boolean;
  isDisabled: boolean;
  disabledReason: string | null;
  priceDelta: string | null;
  onSelect: () => void;
  onPreviewEnter: (rect: DOMRect) => void;
  onPreviewLeave: () => void;
  onMobileTap: () => void;
  isMobile: boolean;
}

export function OptionTile({
  value, isSelected, isDisabled, disabledReason, priceDelta,
  onSelect, onPreviewEnter, onPreviewLeave, onMobileTap, isMobile,
}: OptionTileProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (isMobile) {
      onMobileTap();
      return;
    }
    if (!isDisabled) onSelect();
  }, [isMobile, isDisabled, onSelect, onMobileTap]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile || !ref.current) return;
    onPreviewEnter(ref.current.getBoundingClientRect());
  }, [isMobile, onPreviewEnter]);

  const hasImage = !!value.thumbnailUrl;
  const hasColor = !!value.swatchColor;

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onPreviewLeave}
      className={`
        group relative flex flex-col text-left rounded-xl overflow-hidden
        transition-all duration-200 outline-none font-body
        ${isSelected
          ? 'ring-2 ring-stone-900 shadow-md'
          : 'ring-1 ring-stone-200 hover:ring-stone-300 shadow-sm hover:shadow-md'
        }
        ${isDisabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}
      `}
    >
      {/* Image / color area */}
      <div
        className="relative w-full aspect-[4/3] overflow-hidden"
        style={{
          backgroundColor: hasColor ? value.swatchColor! : '#F0EDE8',
          backgroundImage: hasImage ? `url(${value.thumbnailUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Hover zoom effect (desktop only) */}
        {hasImage && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${value.thumbnailUrl})` }}
          />
        )}

        {/* Selected badge */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center shadow-lg">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Unavailable badge */}
        {isDisabled && (
          <div className="absolute top-2.5 left-2.5 bg-danger/10 backdrop-blur-sm px-2.5 py-1 rounded-md">
            <span className="text-[10px] font-medium text-danger uppercase tracking-wide">Unavailable</span>
          </div>
        )}

        {/* Price badge */}
        {priceDelta && !isDisabled && (
          <div className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-sm">
            <span className="text-xs font-medium text-success">{priceDelta}</span>
          </div>
        )}
        {!priceDelta && !isDisabled && isSelected && (
          <div className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-sm">
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">Included</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <div className={`text-[13px] leading-snug ${isSelected ? 'font-semibold text-stone-900' : 'font-normal text-stone-700'}`}>
          {value.name}
        </div>
        {isDisabled && disabledReason && (
          <div className="text-[11px] text-danger mt-1 leading-tight">
            {disabledReason}
          </div>
        )}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────
// SWATCH TILE (small circular swatch variant)
// ──────────────────────────────────────────────

export interface SwatchTileProps {
  value: OptionValue;
  groupSlug: string;
  groupName: string;
  isSelected: boolean;
  isDisabled: boolean;
  disabledReason: string | null;
  onSelect: () => void;
  onPreviewEnter: (rect: DOMRect) => void;
  onPreviewLeave: () => void;
  onMobileTap: () => void;
  isMobile: boolean;
}

export function SwatchTile({
  value, isSelected, isDisabled, disabledReason,
  onSelect, onPreviewEnter, onPreviewLeave, onMobileTap, isMobile,
}: SwatchTileProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (isMobile) { onMobileTap(); return; }
    if (!isDisabled) onSelect();
  }, [isMobile, isDisabled, onSelect, onMobileTap]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile || !ref.current) return;
    onPreviewEnter(ref.current.getBoundingClientRect());
  }, [isMobile, onPreviewEnter]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        ref={ref}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onPreviewLeave}
        title={`${value.name}${isDisabled && disabledReason ? ` — ${disabledReason}` : ''}`}
        className={`
          relative w-12 h-12 rounded-full transition-all duration-150 outline-none
          ${isSelected
            ? 'ring-[3px] ring-stone-900 ring-offset-2'
            : 'ring-2 ring-stone-200 hover:ring-stone-400'
          }
          ${isDisabled ? 'opacity-30 cursor-default' : 'cursor-pointer'}
        `}
        style={{
          backgroundColor: value.swatchColor ?? '#ddd',
          backgroundImage: value.swatchImage ? `url(${value.swatchImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {isDisabled && (
          <div className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, transparent 38%, rgba(197,48,48,0.5) 38%, rgba(197,48,48,0.5) 43%, transparent 43%)',
            }}
          />
        )}
      </button>
      <span className={`text-[10px] text-center leading-tight max-w-[56px] ${isSelected ? 'font-medium text-stone-900' : 'text-stone-400'}`}>
        {value.name}
      </span>
    </div>
  );
}
