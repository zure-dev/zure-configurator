'use client';

import type { PreviewData } from './HoverPreview';

interface MobilePreviewSheetProps {
  data: PreviewData;
  onSelect: () => void;
  onClose: () => void;
}

export function MobilePreviewSheet({ data, onSelect, onClose }: MobilePreviewSheetProps) {
  const imageUrl = data.thumbnailUrl ?? data.swatchImage;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[10000] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl overflow-hidden animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Image */}
        <div
          className="mx-4 rounded-xl h-[220px]"
          style={{
            backgroundColor: data.swatchColor ?? '#F0EDE8',
            backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Content */}
        <div className="px-5 pt-4 pb-6">
          <div className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-1">
            {data.groupName}
          </div>
          <div className="text-xl font-medium text-stone-900 mb-1.5">
            {data.valueName}
          </div>

          {data.priceDelta && (
            <div className="text-base font-medium text-success mb-2">{data.priceDelta}</div>
          )}

          {!data.priceDelta && !data.isDisabled && (
            <div className="text-sm text-stone-400 mb-2">Included in base price</div>
          )}

          {data.description && (
            <p className="text-sm text-stone-500 leading-relaxed mb-4">{data.description}</p>
          )}

          {data.isDisabled && data.disabledReason && (
            <div className="px-4 py-3 bg-red-50 rounded-lg border border-red-100 mb-5">
              <div className="text-[10px] font-medium text-danger uppercase tracking-wide mb-0.5">
                Not available
              </div>
              <div className="text-sm text-danger leading-snug">
                {data.disabledReason}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onSelect}
              disabled={data.isDisabled}
              className={`
                flex-[2] py-3 text-sm font-medium rounded-lg transition-colors
                ${data.isDisabled
                  ? 'bg-stone-200 text-stone-400 cursor-default'
                  : 'bg-stone-900 text-white active:bg-stone-800'
                }
              `}
            >
              {data.isDisabled ? 'Unavailable' : 'Select This Option'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
