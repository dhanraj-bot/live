if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      abortController = undefined;
      onVariantChangeUnsubscriber = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];
      cartUpdateUnsubscriber = undefined;
      constructor() {
        super();
      }
      get variantSelectors() {
        return this.querySelector('variant-selects');
      }
      get productId() {
        return this.getAttribute('data-product-id');
      }
      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }
      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }
      get productForm() {
        return this.querySelector('form[is="product-form"]');
      }
      get quantityInput() {
        return this.querySelector('quantity-input input');
      }
     showCartSuccessMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'add-to-cart-message-global';
        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = '✓';
        toast.appendChild(icon);
        const text = document.createElement('span');
        text.textContent = message;
        toast.appendChild(text);
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = '#323232';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '10000';
        toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        toast.style.transition = 'opacity 0.1s ease';
        toast.style.opacity = '0';
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = '1';
        }, 100);
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 100);
        }, 1500);
      }
        handleProductAddedEvent = () => {
          this.showCartSuccessMessage('Product has been added to your shopping cart.');
        };
      connectedCallback() {
        this.initializeProductSwapUtility();
        this.onVariantChangeUnsubscriber = FoxTheme.pubsub.subscribe(
          FoxTheme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this)
        );

        this.initQuantityHandlers();

        this.currentVariant = this.getSelectedVariant(this);
        if (this.currentVariant) {
          this.updateMedia(this.currentVariant);
        }
        if (!this.hasConnectedProductAddedListener) {
          document.addEventListener('product-ajax:added', this.handleProductAddedEvent);
          this.hasConnectedProductAddedListener = true;
        }
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber();
        this.cartUpdateUnsubscriber();
      }
      initializeProductSwapUtility() {
        this.postProcessHtmlCallbacks.push((newNode) => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
        });
      }
      
      // Helper method to hide error messages
      hideErrorMessages() {
        // Hide error message within this product-info component
        const errorMessage = this.querySelector('.product-form__error-message');
        if (errorMessage) {
          errorMessage.setAttribute('hidden', '');
        }
        
        // Also hide error messages in the product form if it exists
        const productFormErrors = this.querySelectorAll('.product-form__error-message');
        productFormErrors.forEach(error => {
          error.setAttribute('hidden', '');
        });
        
        // Hide any global error messages that might be outside this component
        const globalErrors = document.querySelectorAll('.product-form__error-message');
        globalErrors.forEach(error => {
          error.setAttribute('hidden', '');
        });
      }
      
      // Helper method to reset buttons visibility on variant change
      resetButtonsVisibility() {
        const form = this.productForm;
        if (!form) return;
        
        const addButton = form.querySelector('.product-form__submit');
        const viewBagBtn = form.querySelector('.view-bag-btn');
        
        // Show add to cart, hide view bag
        if (addButton) addButton.style.display = 'flex';
        if (viewBagBtn) viewBagBtn.style.display = 'none';

        // Sticky button reset
        const stickyAddButton = document.querySelector('.product-form__submit_sticky');
        const stickyViewBagBtn = document.querySelector('.mobile_sticky_view_bag');
        if (stickyAddButton) stickyAddButton.style.display = 'inline-flex';
        if (stickyViewBagBtn) stickyViewBagBtn.style.display = 'none';
      }

      toggleButtonLoading(loading) {
        const addButton = this.querySelector('.product-form__submit');
        const stickyButton = document.querySelector('.product-form__submit_sticky');
        
        if (loading) {
          if (addButton) addButton.classList.add('btn--loading');
          if (stickyButton) stickyButton.classList.add('btn--loading');
        } else {
          if (addButton) addButton.classList.remove('btn--loading');
          if (stickyButton) stickyButton.classList.remove('btn--loading');
        }
      }
      
      refreshAddToCartButton(variantId) {
        const sectionId = this.sectionId;
        const url = `${this.dataset.url}?variant=${variantId}&section_id=${sectionId}`;
        fetch(url)
          .then(response => response.text())
          .then((htmlText) => {
            const html = new DOMParser().parseFromString(htmlText, 'text/html');
            const newButton = html.getElementById(`ProductSubmitButton-${sectionId}`);
            if (newButton) {
              const currentButton = document.getElementById(`ProductSubmitButton-${sectionId}`);
              currentButton.replaceWith(newButton);

              // Reset buttons visibility
              this.resetButtonsVisibility();
            }
          })
          .catch(err => console.error('Error refreshing Add to Cart button:', err));
      }
      handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
        if (!this.contains(event.target)) return;
        
        // Hide error messages when variant changes
        this.hideErrorMessages();
        // Reset button visibility on variant change
        this.resetButtonsVisibility();
        this.toggleButtonLoading(true);
        
        const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;
        const viewMode = this.dataset.viewMode || 'main-product';
        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues, shouldFetchFullPage),
          targetId: target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage, viewMode)
            : this.handleUpdateProductInfo(productUrl, viewMode),
        });
      }
      handleSwapProduct(productUrl, updateFullPage, viewMode) {
        return (html) => {
          const quickView = html.querySelector('#MainProduct-quick-view__content');
          if (quickView && viewMode === 'quick-view') {
            html = quickView.content.cloneNode(true);
          }
          const selector = updateFullPage ? "product-info[id^='MainProduct']" : 'product-info';
          const variant = this.getSelectedVariant(html.querySelector(selector));
          this.updateURL(productUrl, variant?.id);
          if (updateFullPage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;
            HTMLUpdateUtility.viewTransition(
              document.querySelector('main'),
              html.querySelector('main'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
            HTMLUpdateUtility.viewTransition(
              document.getElementById('shopify-section-sticky-atc-bar'),
              html.getElementById('shopify-section-sticky-atc-bar'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
            if (!variant) {
              this.setUnavailable();
              return;
            }
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector('product-info'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }
          this.currentVariant = variant;
          
          // Hide error messages after product swap
          this.hideErrorMessages();
          // Reset buttons visibility
          this.resetButtonsVisibility();
          this.toggleButtonLoading(false);
        };
      }
      handleUpdateProductInfo(productUrl, viewMode) {
        return (html) => {
          const quickView = html.querySelector('#MainProduct-quick-view__content');
          if (quickView && viewMode === 'quick-view') {
            html = quickView.content.cloneNode(true);
          }
          const variant = this.getSelectedVariant(html);
          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateShareUrl(variant?.id);
          this.updateVariantInputs(variant?.id);
          if (!variant) {
            this.setUnavailable();
            return;
          }
          this.updateMedia(variant);
          const updateSourceFromDestination = (id, shouldHide = (source) => false) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(`#${id}-${this.dataset.section}`);
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.classList.toggle('hidden', shouldHide(source));
            }
          };
          updateSourceFromDestination('price');
          updateSourceFromDestination('Sku');
          updateSourceFromDestination('Inventory');
          updateSourceFromDestination('Badges');
          updateSourceFromDestination('PricePerItem');
          updateSourceFromDestination('Volume');
          this.updateQuantityRules(this.sectionId, this.productId, html);
          updateSourceFromDestination('QuantityRules');
          updateSourceFromDestination('VolumeNote');
          HTMLUpdateUtility.viewTransition(
            document.querySelector(`#SizeChart-${this.sectionId}`),
            html.querySelector(`#SizeChart-${this.sectionId}`),
            this.preProcessHtmlCallbacks,
            this.postProcessHtmlCallbacks
          );
          
          // Get the add button from the fetched HTML
          const addButtonUpdated = html.getElementById(`ProductSubmitButton-${this.sectionId}`);
          
          // Check if variant is available based on the button's disabled state
          const isVariantAvailable = addButtonUpdated ? !addButtonUpdated.hasAttribute('disabled') : false;
          
          // Update the current button immediately with proper state
          if (isVariantAvailable) {
            // Variant is available - enable button and show "Add to Cart"
            this.toggleAddButton(false, FoxTheme.variantStrings.addToCart);
          } else {
            // Variant is sold out - disable button and show "Out of Stock"
            this.toggleAddButton(true, FoxTheme.variantStrings.soldOut || 'Out of Stock');
          }
          
          const stickyAtcBar = document.getElementById(`shopify-section-sticky-atc-bar`);
          if (stickyAtcBar) {
            stickyAtcBar.classList.remove('hidden');
          }
          
          // Hide error messages after updating product info
          this.hideErrorMessages();
          // Reset buttons visibility only if variant is available
          if (isVariantAvailable) {
            this.resetButtonsVisibility();
          }
          
          FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.variantChange, {
            data: {
              sectionId: this.sectionId,
              html,
              variant,
            }, 
          });
           
          document.dispatchEvent(
            new CustomEvent('variant:changed', {
              detail: {
                variant: variant,
              },  
            }) 
          );
        };
      }
      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];
        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);
        if (optionValues.length) {
          params.push(`option_values=${optionValues.join(',')}`);
        }
        return `${url}?${params.join('&')}`;
      }
      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }
      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();
        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            callback(html);
          })
          .then(() => {
            // set focus to last clicked option value
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              console.log('Fetch aborted by user');
            } else {
              console.error(error);
            }
          });
      }
      updateOptionValues(html) {
        const variantSelects = html.querySelector('variant-selects');
        if (variantSelects) {
          // Store currently selected values before update
          const selectedValues = {};
          this.variantSelectors.querySelectorAll('input[type="radio"]:checked').forEach(input => {
            selectedValues[input.name] = input.value;
          });

          this.variantSelectors.querySelectorAll('select option[selected]').forEach(option => {
            const select = option.closest('select');
            if (select) selectedValues[select.name] = option.value;
          });

          // Post-process callback to restore checked/selected attributes
          const postProcessCallback = (newNode) => {
            Object.keys(selectedValues).forEach(name => {
              // Handle radio inputs
              const selectedInput = Array.from(newNode.querySelectorAll('input[type="radio"]'))
                .find(input => input.name === name && input.value === selectedValues[name]);
              if (selectedInput) {
                selectedInput.setAttribute('checked', 'checked');
              }

              // Handle select dropdowns
              const select = Array.from(newNode.querySelectorAll('select'))
                .find(sel => sel.name === name);
              if (select) {
                const option = Array.from(select.options)
                  .find(opt => opt.value === selectedValues[name]);
                if (option) {
                  option.setAttribute('selected', 'selected');
                }
              }
            });
          };

          HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks, [postProcessCallback]);
        }
      }

      updateURL(url, variantId) {
        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${variantId ? `?variant=${variantId}` : ''}`);
      }
      updateVariantInputs(variantId) {
     document
          .querySelectorAll(`#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`)
          .forEach((productForm) => {
            const input = productForm.querySelector('input[name="id"]');
            input.value = variantId ?? '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
          });
      }
      updateMedia(variant) {
        const productMedia = this.querySelector(`[id^="MediaGallery-${this.dataset.section}"]`);
        if (!productMedia) return; // Early return if productMedia is not found
        const setActiveMedia = () => {
          if (typeof productMedia.setActiveMedia === 'function') {
            productMedia.init();
            productMedia.setActiveMedia(variant);
            return true; // Indicate success
          }
          return false; // Indicate failure
        };
        if (!setActiveMedia()) {
          this.timer = setInterval(() => {
            if (setActiveMedia()) {
              clearInterval(this.timer);
            }
          }, 100);
        }
      }
      updateShareUrl(variantId) {
        if (!variantId) return;
        const shareButton = document.getElementById(`ProductShare-${this.dataset.section}`);
        if (!shareButton || !shareButton.updateUrl) return;
        shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${variantId}`);
      }
      toggleAddButton(disable = true, text, modifyClass = true) {
        const productForm = document.getElementById(`product-form-${this.dataset.section}`);
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        const addButtonText = productForm.querySelector('[name="add"] > span');
        if (!addButton) return;

        const stickyButton = document.querySelector('.product-form__submit_sticky');
        const stickyButtonText = stickyButton ? stickyButton.querySelector('span') : null;

        if (disable) {
          addButton.setAttribute('disabled', 'disabled');
          // Add visual disabled state classes
          addButton.classList.add('disabled');
          addButton.classList.add('btn--sold-out');
          if (text) addButtonText.textContent = this.decoded(text);

          if (stickyButton) {
            stickyButton.setAttribute('disabled', 'disabled');
            stickyButton.classList.add('disabled');
            if (text && stickyButtonText) stickyButtonText.textContent = this.decoded(text);
          }
        } else {
          addButton.removeAttribute('disabled');
          // Remove visual disabled state classes
          addButton.classList.remove('disabled');
          addButton.classList.remove('btn--sold-out');
          addButtonText.textContent = this.decoded(FoxTheme.variantStrings.addToCart);

          if (stickyButton) {
            stickyButton.removeAttribute('disabled');
            stickyButton.classList.remove('disabled');
            if (stickyButtonText) stickyButtonText.textContent = this.decoded(FoxTheme.variantStrings.addToCart);
          }

          // Reset button visibility when enabling
          this.resetButtonsVisibility();
          this.toggleButtonLoading(false);
        }

        if (!modifyClass) return;
      }
      decoded(text) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const decoded = tempDiv.textContent;
        return decoded;
      }
      setUnavailable() {
        this.toggleAddButton(true, FoxTheme.variantStrings.unavailable);
        const price = document.getElementById(`price-${this.dataset.section}`);
        const inventory = document.getElementById(`Inventory-${this.dataset.section}`);
        const sku = document.getElementById(`Sku-${this.dataset.section}`);
        const volumePricing = document.getElementById(`Volume-${this.dataset.section}`);
        const stickyAtcBar = document.getElementById(`shopify-section-sticky-atc-bar`);
        if (price) price.classList.add('hidden');
        if (inventory) inventory.classList.add('hidden');
        if (sku) sku.classList.add('hidden');
        if (volumePricing) volumePricing.classList.add('hidden');
        if (stickyAtcBar) stickyAtcBar.classList.add('hidden');
      }
      initQuantityHandlers() {
        if (!this.quantityInput) return;
        this.setQuantityBoundries();
        if (!this.hasAttribute('data-original-section')) {
          this.cartUpdateUnsubscriber = FoxTheme.pubsub.subscribe(
            FoxTheme.pubsub.PUB_SUB_EVENTS.cartUpdate,
            this.fetchQuantityRules.bind(this)
          );
        }
      }
      setQuantityBoundries() {
        FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.quantityBoundries, {
          data: {
            sectionId: this.sectionId,
            productId: this.productId,
          },
        });
      }
      fetchQuantityRules() {
        const currentVariantId = this.productForm?.productIdInput?.value;
        if (!currentVariantId) return;
        this.querySelector('.quantity__rules-cart')?.classList.add('btn--loading');
        fetch(`${this.getAttribute('data-url')}?variant=${currentVariantId}&section_id=${this.sectionId}`)
          .then((response) => response.text())
          .then((responseText) => {
            const parsedHTML = new DOMParser().parseFromString(responseText, 'text/html');
            this.updateQuantityRules(this.sectionId, this.productId, parsedHTML);
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {
            this.querySelector('.quantity__rules-cart')?.classList.remove('btn--loading');
          });
      }
      updateQuantityRules(sectionId, productId, parsedHTML) {
        if (!this.quantityInput) return;
        FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.quantityRules, {
          data: {
            sectionId,
            productId,
            parsedHTML,
          },
        });
        this.setQuantityBoundries();
      }
    }
  );
}