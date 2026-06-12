// v3.0.0 — Fixed container ID, App Proxy, timeout, error handling
(function () {
  'use strict';

  var container = document.getElementById('zure-configurator-root');
  if (!container) return;

  var shopDomain = container.dataset.shop || '';
  var productId = container.dataset.productId || '';
  var productHandle = container.dataset.productHandle || '';
  var proxyPath = container.dataset.proxyPath || '';
  var appUrl = (container.dataset.appUrl || '').replace(/\/$/, '');
  var currency = container.dataset.currency || 'AUD';
  var TIMEOUT_MS = 10000;

  // ── Validate ──
  if (!shopDomain) { showError('Shop domain not detected.'); return; }
  if (!productId && !productHandle) { showError('No product detected on this page.'); return; }
  if (!proxyPath && !appUrl) { showError('Configurator not configured. Set up App Proxy or enter the App URL in block settings.'); return; }

  // ── State ──
  var configurator = null;
  var selections = {};
  var priceRules = [];

  // ── Build fetch URL ──
  var params = new URLSearchParams();
  params.set('shop', shopDomain);
  if (productId) params.set('productId', productId);
  if (productHandle) params.set('handle', productHandle);

  var primaryUrl = '';
  var fallbackUrl = '';

  if (proxyPath) {
    primaryUrl = proxyPath + '?' + params.toString();
    if (appUrl) fallbackUrl = appUrl + '/api/storefront/configurator?' + params.toString();
  } else {
    primaryUrl = appUrl + '/api/storefront/configurator?' + params.toString();
  }

  console.log('[ZureConfigurator] Primary URL:', primaryUrl);
  if (fallbackUrl) console.log('[ZureConfigurator] Fallback URL:', fallbackUrl);

  // ── Fetch with timeout ──
  function fetchWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Request timed out after ' + timeoutMs + 'ms')); }, timeoutMs);
      fetch(url)
        .then(function (res) { clearTimeout(timer); resolve(res); })
        .catch(function (err) { clearTimeout(timer); reject(err); });
    });
  }

  function handleResponse(res) {
    console.log('[ZureConfigurator] Response status:', res.status);
    return res.json().then(function (data) { return { ok: res.ok, data: data }; });
  }

  function processData(result) {
    if (!result.ok || result.data.error) {
      var errCode = result.data.error || 'UNKNOWN';
      var errMsg = result.data.message || 'Unknown error';
      console.error('[ZureConfigurator] API error:', errCode, errMsg);
      if (result.data.debug) console.error('[ZureConfigurator] Debug:', JSON.stringify(result.data.debug, null, 2));

      var displayMsg = 'Configurator could not be loaded.';
      if (errCode === 'PRODUCT_FAMILY_NOT_FOUND') displayMsg = 'No configurator is available for this product.';
      else if (errCode === 'FAMILY_NOT_ACTIVE') displayMsg = 'This product configurator is not yet published.';
      else if (errCode === 'STORE_NOT_FOUND') displayMsg = 'Configurator is not connected to this store.';
      showError(displayMsg);
      return;
    }

    if (!result.data.configurator || !result.data.configurator.optionGroups) {
      console.error('[ZureConfigurator] Invalid response: missing configurator or optionGroups');
      showError('Configurator data is incomplete.');
      return;
    }

    configurator = result.data.configurator;
    priceRules = configurator.priceRules || [];
    console.log('[ZureConfigurator] Loaded:', configurator.name, '—', (configurator.optionGroups || []).length, 'groups');
    initDefaults();
    render();
  }

  // ── Primary fetch ──
  fetchWithTimeout(primaryUrl, TIMEOUT_MS)
    .then(handleResponse)
    .then(processData)
    .catch(function (err) {
      console.error('[ZureConfigurator] Primary fetch failed:', err.message, '— URL:', primaryUrl);

      if (fallbackUrl) {
        console.log('[ZureConfigurator] Trying fallback...');
        fetchWithTimeout(fallbackUrl, TIMEOUT_MS)
          .then(handleResponse)
          .then(processData)
          .catch(function (err2) {
            console.error('[ZureConfigurator] Fallback also failed:', err2.message);
            showError('Could not connect to configurator service.');
          });
      } else {
        showError('Could not connect to configurator service.');
      }
    });

  // ── Show error (always replaces loading UI) ──
  function showError(msg) {
    console.error('[ZureConfigurator]', msg);
    container.innerHTML = '<div class="zure-cfg-error">' + escapeHtml(msg) + '</div>';
  }

  // ── Init defaults ──
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
    var segments = [], current = [];
    for (var i = 0; i < conditions.length; i++) {
      var cond = conditions[i];
      current.push(cond);
      if (cond.connector === 'OR' || cond.connector === null || cond.connector === undefined) {
        segments.push(current); current = [];
      }
    }
    if (current.length > 0) segments.push(current);
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s], allPass = true;
      for (var c = 0; c < seg.length; c++) {
        var rule = seg[c], selected = selections[rule.sourceGroupSlug];
        if (rule.operator === 'equals' && selected !== rule.sourceValueSlug) { allPass = false; break; }
        if (rule.operator === 'not_equals' && selected === rule.sourceValueSlug) { allPass = false; break; }
      }
      if (allPass) return true;
    }
    return false;
  }

  // ── Price ──
  function calculatePrice() {
    var base = parseFloat(configurator.basePrice) || 0, total = base;
    for (var i = 0; i < priceRules.length; i++) {
      var rule = priceRules[i];
      if (selections[rule.optionGroupSlug] !== rule.optionValueSlug) continue;
      var mod = parseFloat(rule.priceModifier) || 0;
      if (rule.modifierType === 'ADDITIVE') total += mod;
      else if (rule.modifierType === 'PERCENTAGE') total += base * (mod / 100);
      else if (rule.modifierType === 'ABSOLUTE' || rule.modifierType === 'OVERRIDE') total = mod;
    }
    return total;
  }

  function getPriceMod(gs, vs) {
    for (var i = 0; i < priceRules.length; i++) {
      var r = priceRules[i];
      if (r.optionGroupSlug === gs && r.optionValueSlug === vs) {
        var m = parseFloat(r.priceModifier) || 0;
        if (r.modifierType === 'ADDITIVE' && m !== 0) return (m > 0 ? '+' : '') + fmt(m);
      }
    }
    return null;
  }

  function fmt(a) { return '$' + Math.abs(a).toFixed(2); }

  function emitPriceUpdate() {
    document.dispatchEvent(new CustomEvent('zure:price-update', { detail: { price: calculatePrice(), compareAt: null } }));
  }

  function selectValue(gs, vs) { selections[gs] = vs; render(); emitPriceUpdate(); }

  // ── Render ──
  function render() {
    if (!configurator) return;
    var groups = configurator.optionGroups || [], html = '';

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var vis = !g.isConditional || evaluateVisibility(g.visibilityConditions);
      html += '<div class="zure-cfg-group' + (vis ? '' : ' zure-cfg-hidden') + '" data-group="' + ea(g.slug) + '">';
      html += '<div class="zure-cfg-group-header"><span class="zure-cfg-group-name">' + eh(g.name) + '</span>';
      if (g.isRequired) html += '<span class="zure-cfg-required">*</span>';
      html += '</div>';
      if (g.helperText) html += '<div class="zure-cfg-helper">' + eh(g.helperText) + '</div>';

      var vals = g.values || [], dt = g.displayType || 'TILE';
      if (dt === 'DROPDOWN') {
        html += renderDD(g, vals);
      } else {
        html += '<div class="zure-cfg-values">';
        for (var j = 0; j < vals.length; j++) html += renderVal(g, vals[j], dt);
        html += '</div>';
      }
      html += '</div>';
    }

    var tp = calculatePrice();
    if (tp > 0) {
      html += '<div class="zure-cfg-price-summary"><span class="zure-cfg-price-label">Configured Price</span>';
      html += '<span class="zure-cfg-price-value">' + fmt(tp) + '</span></div>';
    }
    html += '<button class="zure-cfg-cta" id="zure-cfg-add-to-cart">Add Configured Product</button>';
    html += '<div id="zure-cfg-status" class="zure-cfg-status" style="display:none;"></div>';

    container.innerHTML = html;
    bind();
    emitPriceUpdate();
  }

  function renderVal(g, v, dt) {
    var sel = selections[g.slug] === v.slug, pm = getPriceMod(g.slug, v.slug), ec = '', inner = '';
    if (dt === 'SWATCH' && v.swatchColor) {
      ec = ' zure-cfg-swatch';
      inner += '<div class="zure-cfg-swatch-circle" style="background:' + ea(v.swatchColor) + ';"></div>';
      inner += '<span class="zure-cfg-value-label">' + eh(v.name) + '</span>';
    } else if ((dt === 'THUMBNAIL' || dt === 'TILE') && v.thumbnailUrl) {
      ec = ' zure-cfg-image';
      inner += '<img class="zure-cfg-image-thumb" src="' + ea(v.thumbnailUrl) + '" alt="' + ea(v.name) + '" loading="lazy"/>';
      inner += '<span class="zure-cfg-value-label">' + eh(v.name) + '</span>';
    } else {
      inner += '<span class="zure-cfg-value-label">' + eh(v.name) + '</span>';
    }
    if (pm) inner += '<span class="zure-cfg-price-mod">' + eh(pm) + '</span>';
    return '<div class="zure-cfg-value' + ec + '" data-selected="' + sel + '" data-group-slug="' + ea(g.slug) + '" data-value-slug="' + ea(v.slug) + '" role="button" tabindex="0" aria-pressed="' + sel + '">' + inner + '</div>';
  }

  function renderDD(g, vals) {
    var s = selections[g.slug] || '';
    var h = '<select class="zure-cfg-dropdown" data-group-slug="' + ea(g.slug) + '"><option value="">— Select —</option>';
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i], pm = getPriceMod(g.slug, v.slug);
      h += '<option value="' + ea(v.slug) + '"' + (s === v.slug ? ' selected' : '') + '>' + eh(v.name + (pm ? ' (' + pm + ')' : '')) + '</option>';
    }
    return h + '</select>';
  }

  function bind() {
    var els = container.querySelectorAll('.zure-cfg-value');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', onValClick);
      els[i].addEventListener('keydown', onValKey);
    }
    var dds = container.querySelectorAll('.zure-cfg-dropdown');
    for (var j = 0; j < dds.length; j++) dds[j].addEventListener('change', onDD);
    var cta = document.getElementById('zure-cfg-add-to-cart');
    if (cta) cta.addEventListener('click', onCTA);
  }

  function onValClick(e) {
    var el = e.currentTarget, gs = el.dataset.groupSlug, vs = el.dataset.valueSlug;
    if (gs && vs) selectValue(gs, vs);
  }
  function onValKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValClick(e); } }
  function onDD(e) { var el = e.currentTarget, gs = el.dataset.groupSlug; if (gs) selectValue(gs, el.value); }
  function onCTA() {
    var st = document.getElementById('zure-cfg-status');
    if (st) { st.style.display = 'block'; st.textContent = 'Configuration captured. Cart integration coming next.'; }
    var btn = document.getElementById('zure-cfg-add-to-cart');
    if (btn) btn.disabled = true;
    document.dispatchEvent(new CustomEvent('zure:cart-add', { detail: { selections: selections, price: calculatePrice() } }));
    console.log('[ZureConfigurator] Selections:', JSON.stringify(selections));
  }

  function eh(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
  function ea(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : ''; }

})();
