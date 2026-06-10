// v2.0.0
/**
 * Zure Configurator — Storefront Renderer
 * Vanilla JS, no dependencies. Runs in any Shopify theme.
 * Container: #zure-configurator-root
 * Emits: zure:price-update, zure:cart-add custom events
 */
(function () {
  'use strict';

  var container = document.getElementById('zure-configurator-root');
  if (!container) return;

  var shopDomain = container.dataset.shop || '';
  var productId = container.dataset.productId || '';
  var productHandle = container.dataset.productHandle || '';
  var appUrl = (container.dataset.appUrl || '').replace(/\/$/, '');
  var currency = container.dataset.currency || 'AUD';

  // ── Validate config ──
  if (!appUrl) {
    container.innerHTML = '<div class="zure-cfg-error">Configurator app URL is not configured. Edit the app block settings in the theme editor.</div>';
    console.error('[ZureConfigurator] Missing app URL. data-app-url is empty.');
    return;
  }

  if (!shopDomain) {
    container.innerHTML = '<div class="zure-cfg-error">Shop domain not detected.</div>';
    console.error('[ZureConfigurator] Missing shop domain. data-shop is empty.');
    return;
  }

  if (!productId && !productHandle) {
    container.innerHTML = '<div class="zure-cfg-error">No product detected on this page.</div>';
    console.error('[ZureConfigurator] No product ID or handle found.');
    return;
  }

  // ── State ──
  var configurator = null;
  var selections = {};
  var priceRules = [];

  // ── Build fetch URL ──
  var params = new URLSearchParams();
  params.set('shop', shopDomain);
  if (productId) params.set('productId', productId);
  if (productHandle) params.set('handle', productHandle);
  var fetchUrl = appUrl + '/api/storefront/configurator?' + params.toString();

  console.log('[ZureConfigurator] Fetching:', fetchUrl);

  // ── Fetch data ──
  fetch(fetchUrl)
    .then(function (res) {
      console.log('[ZureConfigurator] Response status:', res.status);
      return res.json().then(function (data) {
        return { status: res.status, ok: res.ok, data: data };
      });
    })
    .then(function (result) {
      if (!result.ok || result.data.error) {
        var errCode = result.data.error || 'UNKNOWN';
        var errMsg = result.data.message || 'Unknown error';

        console.error('[ZureConfigurator] API error:', errCode, errMsg);
        if (result.data.debug) {
          console.error('[ZureConfigurator] Debug:', JSON.stringify(result.data.debug, null, 2));
        }

        // Show customer-appropriate message
        var displayMsg = 'Configurator could not be loaded.';
        if (errCode === 'PRODUCT_FAMILY_NOT_FOUND') {
          displayMsg = 'No configurator is available for this product.';
        } else if (errCode === 'FAMILY_NOT_ACTIVE') {
          displayMsg = 'This product configurator is not yet published.';
        } else if (errCode === 'STORE_NOT_FOUND') {
          displayMsg = 'Configurator is not connected to this store.';
        } else if (errCode === 'MISSING_SHOP' || errCode === 'MISSING_PRODUCT') {
          displayMsg = 'Configurator configuration error. Check app block settings.';
        }

        container.innerHTML = '<div class="zure-cfg-error">' + escapeHtml(displayMsg) + '</div>';
        return;
      }

      configurator = result.data.configurator;
      priceRules = configurator.priceRules || [];
      console.log('[ZureConfigurator] Loaded:', configurator.name, '— groups:', (configurator.optionGroups || []).length);
      initDefaults();
      render();
    })
    .catch(function (err) {
      console.error('[ZureConfigurator] Network/fetch error:', err);
      console.error('[ZureConfigurator] Attempted URL:', fetchUrl);
      container.innerHTML = '<div class="zure-cfg-error">Could not connect to configurator service. Please try again later.</div>';
    });

  // ── Init default selections ──
  function initDefaults() {
    var groups = configurator.optionGroups || [];
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var values = group.values || [];
      for (var j = 0; j < values.length; j++) {
        if (values[j].isDefault) {
          selections[group.slug] = values[j].slug;
          break;
        }
      }
    }
  }

  // ── Conditional visibility ──
  function evaluateVisibility(conditions) {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;

    var segments = [];
    var current = [];

    for (var i = 0; i < conditions.length; i++) {
      var cond = conditions[i];
      current.push(cond);
      if (cond.connector === 'OR' || cond.connector === null || cond.connector === undefined) {
        segments.push(current);
        current = [];
      }
    }
    if (current.length > 0) segments.push(current);

    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s];
      var allPass = true;
      for (var c = 0; c < segment.length; c++) {
        var rule = segment[c];
        var selected = selections[rule.sourceGroupSlug];
        if (rule.operator === 'equals' && selected !== rule.sourceValueSlug) { allPass = false; break; }
        if (rule.operator === 'not_equals' && selected === rule.sourceValueSlug) { allPass = false; break; }
      }
      if (allPass) return true;
    }

    return false;
  }

  // ── Price calculation ──
  function calculatePrice() {
    var base = parseFloat(configurator.basePrice) || 0;
    var total = base;

    for (var i = 0; i < priceRules.length; i++) {
      var rule = priceRules[i];
      var selectedValue = selections[rule.optionGroupSlug];
      if (selectedValue !== rule.optionValueSlug) continue;

      var mod = parseFloat(rule.priceModifier) || 0;
      if (rule.modifierType === 'ADDITIVE') total += mod;
      else if (rule.modifierType === 'PERCENTAGE') total += base * (mod / 100);
      else if (rule.modifierType === 'ABSOLUTE' || rule.modifierType === 'OVERRIDE') total = mod;
    }

    return total;
  }

  function getPriceModifier(groupSlug, valueSlug) {
    for (var i = 0; i < priceRules.length; i++) {
      var rule = priceRules[i];
      if (rule.optionGroupSlug === groupSlug && rule.optionValueSlug === valueSlug) {
        var mod = parseFloat(rule.priceModifier) || 0;
        if (rule.modifierType === 'ADDITIVE' && mod !== 0) {
          return (mod > 0 ? '+' : '') + formatCurrency(mod);
        }
      }
    }
    return null;
  }

  function formatCurrency(amount) {
    return '$' + Math.abs(amount).toFixed(2);
  }

  function emitPriceUpdate() {
    var totalPrice = calculatePrice();
    document.dispatchEvent(new CustomEvent('zure:price-update', {
      detail: { price: totalPrice, compareAt: null }
    }));
  }

  // ── Select handler ──
  function selectValue(groupSlug, valueSlug) {
    selections[groupSlug] = valueSlug;
    render();
    emitPriceUpdate();
  }

  // ── Render ──
  function render() {
    if (!configurator) return;

    var groups = configurator.optionGroups || [];
    var html = '';

    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var visible = !group.isConditional || evaluateVisibility(group.visibilityConditions);
      var hiddenClass = visible ? '' : ' zure-cfg-hidden';

      html += '<div class="zure-cfg-group' + hiddenClass + '" data-group="' + escapeAttr(group.slug) + '">';
      html += '<div class="zure-cfg-group-header">';
      html += '<span class="zure-cfg-group-name">' + escapeHtml(group.name) + '</span>';
      if (group.isRequired) html += '<span class="zure-cfg-required">*</span>';
      html += '</div>';

      if (group.helperText) {
        html += '<div class="zure-cfg-helper">' + escapeHtml(group.helperText) + '</div>';
      }

      var values = group.values || [];
      var displayType = group.displayType || 'TILE';

      if (displayType === 'DROPDOWN') {
        html += renderDropdown(group, values);
      } else {
        html += '<div class="zure-cfg-values">';
        for (var j = 0; j < values.length; j++) {
          html += renderValue(group, values[j], displayType);
        }
        html += '</div>';
      }

      html += '</div>';
    }

    var totalPrice = calculatePrice();
    if (totalPrice > 0) {
      html += '<div class="zure-cfg-price-summary">';
      html += '<span class="zure-cfg-price-label">Configured Price</span>';
      html += '<span class="zure-cfg-price-value">' + formatCurrency(totalPrice) + '</span>';
      html += '</div>';
    }

    html += '<button class="zure-cfg-cta" id="zure-cfg-add-to-cart">Add Configured Product</button>';
    html += '<div id="zure-cfg-status" class="zure-cfg-status" style="display:none;"></div>';

    container.innerHTML = html;
    bindEvents();
    emitPriceUpdate();
  }

  function renderValue(group, value, displayType) {
    var selected = selections[group.slug] === value.slug;
    var priceMod = getPriceModifier(group.slug, value.slug);
    var extraClass = '';
    var inner = '';

    if (displayType === 'SWATCH' && value.swatchColor) {
      extraClass = ' zure-cfg-swatch';
      inner += '<div class="zure-cfg-swatch-circle" style="background:' + escapeAttr(value.swatchColor) + ';"></div>';
      inner += '<span class="zure-cfg-value-label">' + escapeHtml(value.name) + '</span>';
    } else if ((displayType === 'THUMBNAIL' || displayType === 'TILE') && value.thumbnailUrl) {
      extraClass = ' zure-cfg-image';
      inner += '<img class="zure-cfg-image-thumb" src="' + escapeAttr(value.thumbnailUrl) + '" alt="' + escapeAttr(value.name) + '" loading="lazy" />';
      inner += '<span class="zure-cfg-value-label">' + escapeHtml(value.name) + '</span>';
    } else {
      inner += '<span class="zure-cfg-value-label">' + escapeHtml(value.name) + '</span>';
    }

    if (priceMod) {
      inner += '<span class="zure-cfg-price-mod">' + escapeHtml(priceMod) + '</span>';
    }

    return '<div class="zure-cfg-value' + extraClass + '"'
      + ' data-selected="' + (selected ? 'true' : 'false') + '"'
      + ' data-group-slug="' + escapeAttr(group.slug) + '"'
      + ' data-value-slug="' + escapeAttr(value.slug) + '"'
      + ' role="button" tabindex="0"'
      + ' aria-pressed="' + (selected ? 'true' : 'false') + '"'
      + '>' + inner + '</div>';
  }

  function renderDropdown(group, values) {
    var selected = selections[group.slug] || '';
    var html = '<select class="zure-cfg-dropdown" data-group-slug="' + escapeAttr(group.slug) + '">';
    html += '<option value="">— Select —</option>';
    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      var priceMod = getPriceModifier(group.slug, val.slug);
      var label = val.name + (priceMod ? ' (' + priceMod + ')' : '');
      var isSelected = selected === val.slug ? ' selected' : '';
      html += '<option value="' + escapeAttr(val.slug) + '"' + isSelected + '>' + escapeHtml(label) + '</option>';
    }
    html += '</select>';
    return html;
  }

  function bindEvents() {
    var valueEls = container.querySelectorAll('.zure-cfg-value');
    for (var i = 0; i < valueEls.length; i++) {
      valueEls[i].addEventListener('click', handleValueClick);
      valueEls[i].addEventListener('keydown', handleValueKeydown);
    }
    var dropdowns = container.querySelectorAll('.zure-cfg-dropdown');
    for (var j = 0; j < dropdowns.length; j++) {
      dropdowns[j].addEventListener('change', handleDropdownChange);
    }
    var cta = document.getElementById('zure-cfg-add-to-cart');
    if (cta) cta.addEventListener('click', handleAddToCart);
  }

  function handleValueClick(e) {
    var el = e.currentTarget;
    var groupSlug = el.dataset.groupSlug;
    var valueSlug = el.dataset.valueSlug;
    if (groupSlug && valueSlug) selectValue(groupSlug, valueSlug);
  }

  function handleValueKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleValueClick(e);
    }
  }

  function handleDropdownChange(e) {
    var el = e.currentTarget;
    var groupSlug = el.dataset.groupSlug;
    if (groupSlug) selectValue(groupSlug, el.value);
  }

  function handleAddToCart() {
    var statusEl = document.getElementById('zure-cfg-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = 'Configuration captured. Cart integration coming next.';
    }
    var cta = document.getElementById('zure-cfg-add-to-cart');
    if (cta) cta.disabled = true;

    document.dispatchEvent(new CustomEvent('zure:cart-add', {
      detail: { selections: selections, price: calculatePrice() }
    }));

    console.log('[ZureConfigurator] Selections:', JSON.stringify(selections));
    console.log('[ZureConfigurator] Total price:', calculatePrice());
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();

