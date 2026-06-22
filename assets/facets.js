class FacetShort extends HTMLSelectElement {
  constructor() {
    super();
    this.initMotionInView();
    this.addEventListener('change', this.onSelectChange.bind(this));
  }

  get options() {
    return this.getElementsByTagName('option');
  }

  get fakeSelectElement() {
    return this.previousElementSibling;
  }

  initMotionInView() {
    FoxTheme.Motion.inView(this, this.calcSelectWidth.bind(this), { margin: '200px 0px 200px 0px' });
  }

  calcSelectWidth() {
    const selectStyle = window.getComputedStyle(this);
    const selectedOptionText = this.options[this.selectedIndex].text;

    const textElement = this.createTextElement(selectedOptionText, selectStyle);
    document.body.appendChild(textElement);
    const selectWidth = textElement.offsetWidth;
    textElement.remove();

    this.style.setProperty('--width', `${selectWidth + 22}px`);
  }

  createTextElement(text, style) {
    const textElement = document.createElement('span');
    textElement.style.fontFamily = style.fontFamily;
    textElement.style.fontSize = style.fontSize;
    textElement.style.fontWeight = style.fontWeight;
    textElement.style.visibility = 'hidden';
    textElement.style.position = 'absolute';
    textElement.innerHTML = text;
    return textElement;
  }

  onSelectChange(event) {
    this.calcSelectWidth();
    this.updateFormParams(event);
  }

  updateFormParams(event) {
    const form = this.getClosestFacetForm() || this.getFirstFacetForm();

    if (form) {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', event.target.value);
      url.searchParams.set('section_id', FoxTheme.utils.getSectionId(form));
      url.searchParams.delete('page');
      
      // Handle availability filter and sorting logic
      form.handleAvailabilityFilter(url);
      
      form.renderSection(url.toString(), event);
    }
  }

  getClosestFacetForm() {
    return this.closest('form[is="facet-form"]');
  }

  getFirstFacetForm() {
    return document.querySelector('form[is="facet-form"]');
  }
}

customElements.define('facet-short', FacetShort, { extends: 'select' });
class PriceRange extends HTMLElement {
  constructor() {
    super();

    this.minRangeInput = this.querySelector('input[type="range"]:first-child');
    this.maxRangeInput = this.querySelector('input[type="range"]:last-child');
    this.minPriceInput = this.querySelector('input[name="filter.v.price.gte"]');
    this.maxPriceInput = this.querySelector('input[name="filter.v.price.lte"]');

    this.minPriceInput.addEventListener('focus', this.minPriceInput.select);
    this.maxPriceInput.addEventListener('focus', this.maxPriceInput.select);
    this.minPriceInput.addEventListener('change', this.handleInputMinChange.bind(this));
    this.maxPriceInput.addEventListener('change', this.handleInputMaxChange.bind(this));

    this.minRangeInput.addEventListener('change', this.handleRangeMinChange.bind(this));
    this.maxRangeInput.addEventListener('change', this.handleRangeMaxChange.bind(this));
    this.minRangeInput.addEventListener('input', this.handleRangeMinInput.bind(this));
    this.maxRangeInput.addEventListener('input', this.handleRangeMaxInput.bind(this));
  }

  handleInputMinChange(event) {
    event.preventDefault();
    event.target.value = Math.max(
      Math.min(parseInt(event.target.value), parseInt(this.maxPriceInput.value || event.target.max) - 1),
      event.target.min
    );
    this.minRangeInput.value = event.target.value;
    this.minRangeInput.parentElement.style.setProperty(
      '--range-min',
      `${(parseInt(this.minRangeInput.value) / parseInt(this.minRangeInput.max)) * 100}%`
    );
  }

  handleInputMaxChange(event) {
    event.preventDefault();
    event.target.value = Math.min(
      Math.max(parseInt(event.target.value), parseInt(this.minPriceInput.value || event.target.min) + 1),
      event.target.max
    );
    this.maxRangeInput.value = event.target.value;
    this.maxRangeInput.parentElement.style.setProperty(
      '--range-max',
      `${(parseInt(this.maxRangeInput.value) / parseInt(this.maxRangeInput.max)) * 100}%`
    );
  }

  handleRangeMinChange(event) {
    event.stopPropagation();
    this.minPriceInput.value = event.target.value;
    this.minPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  handleRangeMaxChange(event) {
    event.stopPropagation();
    this.maxPriceInput.value = event.target.value;
    this.maxPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  handleRangeMinInput(event) {
    event.target.value = Math.min(
      parseInt(event.target.value),
      parseInt(this.maxPriceInput.value || event.target.max) - 1
    );
    event.target.parentElement.style.setProperty(
      '--range-min',
      `${(parseInt(event.target.value) / parseInt(event.target.max)) * 100}%`
    );
    this.minPriceInput.value = event.target.value;
  }

  handleRangeMaxInput(event) {
    event.target.value = Math.max(
      parseInt(event.target.value),
      parseInt(this.minPriceInput.value || event.target.min) + 1
    );
    event.target.parentElement.style.setProperty(
      '--range-max',
      `${(parseInt(event.target.value) / parseInt(event.target.max)) * 100}%`
    );
    this.maxPriceInput.value = event.target.value;
  }
}
customElements.define('price-range', PriceRange);

class FacetForm extends HTMLFormElement {
  constructor() {
    super();

    this.dirty = false;
    this.cachedMap = new Map();

    this.addEventListener('change', this.onFormChange);
    this.addEventListener('submit', this.onFormSubmit);
  }

  connectedCallback() {
    // Handle initial state of availability filter
    this.initializeAvailabilityFilter();
    
    // Apply initial sorting if needed
    this.applyInitialSorting();

    const path = window.location.pathname.replace(/\/$/, '');

    if (path === '/collections/red-hot-sale') {
      this.ensureAvailabilityFilterOnLoad();
    }
    // this.ensureAvailabilityFilterOnLoad();
  }

  initializeAvailabilityFilter() {
    this.syncAvailabilityCheckbox(true);
  }

  /**
   * Applies initial sorting when the page loads with filters
   */
  applyInitialSorting() {
    // Use setTimeout to ensure the DOM is fully loaded
    setTimeout(() => {
      this.sortProductsByAvailability();
    }, 100);
  }

  onFormChange(event) {
    // Keep the availability filter locked on so sold-out products never render in listings.
    if (event && event.target && event.target.name === 'filter.v.availability' && !event.target.checked) {
      event.target.checked = true;
      return;
    }
    
    this.dirty = true;
    this.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  onFormSubmit(event) {
    event.preventDefault();
    if (!this.dirty) return;

    const url = this.buildUrl().toString();
    this.renderSection(url, event);
  }

  buildUrl() {
    const formData = new FormData(this);
    const url = new URL(window.location.href);
    const formFieldNames = new Set(
      Array.from(this.elements)
        .map((element) => element.name)
        .filter(Boolean)
    );

    // Preserve filters coming from other facet forms (e.g. collection chips vs sidebar facets),
    // but replace the params that belong to the current form.
    formFieldNames.forEach((name) => {
      url.searchParams.delete(name);
    });
    formData.forEach((value, key) => url.searchParams.append(key, value));

    // Handle availability filter logic
    this.handleAvailabilityFilter(url);

    ['section_id', 'page', 'filter.v.price.gte', 'filter.v.price.lte'].forEach((item) => {
      if (url.searchParams.get(item) === '') {
        url.searchParams.delete(item);
      }
    });

    url.searchParams.set('section_id', FoxTheme.utils.getSectionId(this));
    return url;
  }

  /**
   * Handles the automatic availability filter logic
   * - Always apply the availability filter so collection listings only show in-stock products
   * - Remove the previous invalid availability parameter if it is present in the URL
   * @param {URL} url - The URL object to modify
   */
  handleAvailabilityFilter(url) {
    // Shopify's availability facet uses filter.v.availability=1.
    // Keep the old incorrect param out of URLs in case it exists from older theme code.
    url.searchParams.delete('filter.v.available');
    url.searchParams.set('filter.v.availability', '1');
    this.syncAvailabilityCheckbox(true);
  }

  /**
   * Applies a custom sort order that prioritizes in-stock products
   * @param {URL} url - The URL object to modify
   */
  applyInStockFirstSort(url) {
    // Since Shopify doesn't support server-side availability sorting,
    // we'll use a custom parameter to trigger client-side sorting
    const currentSort = url.searchParams.get('sort_by');
    
    // If no sort is applied or it's not our custom sort, apply the in-stock first sort
    if (!currentSort || !currentSort.includes('available')) {
      // Use a custom parameter to indicate we want in-stock first sorting
      url.searchParams.set('in_stock_first', '1');
    }
  }

  /**
   * Removes the custom in-stock first sort when no filters are applied
   * @param {URL} url - The URL object to modify
   */
  removeInStockFirstSort(url) {
    // Remove the custom parameter
    url.searchParams.delete('in_stock_first');
  }

  /**
   * Synchronizes the availability filter checkbox with the desired state
   * @param {boolean} shouldBeChecked - Whether the checkbox should be checked
   */
  syncAvailabilityCheckbox(shouldBeChecked) {
    const availabilityCheckbox = this.querySelector('input[name="filter.v.availability"]');
    if (availabilityCheckbox) {
      availabilityCheckbox.checked = shouldBeChecked;
    }
  }

  ensureAvailabilityFilterOnLoad() {
    if (FacetForm.availabilityInitialRenderDone) return;

    const url = new URL(window.location.href);
    const hasAvailabilityFilter = url.searchParams.get('filter.v.availability') === '1';
    const hasLegacyAvailabilityFilter = url.searchParams.has('filter.v.available');

    if (hasAvailabilityFilter && !hasLegacyAvailabilityFilter) return;

    FacetForm.availabilityInitialRenderDone = true;
    url.searchParams.delete('filter.v.available');
    url.searchParams.set('filter.v.availability', '1');
    url.searchParams.delete('page');
    url.searchParams.set('section_id', FoxTheme.utils.getSectionId(this));

    if (this.hasAttribute('data-history')) this.updateURLHash(url);
    this.renderSection(url.toString());
  }

  updateURLHash(url) {
    const clonedUrl = new URL(url);
    clonedUrl.searchParams.delete('section_id');
    history.replaceState({}, '', clonedUrl.toString());
  }

  beforeRenderSection() {
    const container = document.getElementById('ProductGridContainer');
    const loadings = document.querySelectorAll('[data-facet-loading]');
    const translateY = FoxTheme.config.motionReduced ? 0 : 50;

    FoxTheme.Motion.timeline([[container, { y: translateY, opacity: 0 }, { duration: 0 }]]);

    setTimeout(() => {
      const target = document.querySelector('.collection');
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - 95,
        behavior: FoxTheme.config.motionReduced ? 'auto' : 'smooth',
      });
      if (loadings) {
        loadings.forEach((loading) => {
          loading.classList.add('btn--loading');
        });
      }
    }, 100);
  }

  afterRenderSection() {
    const container = document.getElementById('ProductGridContainer');
    const items = container.querySelectorAll('.product-card');
    const loadings = document.querySelectorAll('[data-facet-loading]');
    const translateY = FoxTheme.config.motionReduced ? 0 : 50;

    FoxTheme.Motion.timeline([
      [container, { y: [translateY, 0], opacity: [0, 1] }],
      [
        items,
        { y: [translateY, 0], opacity: [0, 1], visibility: ['hidden', 'visible'] },
        { duration: 0.5, delay: FoxTheme.config.motionReduced ? 0 : FoxTheme.Motion.stagger(0.1) },
      ],
    ]);

    if (loadings) {
      loadings.forEach((loading) => {
        loading.classList.remove('btn--loading');
      });
    }

    document.dispatchEvent(new CustomEvent('collection:rerendered'));
  }

  renderSection(url, event) {
    this.cachedMap.has(url) ? this.renderSectionFromCache(url, event) : this.renderSectionFromFetch(url, event);

    if (this.hasAttribute('data-history')) this.updateURLHash(url);

    this.dirty = false;
  }

  renderSectionFromFetch(url, event) {
    this.beforeRenderSection();
    const start = performance.now();

    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const execution = performance.now() - start;

        setTimeout(
          () => {
            this.renderFilters(responseText, event);
            this.renderFiltersActive(responseText);
            this.renderProductGridContainer(responseText, event);
            this.renderProductCount(responseText);
            this.renderSortBy(responseText);
            this.renderSortByMobile(responseText);

            FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.facetUpdate, { responseText: responseText });
            this.cachedMap.set(url, responseText);

            this.afterRenderSection();
          },
          execution > 250 ? 0 : 250
        );
      });
  }

  renderSectionFromCache(url, event) {
    this.beforeRenderSection();

    setTimeout(() => {
      const responseText = this.cachedMap.get(url);
      this.renderFilters(responseText, event);
      this.renderFiltersActive(responseText);
      this.renderProductGridContainer(responseText, event);
      this.renderProductCount(responseText);
      this.renderSortBy(responseText);
      this.renderSortByMobile(responseText);

      FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.facetUpdate, { responseText: responseText });

      this.afterRenderSection();
    }, 250);
  }

  renderFilters(responseText, event) {
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
    const facetElements = parsedHTML.querySelectorAll(
      '#FacetFiltersContainer [data-filter], #MobileFacetFiltersContainer [data-filter]'
    );
    const jsFilter = event ? event.target.closest('[data-filter]') : undefined;

    const matchesIndex = (element) => {
      return jsFilter ? element.dataset.index === jsFilter.dataset.index : false;
    };
    const facetsToRender = Array.from(facetElements).filter((element) => !matchesIndex(element));

    facetsToRender.forEach((element) => {
      const filter = document.querySelector(`[data-filter][data-index="${element.dataset.index}"]`);
      if (filter !== null) {
        if (filter.tagName === 'DETAILS') {
          const currentSummary = filter.querySelector('summary');
          const newSummary = element.querySelector('summary');
          if (currentSummary && newSummary) {
            currentSummary.innerHTML = newSummary.innerHTML;
          }
          filter.querySelector('summary + *').innerHTML = element.querySelector('summary + *').innerHTML;
        } else {
          filter.innerHTML = element.innerHTML;
        }
      }
    });

    // Keep the actively interacted facet content intact, but refresh its summary badge/title.
    if (jsFilter && jsFilter.tagName === 'DETAILS') {
      const activeFilter = parsedHTML.querySelector(`[data-filter][data-index="${jsFilter.dataset.index}"]`);
      if (activeFilter) {
        const currentSummary = jsFilter.querySelector('summary');
        const newSummary = activeFilter.querySelector('summary');
        if (currentSummary && newSummary) {
          currentSummary.innerHTML = newSummary.innerHTML;
        }
      }
    }

    // Sync availability filter state after re-rendering
    this.syncAvailabilityFilterAfterRender();
  }

  syncAvailabilityFilterAfterRender() {
    this.syncAvailabilityCheckbox(true);
  }

  renderFiltersActive(responseText) {
    const id = 'FacetFiltersActive';
    if (document.getElementById(id) === null) return;
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id) && parsedHTML.getElementById(id).innerHTML;
  }

  renderProductGridContainer(responseText, event) {
    const id = 'ProductGridContainer';
    if (document.getElementById(id) === null) return;
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id) && parsedHTML.getElementById(id).innerHTML;

    const layoutSwitcher = document.querySelector('#ProductGridWrapper layout-switcher');
    if (layoutSwitcher) {
      layoutSwitcher.onButtonClick(
        layoutSwitcher.querySelector('button[data-layout-mode].btn--active') ||
          layoutSwitcher.querySelector('button[data-layout-mode="grid-2"]')
      );
    }

    this.keepMobileCollectionChipGridLayout(event);

    // Sort products by availability if in_stock_first parameter is present
    this.sortProductsByAvailability();
  }

  keepMobileCollectionChipGridLayout(event) {
    const isCollectionChipFilter = event && event.target && event.target.closest('.toolbar-collection-form');
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isCollectionChipFilter || !isMobile) return;

    const productGrid = document.getElementById('ProductsList');
    if (!productGrid) return;

    productGrid.classList.remove('f-grid-1-cols');
    productGrid.classList.add('f-grid-2-cols');

    const layoutSwitcher = document.querySelector('#ProductGridWrapper layout-switcher');
    if (!layoutSwitcher) return;

    layoutSwitcher.querySelectorAll('button[data-layout-mode]').forEach((button) => {
      button.classList.toggle('btn--active', button.dataset.layoutMode === 'grid-2');
    });
  }

  /**
   * Sorts products to show in-stock products first
   */
  sortProductsByAvailability() {
    const url = new URL(window.location.href);
    const inStockFirst = url.searchParams.get('in_stock_first');
    
    if (!inStockFirst) return;

    const productGrid = document.getElementById('ProductsList');
    if (!productGrid) return;

    const productCards = Array.from(productGrid.querySelectorAll('.card'));
    if (productCards.length === 0) return;

    // Sort products: in-stock first, then out-of-stock
    productCards.sort((a, b) => {
      const aAvailable = this.isProductAvailable(a);
      const bAvailable = this.isProductAvailable(b);
      
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });

    // Re-append sorted products
    productCards.forEach(card => {
      productGrid.appendChild(card);
    });
  }

  /**
   * Checks if a product card represents an available product
   * @param {HTMLElement} productCard - The product card element
   * @returns {boolean} - True if the product is available
   */
  isProductAvailable(productCard) {
    // Check for sold-out indicators
    const soldOutBadge = productCard.querySelector('.f-badge--sold-out');
    const soldOutText = productCard.querySelector('.text-sold-out');
    const disabledButton = productCard.querySelector('button[disabled]');
    
    // Check if add to cart button is disabled due to unavailability
    const addToCartButton = productCard.querySelector('.product-form__submit');
    const isButtonDisabled = addToCartButton && addToCartButton.disabled;
    
    // Check for "Sold out" text in various locations
    const hasSoldOutText = productCard.textContent.toLowerCase().includes('sold out') ||
                          productCard.textContent.toLowerCase().includes('out of stock');
    
    // Product is available if none of the sold-out indicators are present
    return !soldOutBadge && !soldOutText && !disabledButton && !isButtonDisabled && !hasSoldOutText;
  }

  renderProductCount(responseText) {
    const id = 'ProductCount';
    if (document.getElementById(id) === null) return;
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id) && parsedHTML.getElementById(id).innerHTML;
  }

  renderSortBy(responseText) {
    const id = 'SortByContainer';
    if (document.getElementById(id) === null) return;
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id) && parsedHTML.getElementById(id).innerHTML;
  }

  renderSortByMobile(responseText) {
    const id = 'SortByContainerMobile';
    if (document.getElementById(id) === null) return;
    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');

    document.getElementById(id).innerHTML = parsedHTML.getElementById(id) && parsedHTML.getElementById(id).innerHTML;
  }
}
customElements.define('facet-form', FacetForm, { extends: 'form' });

class FacetRemove extends HTMLAnchorElement {
  constructor() {
    super();
    this.addEventListener('click', this.onClick);
  }

  onClick(event) {
    const form = this.closest('form[is="facet-form"]') || document.querySelector('form[is="facet-form"]');

    if (form) {
      event.preventDefault();

      const url = new URL(this.href);
      url.searchParams.set('section_id', FoxTheme.utils.getSectionId(form));
      
      // Handle availability filter logic after removing a filter
      form.handleAvailabilityFilter(url);
      
      form.renderSection(url.toString(), event);
    }
  }
}

customElements.define('facet-remove', FacetRemove, { extends: 'a' });

class FacetCount extends HTMLElement {
  constructor() {
    super();
  }

  facetUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.facetUpdateUnsubscriber = FoxTheme.pubsub.subscribe(
      FoxTheme.pubsub.PUB_SUB_EVENTS.facetUpdate,
      this.onFacetUpdate.bind(this)
    );
  }

  disconnectedCallback() {
    if (this.facetUpdateUnsubscriber) {
      this.facetUpdateUnsubscriber();
    }
  }

  get itemCount() {
    return parseInt(this.innerText.replace(/\D/g, ''));
  }

  onFacetUpdate(event) {
    const parsedHTML = new DOMParser().parseFromString(event.responseText, 'text/html');
    const facetCount = parsedHTML.querySelector('facet-count');
    this.innerText = facetCount && facetCount.innerHTML;
    this.hidden = this.itemCount === 0;
  }
}
customElements.define('facet-count', FacetCount);

class LoadMoreButton extends HTMLButtonElement {
  constructor() {
    super();
    this.onClickHandler = this.onClick.bind(this);
  }

  connectedCallback() {
    this.addEventListener('click', this.onClickHandler);

    if (this.getAttribute('type') == 'infinite') {
      FoxTheme.Motion.inView(this, this.onClickHandler, { margin: '200px 0px 200px 0px' });
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClickHandler);
  }

  onClick() {
    if (this.classList.contains('btn--loading')) return;
    this.loadingState();

    const url = this.setUrl().toString();

    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        this.renderPagination(responseText);
        this.renderProductGridContainer(responseText);
      });
  }

  renderPagination(responseText) {
    const productGridContainer = document.getElementById('ProductGridContainer');
    if (productGridContainer === null) return;

    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
    const pagination = productGridContainer.querySelector('.pagination');
    const source = parsedHTML.querySelector('.pagination');

    if (source) {
      pagination.innerHTML = source.innerHTML;
    } else {
      pagination.remove();
    }
  }

  renderProductGridContainer(responseText) {
    const productGridContainer = document.getElementById('ProductGridContainer');
    if (productGridContainer === null) return;

    const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
    const productList = productGridContainer.querySelector('.products-list');
    const gridList = productGridContainer.querySelector('grid-list');
    const source = parsedHTML.querySelector('.products-list');

    if (source && productList) {
      source.querySelectorAll('.card').forEach((item) => {
        productList.appendChild(item);
      });

      gridList && gridList.reload();
      
      // Apply availability sorting if needed
      this.sortNewProductsByAvailability();
      
       // Notify Clickpost EDD to update newly loaded product cards (no duplicate API call)
      try {
        document.dispatchEvent(new CustomEvent('clickpost-edd:cards-added'));
      } catch (e) {}
    }
  }

  setUrl() {
    const url = new URL(this.getAttribute('action'));
    url.searchParams.set('section_id', FoxTheme.utils.getSectionId(this));
    return url;
  }

  loadingState() {
    this.classList.add('pointer-events-none');
    this.classList.add('btn--loading');
  }
}

customElements.define('load-more-button', LoadMoreButton, { extends: 'button' });

class LayoutSwitcher extends HTMLElement {
  constructor() {
    super();
    this.cookieName = 'sleektheme:collection-layout';

    this.initLayoutMode();
    this.buttons.forEach((button) => {
      button.addEventListener('click', this.onButtonClick.bind(this));
    });
  }

  get buttons() {
    return this.querySelectorAll('button');
  }

  onButtonClick(event) {
    const target = event.target ? event.target.closest('button[data-layout-mode]') : event;
    if (!target || !target.dataset.layoutMode) return;

    this.changeLayout(target, target.dataset.layoutMode);
  }

  initLayoutMode() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      const target =
        this.querySelector('button[data-layout-mode].btn--active') || this.querySelector('button[data-layout-mode="grid-2"]');

      if (target) {
        this.changeLayout(target, target.dataset.layoutMode);
      }

      return;
    }

    if (FoxTheme.config.hasLocalStorage) {
      const layoutMode = window.localStorage.getItem(this.cookieName);

      if (layoutMode !== null) {
        const target = this.querySelector(`button[data-layout-mode="${layoutMode}"]`);

        if (target) {
          this.changeLayout(target, layoutMode);
        }
      }
    }
  }

  changeLayout(target, layoutMode) {
    const productGrid = document.getElementById('ProductsList');
    if (!productGrid || !target || !layoutMode) return;
    const removedClass = ['f-grid-1-cols', 'f-grid-2-cols'];
    removedClass.forEach((removed) => {
      productGrid.classList.remove(removed);
    });

    let addedClass = '';
    switch (layoutMode) {
      case 'grid-1':
        addedClass = 'f-grid-1-cols';
        break;
      case 'grid-2':
        addedClass = 'f-grid-2-cols';
        break;
    }
    productGrid.classList.add(addedClass);
    this.buttons.forEach((button) => {
      button.classList.remove('btn--active');
    });

    target.classList.add('btn--active');

    if (FoxTheme.config.hasLocalStorage) {
      window.localStorage.setItem(this.cookieName, layoutMode);
    }
  }
}

customElements.define('layout-switcher', LayoutSwitcher);

/* =====================================================
   MOBILE TWO-PANEL FILTER PANEL  (< 768px)
   ===================================================== */
class MobileFilterPanel {
  constructor(container) {
    this.container = container;
    this.categoryItems = container.querySelectorAll('.mobile-filter__category-item');
    this.valuePanels   = container.querySelectorAll('.mobile-filter__values-panel');
    // this.resetBtn      = container.querySelector('#MobileFilterReset');
    this.applyBtn      = container.querySelector('#MobileFilterApply');
    this.applyCount    = container.querySelector('#MobileFilterApplyCount');
    this.closeBtns     = container.querySelectorAll('.mobile-filter__close-btn');
    this.form          = container.querySelector('.mobile-filter__form');

    this._bindEvents();
    this._updateApplyCount();
  }

  _bindEvents() {
    // Category tab switching
    this.categoryItems.forEach((item) => {
      item.addEventListener('click', () => this._switchCategory(item));
    });

    // Reset all filters
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this._resetFilters());
    }

    // Apply filters (submit form, close drawer)
    if (this.applyBtn) {
      this.applyBtn.addEventListener('click', () => this._applyFilters());
    }

    // Close drawer without applying
    this.closeBtns.forEach((btn) => {
      btn.addEventListener('click', () => this._closeDrawer());
    });

    // Update counter live when checkboxes change
    if (this.form) {
      this.form.addEventListener('change', () => this._updateApplyCount());
    }
  }

  _switchCategory(clickedItem) {
    const index = clickedItem.dataset.filterIndex;

    // Update active category
    this.categoryItems.forEach((item) => item.classList.remove('is-active'));
    clickedItem.classList.add('is-active');

    // Show matching values panel
    this.valuePanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panelIndex === index);
    });
  }

  _resetFilters() {
    if (!this.form) return;
    // Uncheck all checkboxes
    this.form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
    // Clear number inputs (price range)
    this.form.querySelectorAll('input[type="number"]').forEach((inp) => {
      inp.value = '';
    });
    this._updateApplyCount();
    this._updateCategoryBadges();
  }

  _applyFilters() {
    if (!this.form) return;
    // Mark dirty and submit via the FacetForm custom element
    this.form.dirty = true;
    this.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    this._closeDrawer();
  }

  _closeDrawer() {
    const drawer = document.getElementById('FacetDrawer');
    if (drawer) {
      // FoxTheme drawer component closes when hidden attribute is set
      // or by triggering the toggle button
      const overlay = drawer.querySelector('.fixed-overlay');
      if (overlay) overlay.click();
    }
  }

  _updateApplyCount() {
    if (!this.form || !this.applyCount) return;
    const checkedCount = this.form.querySelectorAll('input[type="checkbox"]:checked').length;
    this.applyCount.textContent = checkedCount > 0 ? `${checkedCount} Filters` : 'Filters';
    this._updateCategoryBadges();
  }

  _updateCategoryBadges() {
    // Refresh the badge count on each category item based on checked checkboxes
    this.valuePanels.forEach((panel, i) => {
      const categoryItem = this.categoryItems[i];
      if (!categoryItem) return;
      const checkedInPanel = panel.querySelectorAll('input[type="checkbox"]:checked').length;
      let badge = categoryItem.querySelector('.mobile-filter__category-badge');
      if (checkedInPanel > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'mobile-filter__category-badge';
          categoryItem.appendChild(badge);
        }
        badge.textContent = checkedInPanel;
      } else {
        if (badge) badge.remove();
      }
    });
  }
}

// Initialise mobile filter panel when drawer opens / DOM is ready
function initMobileFilterPanel() {
  const container = document.getElementById('MobileFacetFiltersContainer');
  if (container && !container._mobileFilterInit) {
    container._mobileFilterInit = new MobileFilterPanel(container);
  }
}

document.addEventListener('DOMContentLoaded', initMobileFilterPanel);

// Re-init after facet AJAX re-render
document.addEventListener('collection:rerendered', () => {
  const container = document.getElementById('MobileFacetFiltersContainer');
  if (container) {
    container._mobileFilterInit = null; // reset so it re-inits
    initMobileFilterPanel();
  }
});

// Also init when drawer opens (some themes fire a custom event)
document.addEventListener('drawer:open', initMobileFilterPanel);


document.addEventListener("click", function (e) {

  const trigger = e.target.closest(".custom-sort__trigger");
  const option = e.target.closest(".custom-sort__option");
  const sort = e.target.closest(".custom-sort");

  if (option && sort) {
    e.preventDefault();
    const nativeSelect = sort.querySelector('.custom-sort__native');
    if (nativeSelect) {
      nativeSelect.value = option.dataset.value;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // for change in dropdown selected option
    const selectedOption = sort.querySelector('.selected-option');
    if (selectedOption) {
      selectedOption.textContent = option.dataset.label || option.textContent.trim();
    }

    sort.querySelectorAll('.custom-sort__option').forEach((item) => item.classList.remove('active'));
    option.classList.add('active');

    sort.querySelector(".custom-sort__dropdown")?.classList.remove("active");
    sort.classList.remove("is-open");
    return;
  }

  if (trigger && sort) {
    sort.querySelector(".custom-sort__dropdown")
        .classList.toggle("active");

    sort.classList.toggle("is-open"); // only for caret rotation
  }

  document.querySelectorAll(".custom-sort").forEach(item => {
    if (!item.contains(e.target)) {
      item.querySelector(".custom-sort__dropdown")
          ?.classList.remove("active");
      item.classList.remove("is-open");
    }
  });

});

function syncToolbarCollectionChips() {
  const forms = document.querySelectorAll('.toolbar-collection-form');
  if (!forms.length) return;

  forms.forEach((form) => {
    const inputs = form.querySelectorAll('.toolbar-collection-input');

    const applyStateFromInputs = () => {
      inputs.forEach((input) => {
        const chip = form.querySelector(`label[for="${input.id}"]`);
        if (!chip) return;

        chip.classList.toggle('is-active', input.checked);
        chip.classList.toggle('is-disabled', input.disabled);
      });
    };

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);

      inputs.forEach((input) => {
        const selectedValues = params.getAll(input.name);
        input.checked = selectedValues.includes(input.value);
      });

      applyStateFromInputs();
    };

    if (!form._toolbarChipBound) {
      form.addEventListener('change', applyStateFromInputs);
      form._toolbarChipBound = true;
    }

    syncFromUrl();
  });
}

document.addEventListener('DOMContentLoaded', syncToolbarCollectionChips);
document.addEventListener('collection:rerendered', syncToolbarCollectionChips);

// for mobile sort bottom sheet
document.addEventListener("click", function (e) {

  const openBtn = e.target.closest("[data-open-mobile-sort]");
  const closeBtn = e.target.closest("[data-close-mobile-sort]");
  const sortOption = e.target.closest(".mobile-sort__option");
  const sheet = document.getElementById("MobileSortSheet");

  if (!sheet) return;

  if (sortOption) {
    e.preventDefault();

    const form = document.querySelector('form[is="facet-form"]');
    if (!form) return;

    const sortValue = sortOption.dataset.value;
    if (!sortValue) return;

    const url = new URL(window.location.href);
    url.searchParams.set('sort_by', sortValue);
    url.searchParams.delete('page');
    url.searchParams.set('section_id', FoxTheme.utils.getSectionId(form));

    form.handleAvailabilityFilter(url);
    form.renderSection(url.toString(), e);

    sheet.querySelectorAll('.mobile-sort__option').forEach((option) => {
      option.classList.remove('is-active');
      option.querySelector('.mobile-sort__radio-dot')?.remove();
    });

    sortOption.classList.add('is-active');
    const radio = sortOption.querySelector('.mobile-sort__radio');
    if (radio && !radio.querySelector('.mobile-sort__radio-dot')) {
      const dot = document.createElement('span');
      dot.className = 'mobile-sort__radio-dot';
      radio.appendChild(dot);
    }

    sheet.classList.remove("is-open");
    return;
  }

  if (openBtn) {
    sheet.classList.add("is-open");
  }

  if (closeBtn) {
    sheet.classList.remove("is-open");
  }

});

document.addEventListener('click', function (event) {
  const trigger = event.target.closest('[data-related-products-trigger]');
  if (!trigger) return;

  const targetId = trigger.dataset.relatedProductsTarget;
  const similarStylesSourceId = trigger.dataset.similarStylesSource;
  const relatedProductsUrl = trigger.dataset.relatedProductsUrl;
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;
  if (target.dataset.loading === 'true') return;

  if (similarStylesSourceId) {
    const source = document.getElementById(similarStylesSourceId)
      || trigger.closest('.product-card')?.querySelector('[data-similar-styles-content]');
    const isCardLayout = source?.dataset.similarStylesLayout === 'cards';

    target.classList.toggle('related-products-sheet__body--cards', isCardLayout);
    target.classList.toggle('related-products-sheet__body--similar-styles', !isCardLayout);
    target.innerHTML = source && source.innerHTML.trim()
      ? source.innerHTML
      : '<p class="text-subtext m-0">No similar styles found.</p>';
    target.dataset.loaded = similarStylesSourceId;
    return;
  }

  if (!relatedProductsUrl || target.dataset.loaded === 'true') return;

  target.dataset.loading = 'true';
  target.innerHTML = '<p class="text-subtext m-0">Loading...</p>';

  fetch(relatedProductsUrl)
    .then((response) => response.text())
    .then((html) => {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const sourceGridWrap = parsed.querySelector('.products-grid-wrap');
      if (sourceGridWrap) {
        target.innerHTML = sourceGridWrap.outerHTML;
        target.classList.add('related-products-sheet__body--cards');
        target.classList.remove('related-products-sheet__body--similar-styles');
      } else {
        target.innerHTML = '<p class="text-subtext m-0">No related products found.</p>';
      }
      target.dataset.loaded = 'true';
    })
    .catch(() => {
      target.innerHTML = '<p class="text-subtext m-0">Unable to load related products.</p>';
    })
    .finally(() => {
      delete target.dataset.loading;
    });
});

function mountRelatedProductSheetsToBody() {
  const sheets = document.querySelectorAll('modal-component.related-products-sheet[id]');
  if (!sheets.length) return;

  sheets.forEach((sheet) => {
    const existing = document.body.querySelector(
      `modal-component.related-products-sheet[id="${sheet.id}"]`
    );

    if (existing && existing !== sheet) {
      existing.remove();
    }

    if (sheet.parentElement !== document.body) {
      document.body.appendChild(sheet);
    }
  });
}


document.addEventListener('DOMContentLoaded', mountRelatedProductSheetsToBody);
document.addEventListener('collection:rerendered', mountRelatedProductSheetsToBody);

// for scroll lock if similar products sheet opens
function updateRelatedProductsScrollLock() {
  const hasOpenRelatedSheet = Boolean(
    document.querySelector(
      'modal-component.related-products-sheet[open], modal-component.related-products-sheet[active]:not([hidden])'
    )
  );

  document.documentElement.classList.toggle('related-products-sheet-lock', hasOpenRelatedSheet);
  document.body.classList.toggle('related-products-sheet-lock', hasOpenRelatedSheet);
}

function initRelatedProductsScrollLock() {
  if (document.body._relatedProductsScrollLockInit) return;
  document.body._relatedProductsScrollLockInit = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (
        target &&
        target.matches &&
        target.matches('modal-component.related-products-sheet')
      ) {
        updateRelatedProductsScrollLock();
        return;
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'active', 'hidden'],
  });

  document.addEventListener('click', () => {
    requestAnimationFrame(updateRelatedProductsScrollLock);
  });

  updateRelatedProductsScrollLock();
}

document.addEventListener('DOMContentLoaded', initRelatedProductsScrollLock);
document.addEventListener('collection:rerendered', initRelatedProductsScrollLock);

const PLP_CARD_VIEW_STORAGE_KEY = 'plp-card-view-mode';

function applyPlpCardViewMode(mode) {
  const gridContainer = document.getElementById('ProductGridContainer');
  const modeButtons = document.querySelectorAll('[data-card-view-toggle]');
  if (!gridContainer || !modeButtons.length) return;

  const normalizedMode = mode === 'image-only' ? 'image-only' : 'full-details';
  gridContainer.classList.toggle('plp-image-only-view', normalizedMode === 'image-only');

  modeButtons.forEach((button) => {
    const isActive = button.dataset.cardView === normalizedMode;
    button.classList.toggle('btn-view-toggle-active', isActive);
    if (!button.hasAttribute('data-layout-mode')) {
      button.classList.toggle('btn--active', isActive);
    }
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function initPlpCardViewToggle() {
  const gridContainer = document.getElementById('ProductGridContainer');
  const modeButtons = document.querySelectorAll('[data-card-view-toggle]');
  if (!gridContainer || !modeButtons.length) return;

  const storedMode = localStorage.getItem(PLP_CARD_VIEW_STORAGE_KEY);
  applyPlpCardViewMode(storedMode === 'image-only' ? 'image-only' : 'full-details');
}

function applyPlpGridLayoutMode(layoutMode) {
  const productGrid = document.getElementById('ProductsList');
  if (!productGrid || (layoutMode !== 'grid-1' && layoutMode !== 'grid-2')) return;

  productGrid.classList.remove('f-grid-1-cols', 'f-grid-2-cols');
  productGrid.classList.add(layoutMode === 'grid-1' ? 'f-grid-1-cols' : 'f-grid-2-cols');

  document.querySelectorAll('button[data-layout-mode]').forEach((button) => {
    button.classList.toggle('btn--active', button.dataset.layoutMode === layoutMode);
  });

  if (FoxTheme.config.hasLocalStorage) {
    window.localStorage.setItem('sleektheme:collection-layout', layoutMode);
  }
}

document.addEventListener('click', function (event) {
  const toggleButton = event.target.closest('[data-card-view-toggle]');
  if (!toggleButton) return;

  const nextMode = toggleButton.dataset.cardView;
  if (nextMode !== 'image-only' && nextMode !== 'full-details') return;

  event.preventDefault();
  applyPlpGridLayoutMode(toggleButton.dataset.layoutMode);
  applyPlpCardViewMode(nextMode);
  localStorage.setItem(PLP_CARD_VIEW_STORAGE_KEY, nextMode);
});

document.addEventListener('DOMContentLoaded', initPlpCardViewToggle);
document.addEventListener('collection:rerendered', initPlpCardViewToggle);

(function () {
  // const toolbar = document.querySelector('.collection__toolbar');
  // const wrapper = document.querySelector('.collection-items-wrapper');
  const bottomBar = document.querySelector('.sticky-filter-sort-wrapper')

  if (!bottomBar) return;

  let lastScrollY = window.scrollY;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  window.addEventListener('scroll', function () {
    if (!isMobile()) return;

    const currentScrollY = window.scrollY;

    // prevent jitter
    if (Math.abs(currentScrollY - lastScrollY) < 5) return;

    const isScrollingDown = currentScrollY > lastScrollY && currentScrollY > 50;

    if (isScrollingDown) {
      // toolbar?.classList.add('scroll-hide');
      // wrapper?.classList.add('scroll-hide');
      bottomBar?.classList.add('scroll-hide');
    } else {
      // toolbar?.classList.remove('scroll-hide');
      // wrapper?.classList.remove('scroll-hide');
      bottomBar?.classList.remove('scroll-hide');
    }

    lastScrollY = currentScrollY;
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  const openBtn = document.querySelector(".view-modal-button");
  const modalOverlay = document.getElementById("viewModalOverlay");
  const modal = document.querySelector(".view-modal");
  const closeBtn = document.getElementById("closeViewModal");

  if (!openBtn || !modalOverlay || !modal || !closeBtn) return;

  function openModal() {
    modalOverlay.classList.add("is-open");
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalOverlay.classList.remove("is-open");
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  openBtn.addEventListener("click", openModal);

  closeBtn.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal();
    }
  });
});
