import { h } from 'preact';
import { useState } from 'preact/hooks';
import * as state from '../state/configuration';

export function MediaGallery() {
  const mediaData = state.media.value;
  const [activeIndex, setActiveIndex] = useState(0);

  if (!mediaData || mediaData.gallery.length === 0) {
    return <div class="zc-gallery zc-gallery--empty" />;
  }

  const images = mediaData.gallery;
  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div class="zc-gallery">
      {/* Hero image */}
      <div class="zc-gallery__hero">
        {activeImage && (
          <img
            src={activeImage.url}
            alt={activeImage.alt}
            class="zc-gallery__hero-img"
            loading="eager"
          />
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div class="zc-gallery__thumbnails">
          {images.map((img, index) => (
            <button
              key={`${img.url}-${index}`}
              type="button"
              class={`zc-gallery__thumb ${
                index === activeIndex ? 'zc-gallery__thumb--active' : ''
              }`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={img.url} alt={img.alt} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
