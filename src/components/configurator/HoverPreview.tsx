'use client';

import { useRef, useState, useEffect } from 'react';

export interface PreviewData {
  groupSlug: string;
  groupName: string;
  valueSlug: string;
  valueName: string;
  description: string | null;
  thumbnailUrl: string | null;
  swatchColor: string | null;
  swatchImage: string | null;
  priceDelta: string | null;
  isDisabled: boolean;
  disabledReason: string | null;
}

interface HoverPreviewProps {
  data: PreviewData;
  anchorRect: DOMRect;
}

export function HoverPreview({ data, anchorRect }: HoverPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, visible: false });

  useEffect(() => {
    if (!ref.current) return;
    const panel = ref.current.getBoundingClientRect();
    const gap = 12;

    let x = anchorRect.right + gap;
    let y = anchorRect.top;

    // Flip left if clipping right
    if (x + panel.width > window.innerWidth - 16) {
      x = anchorRect.left - panel.width - gap;
    }
    // Flip below if still clipping left
    if (x < 16) {
      x = anchorRect.left;
      y = anchorRect.bottom + gap;
    }
    // Prevent bottom clip
    if (y + panel.height > window.innerHeight - 16) {
      y = window.innerHeight - panel.height - 16;
    }
    if (y < 16) y = 16;

    setPos({ x, y, visible: true });
  }, [anchorRect]);

  const imageUrl = data.thumbnailUrl ?? data.swatchImage;

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-[300px] bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden pointer-events-none animate-preview-in"
      style={{
        left: pos.x,
        top: pos.y,
        opacity: pos.visible ? 1 : 0,
      }}
    >
      {/* Image */}
      <div
        className="w-full h-[200px]"
        style={{
          backgroundColor: data.swatchColor ?? '#F0EDE8',
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Content */}
      <div className="px-4 py-3.5">
        <div className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-1">
          {data.groupName}
        </div>
        <div className="text-base font-medium text-stone-900 mb-1">
          {data.valueName}
        </div>

        {data.priceDelta && (
          <div className="text-sm font-medium text-success mb-1">
            {data.priceDelta}
          </div>
        )}

        {!data.priceDelta && !data.isDisabled && (
          <div className="text-xs text-stone-400 mb-1">Included</div>
        )}

        {data.description && (
          <p className="text-xs text-stone-500 leading-relaxed mt-2">
            {data.description}
          </p>
        )}

        {data.isDisabled && data.disabledReason && (
          <div className="mt-3 px-3 py-2.5 bg-red-50 rounded-lg border border-red-100">
            <div className="text-[10px] font-medium text-danger uppercase tracking-wide mb-0.5">
              Not available
            </div>
            <div className="text-xs text-danger leading-snug">
              {data.disabledReason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
