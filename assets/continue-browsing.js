if (!customElements.get('continue-browsing')) {
  customElements.define(
    'continue-browsing',
    class ContinueBrowsing extends HTMLElement {
      constructor() {
        super();

        if ('requestIdleCallback' in window) {
          requestIdleCallback(this.init.bind(this), { timeout: 1500 });
        } else if (window.FoxTheme && FoxTheme.Motion && FoxTheme.Motion.inView) {
          FoxTheme.Motion.inView(this, this.init.bind(this), { margin: '0px 0px 400px 0px' });
        } else {
          this.init();
        }
      }

      init() {
        this.sectionEl = this.querySelector('[data-continue-browsing-section]');
        this.collectionsWrap = this.querySelector('[data-continue-browsing-collections]');
        this.collectionsList = this.querySelector('[data-continue-browsing-collections-list]');
        this.productsWrap = this.querySelector('[data-continue-browsing-products]');

        const collectionsRendered = this.renderCollections();
        this.loadProducts()
          .then((productsRendered) => {
            this.toggleSection(collectionsRendered || productsRendered);
          })
          .catch(() => {
            this.toggleSection(collectionsRendered);
          });
      }

      toggleSection(show) {
        if (!this.sectionEl) return;
        if (show) {
          this.sectionEl.classList.remove('hidden');
        } else {
          this.remove();
        }
      }

      hasLocalStorage() {
        try {
          const testKey = 'sleek:test';
          window.localStorage.setItem(testKey, '1');
          window.localStorage.removeItem(testKey);
          return true;
        } catch (e) {
          return false;
        }
      }

      safeParseJSON(value, fallback) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return fallback;
        }
      }

      getCollections() {
        if (!this.hasLocalStorage()) return [];
        const raw = window.localStorage.getItem('sleektheme:recently-viewed-collections') || '[]';
        const items = this.safeParseJSON(raw, []);
        return Array.isArray(items) ? items : [];
      }

      renderCollections() {
        if (!this.collectionsWrap || !this.collectionsList) return false;
        if (this.dataset.showCollections === 'false') {
          this.collectionsWrap.classList.add('hidden');
          return false;
        }

        const limit = parseInt(this.dataset.collectionsToShow || '8', 10);
        const items = this.getCollections()
          .filter((c) => c && c.url && (c.title || c.handle))
          .slice(0, Number.isFinite(limit) ? limit : 8);

        if (!items.length) {
          this.collectionsWrap.classList.add('hidden');
          return false;
        }

        const arrowIcon = `
          <svg class="icon icon--medium rtl-flip-x" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6.875 5H15V13.125" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;

        this.collectionsList.innerHTML = items
          .map((item) => {
            const title = (item.title || item.handle || 'Collection').toString();
            const url = this.safeUrl(item.url ? item.url.toString() : '');
            const image = this.safeUrl(item.image ? item.image.toString() : '');
            const aspectRatio = Number.isFinite(item.aspectRatio) && item.aspectRatio > 0 ? item.aspectRatio : 1;

            const media = image
              ? `<img loading="lazy" class="motion-reduce hover-scale-up" src="${this.escapeAttr(
                  image
                )}" alt="${this.escapeHtml(
                  title
                )}">`
              : `<div class="collection-card__placeholder hover-scale-up"></div>`;

            return `
              <div class="collection-card collection-card--style-1 blocks-radius collection-product-card continue-browsing__collection-card">
                <a href="${this.escapeAttr(url || '#')}" class="collection-card__wrapper relative flex flex-col gap-6 focus-inset" aria-label="${this.escapeHtml(
                  title
                )}">
                  <div class="collection-card__image media-wrapper hover-wrapper blocks-radius">
                    <motion-element data-motion="zoom-out-sm" class="block" style="--aspect-ratio: ${aspectRatio};">
                      ${media}
                    </motion-element>
                  </div>
                  <div class="collection-card__inner pointer-events-none">
                    <div class="collection-card__info flex items-center gap-2 w-full">
                      <div class="collection-card__summary flex-1 flex flex-col gap-1 text-left">
                        <h3 class="collection-card__title h4">${this.escapeHtml(title)}</h3>
                      </div>
                      <span class="btn btn--icon-circle btn--secondary shrink-0" aria-hidden="true">
                        ${arrowIcon}
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            `;
          })
          .join('');

        this.collectionsWrap.classList.remove('hidden');
        return true;
      }

      escapeHtml(value) {
        return value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      escapeAttr(value) {
        return this.escapeHtml(value);
      }

      safeUrl(value) {
        const url = (value || '').trim();
        if (!url) return '';
        if (url.startsWith('/')) return url;
        if (url.startsWith('https://') || url.startsWith('http://')) return url;
        return '';
      }

      getProductsQueryUrl() {
        if (this.dataset.showProducts === 'false') return false;
        if (!this.hasLocalStorage()) return false;

        const items = this.safeParseJSON(window.localStorage.getItem('sleektheme:recently-viewed') || '[]', []);
        const productsToShow = parseInt(this.dataset.productsToShow || '8', 10);
        const searchUrl = this.dataset.searchUrl;
        const sectionId = this.dataset.sectionId;

        if (!searchUrl || !sectionId) return false;
        if (!Array.isArray(items) || !items.length) return false;

        const queryParams = items
          .filter((id) => Number.isFinite(parseInt(id, 10)))
          .map((id) => 'id:' + parseInt(id, 10))
          .slice(0, Number.isFinite(productsToShow) ? productsToShow : 8)
          .join(' OR ');

        if (!queryParams) return false;

        return `${searchUrl}?section_id=${encodeURIComponent(sectionId)}&type=product&q=${encodeURIComponent(queryParams)}`;
      }

      async loadProducts() {
        if (!this.productsWrap) return false;

        const queryUrl = this.getProductsQueryUrl();
        if (!queryUrl) {
          this.productsWrap.classList.add('hidden');
          return false;
        }

        const responseText = await (await fetch(queryUrl)).text();
        const sectionInnerHTML = new DOMParser().parseFromString(responseText, 'text/html').querySelector('.shopify-section');
        if (!sectionInnerHTML) return false;

        const fetched = sectionInnerHTML.querySelector('continue-browsing');
        if (!fetched) return false;

        const fetchedProducts = fetched.querySelector('[data-continue-browsing-products]');
        if (!fetchedProducts) return false;

        const hasCards = fetchedProducts.querySelector('.product-card');
        if (!hasCards) {
          this.productsWrap.classList.add('hidden');
          return false;
        }

        this.productsWrap.innerHTML = fetchedProducts.innerHTML;
        this.productsWrap.classList.remove('hidden');
        return true;
      }
    }
  );
}
