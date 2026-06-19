// v4.0.0 — Variant profile switching
(function () {
  'use strict';

  var container = document.getElementById('zure-configurator-root');
  if (!container) return;

  var shopDomain = container.dataset.shop || '';
  var productId = container.dataset.productId || '';
  var productHandle = container.dataset.productHandle || '';
  var proxyPath = container.dataset.proxyPath || '';
  var appUrl = (container.dataset.appUrl || '').replace(/\/$/, '');
  var initialVariantId = container.dataset.variantId || '';
  var currency = container.dataset.currency || 'AUD';
  var TIMEOUT_MS = 10000;

  if (!shopDomain) { showError('Shop domain not detected.'); return; }
  if (!productId && !productHandle) { showError('No product detected on this page.'); return; }
  if (!proxyPath && !appUrl) { showError('Configurator not configured.'); return; }

  // ── State ──
  var configurator = null;
  var selections = {};
  var priceRules = [];
  var activeVariantId = initialVariantId;
  var activeProfileId = null;

  // ── Variant ID normalization ──
  function normalizeVariantId(vid) {
    if (!vid) return '';
    var s = String(vid);
    // Extract numeric from GID
    var m = s.match(/gid:\/\/shopify\/ProductVariant\/(\d+)/);
    if (m && m[1]) return m[1];
    // Already numeric
    if (/^\d+$/.test(s)) return s;
    return s;
  }

  function variantIdsMatch(a, b) {
    return normalizeVariantId(a) === normalizeVariantId(b);
  }

  // ── Find matching profile for a variant ID ──
  function findProfileForVariant(vid) {
    if (!vid || !configurator || !configurator.variantProfiles) return null;
    var profiles = configurator.variantProfiles;
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].shopifyVariantId && variantIdsMatch(profiles[i].shopifyVariantId, vid)) {
        return profiles[i];
      }
    }
    return null;
  }

  // ── Get visible groups for active profile ──
  function getVisibleGroups() {
    var allGroups = configurator.optionGroups || [];
    if (!activeProfileId) {
      // No matching profile: show global groups only
      return allGroups.filter(function (g) { return !g.variantProfileId; });
    }
    // Show global + matching profile groups
    return allGroups.filter(function (g) {
      return !g.variantProfileId || g.variantProfileId === activeProfileId;
    });
  }

  // ── Handle variant change ──
  function onVariantChange(newVariantId) {
    var normalized = normalizeVariantId(newVariantId);
    if (normalized === normalizeVariantId(activeVariantId)) return; // No change

    console.log('[ZureConfigurator] Variant changed:', normalized);
    activeVariantId = normalized;

    var profile = findProfileForVariant(normalized);
    var oldProfileId = activeProfileId;
    activeProfileId = profile ? profile.id : null;

    if (activeProfileId !== oldProfileId) {
      console.log('[ZureConfigurator] Active profile:', profile ? profile.name : 'none (global only)');
      cleanupSelections();
      initDefaultsForNewGroups();
    }

    render();
    emitPriceUpdate();
  }

  // ── Remove selections for groups no longer visible ──
  function cleanupSelections() {
    var visible = getVisibleGroups();
    var visibleSlugs = {};
    for (var i = 0; i < visible.length; i++) visibleSlugs[visible[i].slug] = true;

    var keys = Object.keys(selections);
    for (var j = 0; j < keys.length; j++) {
      if (!visibleSlugs[keys[j]]) {
        delete selections[keys[j]];
      }
    }
  }

  // ── Init defaults for newly visible groups that have no selection ──
  function initDefaultsForNewGroups() {
    var visible = getVisibleGroups();
    for (var i = 0; i < visible.length; i++) {
      var g = visible[i];
      if (selections[g.slug]) continue; // Already has selection
      var vals = g.values || [];
      for (var j = 0; j < vals.length; j++) {
        if (vals[j].isDefault) {
          selections[g.slug] = vals[j].slug;
          break;
        }
      }
    }
  }

  // ── Detect active variant from multiple sources ──
  function detectCurrentVariant() {
    // 1. URL query param
    var urlParams = new URLSearchParams(window.location.search);
    var urlVariant = urlParams.get('variant');
    if (urlVariant) return urlVariant;

    // 2. Hidden input or select in product form
    var formInput = document.querySelector('form[action*="/cart/add"] select[name="id"], form[action*="/cart/add"] input[name="id"]');
    if (formInput) return formInput.value;

    // 3. Fallback to initial Liquid value
    return initialVariantId;
  }

  // ── Watch for variant changes in the theme ──
  function watchVariantChanges() {
    // Strategy 1: URL change (popstate / pushstate)
    var lastUrl = window.location.href;
    setInterval(function () {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        var p = new URLSearchParams(window.location.search);
        var v = p.get('variant');
        if (v) onVariantChange(v);
      }
    }, 500);

    // Strategy 2: Listen on product form inputs
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !el.name) return;
      if (el.name === 'id' && el.closest('form[action*="/cart/add"]')) {
        onVariantChange(el.value);
      }
    }, true);

    // Strategy 3: Shopify theme variant change events
    var variantEvents = ['variant:change', 'product:variant-change', 'shopify:variant:change'];
    for (var i = 0; i < variantEvents.length; i++) {
      document.addEventListener(variantEvents[i], function (e) {
        var vid = e.detail && (e.detail.variant && e.detail.variant.id || e.detail.id || e.detail.variantId);
        if (vid) onVariantChange(vid);
      });
    }

    // Strategy 4: MutationObserver on variant selectors
    var observer = new MutationObserver(function () {
      var input = document.querySelector('form[action*="/cart/add"] input[name="id"]');
      if (input && normalizeVariantId(input.value) !== normalizeVariantId(activeVariantId)) {
        onVariantChange(input.value);
      }
    });
    var form = document.querySelector('form[action*="/cart/add"]');
    if (form) observer.observe(form, { subtree: true, attributes: true, childList: true });
  }

  // ── Build fetch URL ──
  var params = new URLSearchParams();
  params.set('shop', shopDomain);
  if (productId) params.set('productId', productId);
  if (productHandle) params.set('handle', productHandle);

  var primaryUrl = proxyPath
    ? proxyPath + '?' + params.toString()
    : appUrl + '/api/storefront/configurator?' + params.toString();
  var fallbackUrl = (proxyPath && appUrl)
    ? appUrl + '/api/storefront/configurator?' + params.toString()
    : '';

  console.log('[ZureConfigurator] Primary URL:', primaryUrl);

  // ── Fetch with timeout ──
  function fetchWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Timeout')); }, timeoutMs);
      fetch(url).then(function (r) { clearTimeout(timer); resolve(r); }).catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function handleResponse(res) {
    console.log('[ZureConfigurator] Status:', res.status);
    return res.json().then(function (d) { return { ok: res.ok, data: d }; });
  }

  function processData(result) {
    if (!result.ok || result.data.error) {
      var code = result.data.error || 'UNKNOWN';
      console.error('[ZureConfigurator] API error:', code, result.data.message);
      if (result.data.debug) console.error('[ZureConfigurator] Debug:', JSON.stringify(result.data.debug, null, 2));
      var msg = 'Configurator could not be loaded.';
      if (code === 'PRODUCT_FAMILY_NOT_FOUND') msg = 'No configurator is available for this product.';
      else if (code === 'FAMILY_NOT_ACTIVE') msg = 'This product configurator is not yet published.';
      else if (code === 'STORE_NOT_FOUND') msg = 'Configurator is not connected to this store.';
      showError(msg);
      return;
    }
    if (!result.data.configurator || !result.data.configurator.optionGroups) {
      showError('Configurator data is incomplete.');
      return;
    }

    configurator = result.data.configurator;
    priceRules = configurator.priceRules || [];

    // Resolve initial variant
    var detectedVariant = detectCurrentVariant();
    activeVariantId = detectedVariant || initialVariantId;
    var profile = findProfileForVariant(activeVariantId);
    activeProfileId = profile ? profile.id : null;

    console.log('[ZureConfigurator] Loaded:', configurator.name,
      '— groups:', (configurator.optionGroups || []).length,
      '— profiles:', (configurator.variantProfiles || []).length,
      '— active variant:', activeVariantId,
      '— active profile:', profile ? profile.name : 'none');

    initDefaults();
    render();
    watchVariantChanges();
  }

  fetchWithTimeout(primaryUrl, TIMEOUT_MS)
    .then(handleResponse).then(processData)
    .catch(function (err) {
      console.error('[ZureConfigurator] Primary failed:', err.message);
      if (fallbackUrl) {
        fetchWithTimeout(fallbackUrl, TIMEOUT_MS).then(handleResponse).then(processData)
          .catch(function () { showError('Could not connect to configurator service.'); });
      } else { showError('Could not connect to configurator service.'); }
    });

  function showError(msg) {
    console.error('[ZureConfigurator]', msg);
    container.innerHTML = '<div class="zure-cfg-error">' + eh(msg) + '</div>';
  }

  function initDefaults() {
    var groups = getVisibleGroups();
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], vals = g.values || [];
      if (selections[g.slug]) continue;
      for (var j = 0; j < vals.length; j++) {
        if (vals[j].isDefault) { selections[g.slug] = vals[j].slug; break; }
      }
    }
  }

  function evaluateVisibility(conditions) {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
    var segments = [], current = [];
    for (var i = 0; i < conditions.length; i++) {
      var c = conditions[i]; current.push(c);
      if (c.connector === 'OR' || c.connector === null || c.connector === undefined) { segments.push(current); current = []; }
    }
    if (current.length > 0) segments.push(current);
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s], pass = true;
      for (var x = 0; x < seg.length; x++) {
        var r = seg[x], sel = selections[r.sourceGroupSlug];
        if (r.operator === 'equals' && sel !== r.sourceValueSlug) { pass = false; break; }
        if (r.operator === 'not_equals' && sel === r.sourceValueSlug) { pass = false; break; }
      }
      if (pass) return true;
    }
    return false;
  }

  function calculatePrice() {
    var base = parseFloat(configurator.basePrice) || 0, total = base;
    for (var i = 0; i < priceRules.length; i++) {
      var r = priceRules[i];
      if (selections[r.optionGroupSlug] !== r.optionValueSlug) continue;
      var m = parseFloat(r.priceModifier) || 0;
      if (r.modifierType === 'ADDITIVE') total += m;
      else if (r.modifierType === 'PERCENTAGE') total += base * (m / 100);
      else if (r.modifierType === 'ABSOLUTE' || r.modifierType === 'OVERRIDE') total = m;
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

  // ── Render (uses getVisibleGroups for variant filtering) ──
  function render() {
    if (!configurator) return;
    var groups = getVisibleGroups(), html = '';

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var vis = !g.isConditional || evaluateVisibility(g.visibilityConditions);
      html += '<div class="zure-cfg-group' + (vis ? '' : ' zure-cfg-hidden') + '" data-group="' + ea(g.slug) + '">';
      html += '<div class="zure-cfg-group-header"><span class="zure-cfg-group-name">' + eh(g.name) + '</span>';
      if (g.isRequired) html += '<span class="zure-cfg-required">*</span>';
      html += '</div>';
      if (g.helperText) html += '<div class="zure-cfg-helper">' + eh(g.helperText) + '</div>';

      var vals = g.values || [], dt = g.displayType || 'TILE';
      if (dt === 'DROPDOWN') { html += renderDD(g, vals); }
      else {
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
    for (var i = 0; i < els.length; i++) { els[i].addEventListener('click', onValClick); els[i].addEventListener('keydown', onValKey); }
    var dds = container.querySelectorAll('.zure-cfg-dropdown');
    for (var j = 0; j < dds.length; j++) dds[j].addEventListener('change', onDD);
    var cta = document.getElementById('zure-cfg-add-to-cart');
    if (cta) cta.addEventListener('click', onCTA);
  }

  function onValClick(e) { var el = e.currentTarget; if (el.dataset.groupSlug && el.dataset.valueSlug) selectValue(el.dataset.groupSlug, el.dataset.valueSlug); }
  function onValKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValClick(e); } }
  function onDD(e) { var el = e.currentTarget; if (el.dataset.groupSlug) selectValue(el.dataset.groupSlug, el.value); }
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
