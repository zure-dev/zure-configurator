import { h, render } from 'preact';
import { App } from './App';
import { initApiClient } from './api/client';
import styles from './styles/configurator.css?inline';

/**
 * Zure Configurator Web Component.
 * Renders inside Shadow DOM for complete CSS isolation from the theme.
 */
class ZureConfiguratorElement extends HTMLElement {
  private _root: ShadowRoot;

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const productId = this.getAttribute('data-product-id') ?? '';
    const shopDomain = this.getAttribute('data-shop') ?? '';
    const appUrl = this.getAttribute('data-app-url') ?? '';

    if (!productId || !shopDomain || !appUrl) {
      this._root.innerHTML = `
        <div style="padding: 20px; color: #666; text-align: center;">
          Configurator: missing configuration. Check data attributes.
        </div>
      `;
      return;
    }

    // Initialize API client
    initApiClient({ appUrl, shopDomain });

    // Inject styles into shadow DOM
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    this._root.appendChild(styleEl);

    // Create mount point
    const mountPoint = document.createElement('div');
    this._root.appendChild(mountPoint);

    // Render Preact app
    render(h(App, { shopifyProductId: productId }), mountPoint);
  }

  disconnectedCallback() {
    // Cleanup
    const mountPoint = this._root.querySelector('div');
    if (mountPoint) {
      render(null, mountPoint);
    }
  }
}

// Register custom element
if (!customElements.get('zure-configurator')) {
  customElements.define('zure-configurator', ZureConfiguratorElement);
}

// Auto-init: find the root element and create the web component
function autoInit() {
  const root = document.getElementById('zure-configurator-root');
  if (!root) return;

  const configurator = document.createElement('zure-configurator');
  configurator.setAttribute('data-product-id', root.dataset.productId ?? '');
  configurator.setAttribute('data-shop', root.dataset.shop ?? '');
  configurator.setAttribute('data-app-url', root.dataset.appUrl ?? '');

  root.appendChild(configurator);
}

// Run on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}
