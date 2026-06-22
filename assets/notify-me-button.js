(function () {
  'use strict';

  // ─── Storage helpers ──────────────────────────────────────────────────────
  function storageKey(variantId) {
    return 'notify_variant_' + variantId;
  }

  function isSubscribed(variantId) {
    try { return localStorage.getItem(storageKey(variantId)) === 'true'; }
    catch (_) { return false; }
  }

  function saveSubscription(variantId) {
    try { localStorage.setItem(storageKey(variantId), 'true'); }
    catch (_) {}
  }

  // ─── Get ALL wrappers ─────────────────────────────────────────────────────
  function getAllWrappers() {
    return Array.from(document.querySelectorAll('.notify-me-wrapper'));
  }

  // ─── Get all product variants ─────────────────────────────────────────────
  function getAllVariants() {
    if (window.__st && window.__st.p && window.__st.p.variants) return window.__st.p.variants;
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      return window.ShopifyAnalytics.meta.product.variants || [];
    }
    return [];
  }

  function getVariantById(id) {
    return getAllVariants().find(function (v) { return String(v.id) === String(id); }) || null;
  }

  function getVariantIdFromURL() {
    return new URLSearchParams(window.location.search).get('variant');
  }

  // ─── UI helpers (operate on a single wrapper) ─────────────────────────────
  function showSuccessMessage(wrapper) {
    var btn = wrapper.querySelector('.notify-me-btn');
    var msg = wrapper.querySelector('.notify-me-message');
    if (!btn || !msg) return;
    btn.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    btn.style.opacity    = '0';
    btn.style.transform  = 'translateY(-4px)';
    setTimeout(function () {
      btn.style.display = 'none';
      msg.classList.remove('notify-me-message--hidden');
      void msg.offsetHeight;
      msg.classList.add('notify-me-message--visible');
    }, 260);
  }

  function restoreSuccessMessage(wrapper) {
    var btn = wrapper.querySelector('.notify-me-btn');
    var msg = wrapper.querySelector('.notify-me-message');
    if (!btn || !msg) return;
    btn.style.display    = 'none';
    btn.style.opacity    = '1';
    btn.style.transform  = '';
    btn.style.transition = '';
    msg.classList.remove('notify-me-message--hidden');
    msg.classList.add('notify-me-message--visible');
  }

  function resetToButton(wrapper) {
    var btn = wrapper.querySelector('.notify-me-btn');
    var msg = wrapper.querySelector('.notify-me-message');
    if (!btn || !msg) return;
    btn.style.display    = '';
    btn.style.opacity    = '1';
    btn.style.transform  = '';
    btn.style.transition = '';
    msg.classList.remove('notify-me-message--visible');
    msg.classList.add('notify-me-message--hidden');
  }

  function hideWrapper(wrapper) {
    wrapper.style.display = 'none';
    var btn = wrapper.querySelector('.notify-me-btn');
    var msg = wrapper.querySelector('.notify-me-message');
    if (btn) {
      btn.style.display    = '';
      btn.style.opacity    = '1';
      btn.style.transform  = '';
      btn.style.transition = '';
    }
    if (msg) {
      msg.classList.remove('notify-me-message--visible');
      msg.classList.add('notify-me-message--hidden');
    }
  }

  // ─── Core: apply state to ONE wrapper ────────────────────────────────────
  function applyStateToWrapper(wrapper, variant, animate) {
    var variantId = String(variant.id);
    wrapper.dataset.variantId = variantId;

    if (variant.available === false) {
      wrapper.style.display = 'block';
      if (isSubscribed(variantId)) {
        animate ? showSuccessMessage(wrapper) : restoreSuccessMessage(wrapper);
      } else {
        resetToButton(wrapper);
      }
    } else {
      hideWrapper(wrapper);
    }
  }

  // ─── Core: apply state to ALL wrappers ────────────────────────────────────
  function applyVariantState(variant, animate) {
    if (!variant || !variant.id) return;
    getAllWrappers().forEach(function (wrapper) {
      applyStateToWrapper(wrapper, variant, animate);
    });
  }

  function applyVariantById(variantId, animate) {
    if (!variantId) return;
    var variant = getVariantById(variantId);
    if (variant && typeof variant.available !== 'undefined') {
      applyVariantState(variant, animate);
      return;
    }
    fetch('/variants/' + variantId + '.js')
      .then(function (r) { return r.json(); })
      .then(function (v) { applyVariantState(v, animate); })
      .catch(function () {
        console.warn('[NotifyMe] Could not load variant:', variantId);
      });
  }

  // ─── Login flow ───────────────────────────────────────────────────────────
  function triggerLoginFlow() {
    var accountBtn = document.querySelector('.account-button');
    if (accountBtn) {
      accountBtn.click();
    } else {
      var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/account/login?return_url=' + returnUrl;
    }
  }

  // ─── Click handler ────────────────────────────────────────────────────────
  function handleNotifyClick(wrapper) {
    var variantId  = wrapper.dataset.variantId;
    var customerId = wrapper.dataset.customerId;
    var isLoggedIn = customerId && customerId !== '0';

    if (!isLoggedIn) {
      sessionStorage.setItem('notify_intent_variant', variantId);
      triggerLoginFlow();
      return;
    }

    saveSubscription(variantId);
    // Show success on ALL wrappers so desktop + mobile stay in sync
    getAllWrappers().forEach(function (w) {
      showSuccessMessage(w);
    });
  }

  // ─── Post-login intent ────────────────────────────────────────────────────
  function checkPendingIntent() {
    var intentVariantId = sessionStorage.getItem('notify_intent_variant');
    if (!intentVariantId) return;

    var wrappers = getAllWrappers();
    if (!wrappers.length) return;

    var customerId = wrappers[0].dataset.customerId;
    if (!customerId || customerId === '0') return;

    sessionStorage.removeItem('notify_intent_variant');
    // Trigger on first wrapper — handleNotifyClick syncs all
    handleNotifyClick(wrappers[0]);
  }

  // ─── Variant change listeners ─────────────────────────────────────────────
  function bindVariantEvents() {
    document.addEventListener('variant:change', function (e) {
      var v = e.detail && (e.detail.variant || e.detail);
      if (v && v.id) applyVariantState(v, false);
    });

    // variant:changed (some themes use this spelling)
    document.addEventListener('variant:changed', function (e) {
      var v = e.detail && (e.detail.variant || e.detail);
      if (v && v.id) applyVariantState(v, false);
    });

    var productForm = document.querySelector('form[action="/cart/add"]');
    if (productForm) {
      productForm.addEventListener('variant:change', function (e) {
        var v = e.detail && (e.detail.variant || e.detail);
        if (v && v.id) applyVariantState(v, false);
      });
    }

    document.addEventListener('shopify:section:load', function () {
      var variantId = getVariantIdFromURL();
      if (variantId) applyVariantById(variantId, false);
    });

    var lastVariantId = getVariantIdFromURL();

    function checkURLVariantChange() {
      var currentVariantId = getVariantIdFromURL();
      if (currentVariantId && currentVariantId !== lastVariantId) {
        lastVariantId = currentVariantId;
        applyVariantById(currentVariantId, false);
      }
    }

    var originalPushState    = history.pushState.bind(history);
    var originalReplaceState = history.replaceState.bind(history);
    history.pushState = function () {
      originalPushState.apply(history, arguments);
      setTimeout(checkURLVariantChange, 50);
    };
    history.replaceState = function () {
      originalReplaceState.apply(history, arguments);
      setTimeout(checkURLVariantChange, 50);
    };
    window.addEventListener('popstate', function () {
      setTimeout(checkURLVariantChange, 50);
    });

    var productSection = document.querySelector('.product')
                      || document.querySelector('[data-section-type="product"]')
                      || document.querySelector('form[action="/cart/add"]');
    if (productSection) {
      new MutationObserver(function () {
        checkURLVariantChange();
      }).observe(productSection, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-variant-id', 'value', 'name']
      });
    }

    document.addEventListener('change', function (e) {
      var target = e.target;
      if (!target) return;
      if (target.name === 'id' && target.value) {
        applyVariantById(target.value, false);
        return;
      }
      if (target.closest && target.closest('form[action="/cart/add"]')) {
        setTimeout(function () {
          var form = target.closest('form[action="/cart/add"]');
          var idInput = form && form.querySelector('[name="id"]');
          if (idInput && idInput.value) {
            applyVariantById(idInput.value, false);
          } else {
            checkURLVariantChange();
          }
        }, 100);
      }
    });

    setInterval(checkURLVariantChange, 500);
  }

  // ─── Bind click ───────────────────────────────────────────────────────────
  function bindButtons() {
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest('.notify-me-btn');
      if (!btn) return;
      var wrapper = btn.closest('.notify-me-wrapper');
      if (wrapper) handleNotifyClick(wrapper);
    });
  }

  // ─── Init: set correct state for all wrappers on page load ────────────────
  function initWrapperState() {
    var wrappers = getAllWrappers();
    if (!wrappers.length) return;

    // STEP 1 — Synchronous state from data-available (runs immediately, no flash)
    wrappers.forEach(function (wrapper) {
      var isAvailable = wrapper.dataset.available === 'true';
      if (isAvailable) {
        hideWrapper(wrapper);
      } else {
        wrapper.style.display = 'block';
        if (isSubscribed(wrapper.dataset.variantId)) {
          restoreSuccessMessage(wrapper);
        } else {
          resetToButton(wrapper);
        }
      }
    });

    // STEP 2 — Async verification with the real variant object
    var variantId = getVariantIdFromURL() || wrappers[0].dataset.variantId;
    if (variantId) {
      applyVariantById(variantId, false);
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    bindButtons();
    bindVariantEvents();
    checkPendingIntent();
    initWrapperState();

    ['login:success', 'drawer:closed', 'modal:closed'].forEach(function (evt) {
      document.addEventListener(evt, checkPendingIntent);
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();