// v5.0.0 — Shopify cart integration + variant profile switching
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
  var TIMEOUT_MS = 10000;

  if (!shopDomain) { showError('Shop domain not detected.'); return; }
  if (!productId && !productHandle) { showError('No product detected on this page.'); return; }
  if (!proxyPath && !appUrl) { showError('Configurator not configured.'); return; }

  var configurator = null, selections = {}, priceRules = [];
  var activeVariantId = initialVariantId, activeProfileId = null, cartLoading = false;

  function normalizeVariantId(vid) {
    if (!vid) return '';
    var s = String(vid), m = s.match(/gid:\/\/shopify\/ProductVariant\/(\d+)/);
    if (m && m[1]) return m[1];
    return /^\d+$/.test(s) ? s : s;
  }
  function variantIdsMatch(a, b) { return normalizeVariantId(a) === normalizeVariantId(b); }

  function findProfileForVariant(vid) {
    if (!vid || !configurator || !configurator.variantProfiles) return null;
    var profiles = configurator.variantProfiles;
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].shopifyVariantId && variantIdsMatch(profiles[i].shopifyVariantId, vid)) return profiles[i];
    }
    return null;
  }

  function getVisibleGroups() {
    var all = configurator.optionGroups || [];
    if (!activeProfileId) return all.filter(function (g) { return !g.variantProfileId; });
    return all.filter(function (g) { return !g.variantProfileId || g.variantProfileId === activeProfileId; });
  }

  function onVariantChange(newVid) {
    var n = normalizeVariantId(newVid);
    if (n === normalizeVariantId(activeVariantId)) return;
    console.log('[ZureConfigurator] Variant changed:', n);
    activeVariantId = n;
    var profile = findProfileForVariant(n), old = activeProfileId;
    activeProfileId = profile ? profile.id : null;
    if (activeProfileId !== old) { cleanupSelections(); initDefaultsForNewGroups(); }
    render(); emitPriceUpdate();
  }

  function cleanupSelections() {
    var vis = getVisibleGroups(), slugs = {};
    for (var i = 0; i < vis.length; i++) slugs[vis[i].slug] = true;
    var keys = Object.keys(selections);
    for (var j = 0; j < keys.length; j++) { if (!slugs[keys[j]]) delete selections[keys[j]]; }
  }

  function initDefaultsForNewGroups() {
    var vis = getVisibleGroups();
    for (var i = 0; i < vis.length; i++) {
      var g = vis[i]; if (selections[g.slug]) continue;
      var vals = g.values || [];
      for (var j = 0; j < vals.length; j++) { if (vals[j].isDefault) { selections[g.slug] = vals[j].slug; break; } }
    }
  }

  function detectCurrentVariant() {
    var p = new URLSearchParams(window.location.search), v = p.get('variant');
    if (v) return v;
    var input = document.querySelector('form[action*="/cart/add"] select[name="id"], form[action*="/cart/add"] input[name="id"]');
    if (input) return input.value;
    return initialVariantId;
  }

  function watchVariantChanges() {
    var lastUrl = window.location.href;
    setInterval(function () {
      if (window.location.href !== lastUrl) { lastUrl = window.location.href; var p = new URLSearchParams(window.location.search), v = p.get('variant'); if (v) onVariantChange(v); }
    }, 500);
    document.addEventListener('change', function (e) {
      var el = e.target; if (el && el.name === 'id' && el.closest && el.closest('form[action*="/cart/add"]')) onVariantChange(el.value);
    }, true);
    ['variant:change', 'product:variant-change', 'shopify:variant:change'].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        var vid = e.detail && (e.detail.variant && e.detail.variant.id || e.detail.id || e.detail.variantId);
        if (vid) onVariantChange(vid);
      });
    });
    var observer = new MutationObserver(function () {
      var input = document.querySelector('form[action*="/cart/add"] input[name="id"]');
      if (input && normalizeVariantId(input.value) !== normalizeVariantId(activeVariantId)) onVariantChange(input.value);
    });
    var form = document.querySelector('form[action*="/cart/add"]');
    if (form) observer.observe(form, { subtree: true, attributes: true, childList: true });
  }

  var params = new URLSearchParams();
  params.set('shop', shopDomain);
  if (productId) params.set('productId', productId);
  if (productHandle) params.set('handle', productHandle);
  var primaryUrl = proxyPath ? proxyPath + '?' + params.toString() : appUrl + '/api/storefront/configurator?' + params.toString();
  var fallbackUrl = (proxyPath && appUrl) ? appUrl + '/api/storefront/configurator?' + params.toString() : '';

  console.log('[ZureConfigurator] Primary URL:', primaryUrl);

  function fetchWithTimeout(url, opts, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('Timeout')); }, ms);
      fetch(url, opts).then(function (r) { clearTimeout(t); resolve(r); }).catch(function (e) { clearTimeout(t); reject(e); });
    });
  }
  function handleResponse(res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); }

  function processData(result) {
    if (!result.ok || result.data.error) {
      var code = result.data.error || 'UNKNOWN';
      console.error('[ZureConfigurator] API error:', code, result.data.message);
      var msg = 'Configurator could not be loaded.';
      if (code === 'PRODUCT_FAMILY_NOT_FOUND') msg = 'No configurator is available for this product.';
      else if (code === 'FAMILY_NOT_ACTIVE') msg = 'This product configurator is not yet published.';
      else if (code === 'STORE_NOT_FOUND') msg = 'Configurator is not connected to this store.';
      showError(msg); return;
    }
    if (!result.data.configurator || !result.data.configurator.optionGroups) { showError('Configurator data is incomplete.'); return; }

    configurator = result.data.configurator;
    priceRules = configurator.priceRules || [];
    activeVariantId = detectCurrentVariant() || initialVariantId;
    var profile = findProfileForVariant(activeVariantId);
    activeProfileId = profile ? profile.id : null;

    console.log('[ZureConfigurator] Loaded:', configurator.name, '— groups:', (configurator.optionGroups || []).length, '— profiles:', (configurator.variantProfiles || []).length, '— active profile:', profile ? profile.name : 'none');
    initDefaults(); render(); watchVariantChanges();
  }

  fetchWithTimeout(primaryUrl, undefined, TIMEOUT_MS).then(handleResponse).then(processData)
    .catch(function (err) {
      console.error('[ZureConfigurator] Primary failed:', err.message);
      if (fallbackUrl) fetchWithTimeout(fallbackUrl, undefined, TIMEOUT_MS).then(handleResponse).then(processData).catch(function () { showError('Could not connect to configurator service.'); });
      else showError('Could not connect to configurator service.');
    });

  function showError(msg) { console.error('[ZureConfigurator]', msg); container.innerHTML = '<div class="zure-cfg-error">' + eh(msg) + '</div>'; }

  function initDefaults() {
    var groups = getVisibleGroups();
    for (var i = 0; i < groups.length; i++) { var g = groups[i]; if (selections[g.slug]) continue; var vals = g.values || []; for (var j = 0; j < vals.length; j++) { if (vals[j].isDefault) { selections[g.slug] = vals[j].slug; break; } } }
  }

  function evaluateVisibility(conds) {
    if (!conds || !Array.isArray(conds) || conds.length === 0) return true;
    var segs = [], cur = [];
    for (var i = 0; i < conds.length; i++) { cur.push(conds[i]); if (conds[i].connector === 'OR' || conds[i].connector === null || conds[i].connector === undefined) { segs.push(cur); cur = []; } }
    if (cur.length > 0) segs.push(cur);
    for (var s = 0; s < segs.length; s++) { var seg = segs[s], pass = true; for (var x = 0; x < seg.length; x++) { var r = seg[x], sel = selections[r.sourceGroupSlug]; if (r.operator === 'equals' && sel !== r.sourceValueSlug) { pass = false; break; } if (r.operator === 'not_equals' && sel === r.sourceValueSlug) { pass = false; break; } } if (pass) return true; }
    return false;
  }

  function calculatePrice() {
    var base = parseFloat(configurator.basePrice) || 0, total = base;
    var groups = getVisibleGroups();
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g], slug = selections[grp.slug];
      if (!slug) continue;
      var vals = grp.values || [];
      for (var v = 0; v < vals.length; v++) {
        if (vals[v].slug === slug && vals[v].shopifyPrice) { total += parseFloat(vals[v].shopifyPrice) || 0; break; }
      }
    }
    for (var i = 0; i < priceRules.length; i++) { var r = priceRules[i]; if (selections[r.optionGroupSlug] !== r.optionValueSlug) continue; var m = parseFloat(r.priceModifier) || 0; if (r.modifierType === 'ADDITIVE') total += m; else if (r.modifierType === 'PERCENTAGE') total += base * (m / 100); else if (r.modifierType === 'ABSOLUTE' || r.modifierType === 'OVERRIDE') total = m; }
    return total;
  }
  function getPriceMod(gs, vs) { for (var i = 0; i < priceRules.length; i++) { var r = priceRules[i]; if (r.optionGroupSlug === gs && r.optionValueSlug === vs) { var m = parseFloat(r.priceModifier) || 0; if (r.modifierType === 'ADDITIVE' && m !== 0) return (m > 0 ? '+' : '') + fmt(m); } } return null; }
  function fmt(a) { return '$' + Math.abs(a).toFixed(2); }
  function emitPriceUpdate() { document.dispatchEvent(new CustomEvent('zure:price-update', { detail: { price: calculatePrice(), compareAt: null } })); }
  function selectValue(gs, vs) { selections[gs] = vs; render(); emitPriceUpdate(); }

  function render() {
    if (!configurator) return;
    var groups = getVisibleGroups(), html = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], vis = !g.isConditional || evaluateVisibility(g.visibilityConditions);
      html += '<div class="zure-cfg-group' + (vis ? '' : ' zure-cfg-hidden') + '" data-group="' + ea(g.slug) + '">';
      html += '<div class="zure-cfg-group-header"><span class="zure-cfg-group-name">' + eh(g.name) + '</span>';
      if (g.isRequired) html += '<span class="zure-cfg-required">*</span>';
      html += '</div>';
      if (g.helperText) html += '<div class="zure-cfg-helper">' + eh(g.helperText) + '</div>';
      var vals = g.values || [], dt = g.displayType || 'TILE';
      if (dt === 'DROPDOWN') { html += renderDD(g, vals); }
      else { html += '<div class="zure-cfg-values">'; for (var j = 0; j < vals.length; j++) html += renderVal(g, vals[j], dt); html += '</div>'; }
      html += '</div>';
    }
    var tp = calculatePrice();
    if (tp > 0) { html += '<div class="zure-cfg-price-summary"><span class="zure-cfg-price-label">Total Price</span><span class="zure-cfg-price-value">' + fmt(tp) + '</span></div>'; }
    html += '<button class="zure-cfg-cta" id="zure-cfg-add-to-cart">Add to Cart</button>';
    html += '<div id="zure-cfg-status" class="zure-cfg-status" style="display:none;"></div>';
    container.innerHTML = html; bind(); emitPriceUpdate();
  }

  function renderVal(g, v, dt) {
    var sel = selections[g.slug] === v.slug, pm = getPriceMod(g.slug, v.slug), ec = '', inner = '';
    if (dt === 'SWATCH' && v.swatchColor) { ec = ' zure-cfg-swatch'; inner += '<div class="zure-cfg-swatch-circle" style="background:' + ea(v.swatchColor) + ';"></div><span class="zure-cfg-value-label">' + eh(v.name) + '</span>'; }
    else if ((dt === 'THUMBNAIL' || dt === 'TILE') && v.thumbnailUrl) { ec = ' zure-cfg-image" style="--hover-img:url(' + ea(v.thumbnailUrl) + ')'; inner += '<img class="zure-cfg-image-thumb" src="' + ea(v.thumbnailUrl) + '" alt="' + ea(v.name) + '" loading="lazy"/><span class="zure-cfg-value-label">' + eh(v.name) + '</span>'; }
    else { inner += '<span class="zure-cfg-value-label">' + eh(v.name) + '</span>'; }
    if (pm) inner += '<span class="zure-cfg-price-mod">' + eh(pm) + '</span>';
    return '<div class="zure-cfg-value' + ec + '" data-selected="' + sel + '" data-group-slug="' + ea(g.slug) + '" data-value-slug="' + ea(v.slug) + '" role="button" tabindex="0" aria-pressed="' + sel + '">' + inner + '</div>';
  }
  function renderDD(g, vals) {
    var s = selections[g.slug] || '', h = '<select class="zure-cfg-dropdown" data-group-slug="' + ea(g.slug) + '"><option value="">— Select —</option>';
    for (var i = 0; i < vals.length; i++) { var v = vals[i], pm = getPriceMod(g.slug, v.slug); h += '<option value="' + ea(v.slug) + '"' + (s === v.slug ? ' selected' : '') + '>' + eh(v.name + (pm ? ' (' + pm + ')' : '')) + '</option>'; }
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
    if (cartLoading) return;
    cartLoading = true;
    var btn = document.getElementById('zure-cfg-add-to-cart'), st = document.getElementById('zure-cfg-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding to cart...'; }

    var prepareBody = { shop: shopDomain, productFamilyId: configurator.id, variantProfileId: activeProfileId, selections: selections };
    var prepareUrl = proxyPath ? proxyPath.replace(/\?.*$/, '') + '/cart/prepare' : '';

    if (!prepareUrl) {
      console.error('[ZureConfigurator] No proxy path available for cart preparation');
      if (st) { st.style.display = 'block'; st.style.background = '#fef2f2'; st.style.borderColor = '#fecaca'; st.style.color = '#991b1b'; st.textContent = 'Cart not configured. App Proxy required.'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart'; }
      cartLoading = false;
      return;
    }

    fetchWithTimeout(prepareUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prepareBody) }, TIMEOUT_MS)
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || result.data.error) throw new Error(result.data.message || 'Cart prepare failed');
        return result.data;
      })
      .then(function (data) {
        console.log('[ZureConfigurator] Cart prepared:', data.shopifyItems.length, 'items');
        return addToShopifyCart(data.shopifyItems);
      })
      .then(function () {
        if (st) { st.style.display = 'block'; st.textContent = 'Added to cart!'; }
        if (btn) btn.textContent = 'Added!';
        document.dispatchEvent(new CustomEvent('zure:cart-add', { detail: { selections: selections, price: calculatePrice() } }));
        setTimeout(function () { window.location.href = '/cart'; }, 1000);
      })
      .catch(function (err) {
        console.error('[ZureConfigurator] Cart error:', err.message);
        if (st) { st.style.display = 'block'; st.style.background = '#fef2f2'; st.style.borderColor = '#fecaca'; st.style.color = '#991b1b'; st.textContent = err.message || 'Could not add to cart.'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart'; }
        cartLoading = false;
      });
  }

  function addToShopifyCart(items) {
    return fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items }) })
      .then(function (res) { if (!res.ok) return res.json().then(function (d) { throw new Error(d.description || d.message || 'A product may be out of stock.'); }); return res.json(); });
  }

  function eh(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
  function ea(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : ''; }
})();
