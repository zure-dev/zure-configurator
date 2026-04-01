document.addEventListener('DOMContentLoaded', function () {
  const root = document.getElementById('zure-configurator-root');
  if (!root) return;

  root.innerHTML = `
    <h3>Zure Configurator Loaded</h3>
    <p>Your Shopify theme app extension is working.</p>
  `;
});