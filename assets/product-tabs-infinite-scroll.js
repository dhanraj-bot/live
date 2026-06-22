(() => {
  if (window.__FoxProductTabsInfiniteScrollLoaded) return;
  window.__FoxProductTabsInfiniteScrollLoaded = true;

  const LOADER_TIMEOUT_MS = 2500;
  const OBSERVER_OPTIONS = { root: null, rootMargin: '220px 0px', threshold: 0.01 };

  const initSection = (sectionEl) => {
    if (!sectionEl || sectionEl.dataset.productTabsInfiniteInitialized === 'true') return;
    if (!sectionEl.querySelector('.tabs__content[data-infinite-enabled="true"]')) return;
    sectionEl.dataset.productTabsInfiniteInitialized = 'true';

    const loaderTimers = new WeakMap();
    const panelStates = new WeakMap();
    let observer;
    let activePanelSyncTimer = null;
    let isNavigatingAway = false;

    const setPanelLoading = (panel, isLoading) => {
      const activeTimer = loaderTimers.get(panel);
      if (activeTimer) {
        clearTimeout(activeTimer);
        loaderTimers.delete(panel);
      }

      if (!isLoading) {
        panel.removeAttribute('data-infinite-loading');
        return;
      }

      panel.setAttribute('data-infinite-loading', 'true');
      const timeoutId = window.setTimeout(() => {
        panel.removeAttribute('data-infinite-loading');
        loaderTimers.delete(panel);
      }, LOADER_TIMEOUT_MS);
      loaderTimers.set(panel, timeoutId);
    };

    const finishPanelLoading = (panel) => setPanelLoading(panel, false);

    /**
     * Build state for a panel by reading buffered items out of the
     * <template data-infinite-items-template> element that the Liquid now
     * renders for each tab.  The template's children are cloned into an array
     * so we can append them to the live DOM one batch at a time without ever
     * touching sibling panels.
     */
    const getPanelState = (panel) => {
      const cached = panelStates.get(panel);
      if (cached) return cached;

      // Collect items already visible in the DOM for this panel only.
      const items = Array.from(panel.querySelectorAll('[data-tab-product-item]'));

      // Pull buffered (not-yet-visible) items from this panel's <template>.
      // The template lives inside this panel so it is always scoped correctly.
      const pendingItemsTemplate = panel.querySelector('template[data-infinite-items-template]');
      let pendingItems = [];
      if (pendingItemsTemplate) {
        // Clone children out of the template's DocumentFragment.
        pendingItems = Array.from(pendingItemsTemplate.content.children).map((child) =>
          child.cloneNode(true)
        );
        // Remove the template from the DOM — we hold the clones in memory.
        pendingItemsTemplate.remove();
      }

      const state = { items, pendingItems, nextPendingIndex: 0 };
      panelStates.set(panel, state);
      return state;
    };

    const completePanel = (panel) => {
      const sentinel = panel.querySelector('[data-infinite-sentinel]');
      if (sentinel) {
        observer?.unobserve(sentinel);
        sentinel.style.display = 'none';
      }
      finishPanelLoading(panel);
    };

    const isSentinelNearViewport = (panel) => {
      const sentinel = panel.querySelector('[data-infinite-sentinel]');
      if (!sentinel || sentinel.style.display === 'none') return false;
      const rect = sentinel.getBoundingClientRect();
      return rect.top <= window.innerHeight + 220;
    };

    const maybeLoadNextBatch = (panel) => {
      if (!panel) return;
      if (isNavigatingAway) return;
      if (panel.hasAttribute('hidden')) return;
      if (!isSentinelNearViewport(panel)) return;
      window.requestAnimationFrame(() => revealMoreInPanel(panel));
    };

    const revealMoreInPanel = (panel) => {
      if (!panel) return;
      if (isNavigatingAway) return;
      if (panel.getAttribute('data-infinite-loading') === 'true') return;

      const batch = Number(panel.dataset.infiniteBatch) || 0;
      if (batch <= 0) {
        completePanel(panel);
        return;
      }

      // Always read state scoped to THIS panel.
      const state = getPanelState(panel);

      if (!state || state.nextPendingIndex >= state.pendingItems.length) {
        completePanel(panel);
        return;
      }

      setPanelLoading(panel, true);

      window.requestAnimationFrame(() => {
        // Target the product list inside THIS panel only.
        const productList = panel.querySelector('.products-list');
        let revealed = 0;

        while (state.nextPendingIndex < state.pendingItems.length && revealed < batch) {
          const item = state.pendingItems[state.nextPendingIndex];
          state.nextPendingIndex += 1;

          if (productList) {
            // Append BEFORE the sentinel so the grid order is preserved.
            productList.appendChild(item);
          }

          state.items.push(item);
          revealed += 1;
        }

        if (state.nextPendingIndex >= state.pendingItems.length) {
          completePanel(panel);
          return;
        }

        finishPanelLoading(panel);
        maybeLoadNextBatch(panel);
      });
    };

    observer = new IntersectionObserver((entries) => {
      if (isNavigatingAway) return;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // Scope to the panel that owns this sentinel — never a sibling panel.
        const panel = entry.target.closest('.tabs__content');
        if (!panel || panel.hasAttribute('hidden')) return;
        revealMoreInPanel(panel);
      });
    }, OBSERVER_OPTIONS);

    const observePanelSentinel = (panel) => {
      if (!panel) return;
      const sentinel = panel.querySelector('[data-infinite-sentinel]');
      if (!sentinel) return;
      observer.observe(sentinel);
    };

    /**
     * When a tab becomes active we:
     *  1. Unobserve ALL sentinels (stops any background loading).
     *  2. Observe only the newly active panel's sentinel.
     *  3. Immediately check if we should load a batch (e.g. the sentinel is
     *     already near the viewport when the tab switches).
     */
    const syncActivePanel = (panel, attempts = 8) => {
      if (!panel || isNavigatingAway) return;

      // The tabs component may still be toggling `hidden` — retry briefly.
      if (panel.hasAttribute('hidden')) {
        if (attempts <= 0) return;
        activePanelSyncTimer = window.setTimeout(
          () => syncActivePanel(panel, attempts - 1),
          80
        );
        return;
      }

      // Stop watching every panel; only watch the active one.
      sectionEl
        .querySelectorAll('[data-infinite-sentinel]')
        .forEach((sentinel) => observer.unobserve(sentinel));

      observePanelSentinel(panel);
      maybeLoadNextBatch(panel);
      activePanelSyncTimer = null;
    };

    // Clean up any stale loading state on init.
    sectionEl
      .querySelectorAll('.tabs__content')
      .forEach((panel) => panel.removeAttribute('data-infinite-loading'));

    // Bootstrap: initialise state for every panel so template elements are
    // consumed and removed from the DOM before the user ever switches tabs.
    // This avoids layout cost later and ensures each panel's state is isolated.
    sectionEl.querySelectorAll('.tabs__content[data-infinite-enabled="true"]').forEach((panel) => {
      getPanelState(panel);
    });

    // Start observing the first (active) panel.
    const activePanel = sectionEl.querySelector('.tabs__content:not([hidden])');
    syncActivePanel(activePanel);

    // Pause infinite scroll when user navigates away via "view more" link.
    sectionEl.addEventListener(
      'click',
      (event) => {
        const viewMoreLink = event.target.closest('a.view-more-button[href]');
        if (!viewMoreLink) return;
        isNavigatingAway = true;
        if (activePanelSyncTimer) {
          clearTimeout(activePanelSyncTimer);
          activePanelSyncTimer = null;
        }
        observer?.disconnect();
      },
      { capture: true }
    );

    // Re-sync whenever the tab component fires its change event.
    const tabsComponent = sectionEl.querySelector('tabs-component');
    if (tabsComponent) {
      tabsComponent.addEventListener('tabChange', (event) => {
        if (isNavigatingAway) return;
        const nextPanel = event.detail?.selectedTab;
        if (!nextPanel) return;
        if (activePanelSyncTimer) clearTimeout(activePanelSyncTimer);
        syncActivePanel(nextPanel);
      });
    }
  };

  const initAll = () => {
    document
      .querySelectorAll('[data-section-name="section--product-tabs"]')
      .forEach((sectionEl) => initSection(sectionEl));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', initAll);
})();