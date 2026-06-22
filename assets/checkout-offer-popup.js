/**
 * Checkout Offer Popup
 * Shows offer recommendations when user clicks checkout button
 * Intercepts both native checkout and GoKwik checkout buttons
 */

(function() {
  'use strict';

  const CheckoutOfferPopup = {
    popup: null,
    messageElement: null,
    proceedButton: null,
    closeButton: null,
    overlay: null,
    continueShoppingButton: null,
    pendingCheckoutAction: null,
    isGoKwikCheckout: false,
    originalGoKwikHandler: null,
    initialized: false,
    intercepted: false,

    config: {
      tier1CouponCode: 'B2G250',
      tier2CouponCode: 'B3G500',
      allProductsUrl: '/collections/all',
      message2Items: 'Buy 2 products and get ₹250 off.',
      message3Items: 'Buy 3 products and get ₹500 off.'
    },

    init: function() {
      this.popup = document.getElementById('checkout-offer-popup');
      if (!this.popup) {
        console.warn('Checkout Offer Popup: Popup element not found or disabled');
        return;
      }

      if (this.popup.dataset.enabled !== 'true') {
        console.log('Checkout Offer Popup: Popup is disabled');
        return;
      }

      this.loadConfigFromDataAttributes();

      this.messageElement = document.getElementById('checkout-offer-popup-message');
      this.proceedButton = document.getElementById('checkout-offer-proceed');
      this.closeButton = this.popup.querySelector('.checkout-offer-popup__close');
      this.overlay = this.popup.querySelector('.checkout-offer-popup__overlay');
      this.continueShoppingButton = document.getElementById('checkout-offer-continue-shopping');

      this.bindEvents();
      this.interceptCheckoutButtons();
      this.initialized = true;

      console.log('Checkout Offer Popup: Initialized with config:', this.config);
    },

    loadConfigFromDataAttributes: function() {
      if (!this.popup) return;

      // Get messages from data attributes (populated from theme customization settings)
      // Using getAttribute for reliable access to data attributes
      const message2Items = this.popup.getAttribute('data-message-2-items');
      const message3Items = this.popup.getAttribute('data-message-3-items');
      const tier2Coupon = this.popup.getAttribute('data-tier2-coupon');
      const continueUrl = this.popup.getAttribute('data-continue-url');

      // Override defaults with settings values if they exist
      if (message2Items) this.config.message2Items = message2Items;
      if (message3Items) this.config.message3Items = message3Items;
      if (tier2Coupon) this.config.tier2CouponCode = tier2Coupon.toUpperCase();
      if (continueUrl) this.config.allProductsUrl = continueUrl;

      console.log('Checkout Offer Popup: Loaded messages from settings:', {
        message2Items: this.config.message2Items,
        message3Items: this.config.message3Items
      });
    },

    bindEvents: function() {
      const self = this;

      if (this.proceedButton) {
        this.proceedButton.addEventListener('click', function() {
          self.handleProceedCheckout();
        });
      }

      if (this.closeButton) {
        this.closeButton.addEventListener('click', function() {
          self.dismissPopupForSession();
          self.closePopup();
        });
      }

      if (this.overlay) {
        this.overlay.addEventListener('click', function() {
          self.closePopup();
        });
      }

      if (this.continueShoppingButton) {
        this.continueShoppingButton.addEventListener('click', function() {
          self.fireMoEngageContinueShopping();
        });
      }

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && self.isPopupVisible()) {
          self.closePopup();
        }
      });
    },

    interceptCheckoutButtons: function() {
      if (this.intercepted) return;
      
      const self = this;

      // Intercept native checkout button
      const nativeCheckoutBtn = document.querySelector('.native_checkout_button, #cart-checkout-btn, button[name="checkout"]');
      if (nativeCheckoutBtn) {
        nativeCheckoutBtn.addEventListener('click', function(e) {
          self.isGoKwikCheckout = false;
          const shouldBlock = self.handleCheckoutClick(e);
          if (shouldBlock) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);
        console.log('Checkout Offer Popup: Intercepted native checkout button');
      }

      // Intercept GoKwik checkout button
      const goKwikBtn = document.querySelector('.gokwik-checkout button, .gokwik-checkout .btn');
      if (goKwikBtn) {
        // Store original handler if exists
        if (goKwikBtn.onclick) {
          this.originalGoKwikHandler = goKwikBtn.onclick;
        }
        
        // Add our interceptor
        goKwikBtn.addEventListener('click', function(e) {
          self.isGoKwikCheckout = true;
          const shouldBlock = self.handleCheckoutClick(e);
          if (shouldBlock) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);
        console.log('Checkout Offer Popup: Intercepted GoKwik checkout button');
      }

      // Intercept form submit
      const cartForm = document.querySelector('#cart, form.cart__form');
      if (cartForm) {
        cartForm.addEventListener('submit', function(e) {
          const submitter = e.submitter;
          if (submitter && (submitter.name === 'checkout' || submitter.id === 'cart-checkout-btn')) {
            self.isGoKwikCheckout = false;
            const shouldBlock = self.handleCheckoutClick(e);
            if (shouldBlock) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }, true);
      }

      this.intercepted = true;
    },

    reattachEventListeners: function() {
      console.log('Checkout Offer Popup: Re-checking event listeners after cart update');
      
      const self = this;

      // Check if native checkout button needs re-interception (new button added to DOM)
      const nativeCheckoutBtn = document.querySelector('.native_checkout_button, #cart-checkout-btn, button[name="checkout"]');
      if (nativeCheckoutBtn && !nativeCheckoutBtn._popupIntercepted) {
        nativeCheckoutBtn.addEventListener('click', function(e) {
          self.isGoKwikCheckout = false;
          const shouldBlock = self.handleCheckoutClick(e);
          if (shouldBlock) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);
        nativeCheckoutBtn._popupIntercepted = true;
        console.log('Checkout Offer Popup: Re-attached native checkout button listener');
      }

      // Check if GoKwik button needs re-interception
      const goKwikBtn = document.querySelector('.gokwik-checkout button, .gokwik-checkout .btn');
      if (goKwikBtn && !goKwikBtn._popupIntercepted) {
        if (goKwikBtn.onclick && !this.originalGoKwikHandler) {
          this.originalGoKwikHandler = goKwikBtn.onclick;
        }

        goKwikBtn.addEventListener('click', function(e) {
          self.isGoKwikCheckout = true;
          const shouldBlock = self.handleCheckoutClick(e);
          if (shouldBlock) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);
        goKwikBtn._popupIntercepted = true;
        console.log('Checkout Offer Popup: Re-attached GoKwik checkout button listener');
      }
    },

    handleCheckoutClick: function(event) {
      // Check if popup was dismissed this session
      if (this.isPopupDismissedForSession()) {
        console.log('Checkout Offer Popup: Popup was dismissed this session, allowing checkout');
        return false; // Don't block the event
      }

      const offerData = this.checkOfferEligibility();

      if (!offerData.showPopup) {
        console.log('Checkout Offer Popup: No popup needed, allowing checkout to proceed');
        return false; // Don't block the event
      }

      // Block the event and show popup
      this.pendingCheckoutAction = {
        isGoKwik: this.isGoKwikCheckout,
        originalEvent: event
      };

      this.showPopup(offerData.message);
      
      return true; // Block the event
    },

    isPopupDismissedForSession: function() {
      try {
        return sessionStorage.getItem('checkout_offer_popup_dismissed') === 'true';
      } catch (e) {
        return false;
      }
    },

    dismissPopupForSession: function() {
      try {
        sessionStorage.setItem('checkout_offer_popup_dismissed', 'true');
        console.log('Checkout Offer Popup: Popup dismissed for this session');
      } catch (e) {
        console.warn('Checkout Offer Popup: Could not save to sessionStorage');
      }
    },

    fireMoEngageContinueShopping: function() {
      try {
        const cart = this.getCartData();
        const cartTotal = cart ? (cart.total_price / 100).toFixed(2) : '0.00';
        const cartItemCount = cart ? cart.item_count : 0;
        const currentMessage = this.messageElement ? this.messageElement.textContent : '';

        const eventData = {
          'Cart Total': cartTotal,
          'Cart Item Count': cartItemCount,
          'Popup Message': currentMessage,
          'Page URL': window.location.href,
          'Timestamp': new Date().toISOString()
        };

        if (typeof Moengage !== 'undefined' && typeof Moengage.track_event === 'function') {
          Moengage.track_event('Continue Shopping', eventData);
          console.log('Checkout Offer Popup: MoEngage event fired - Continue Shopping', eventData);
        } else {
          console.log('Checkout Offer Popup: MoEngage not available, event data:', eventData);
        }
      } catch (e) {
        console.warn('Checkout Offer Popup: Error firing MoEngage event', e);
      }
    },

    checkOfferEligibility: function() {
      const cart = this.getCartData();
      const itemCount = cart ? cart.item_count : 0;

      console.log('Checkout Offer Popup: Cart item count:', itemCount);

      // If 3 or more items, don't show popup - allow checkout
      if (itemCount >= 3) {
        console.log('Checkout Offer Popup: 3+ items in cart, no popup needed');
        return {
          showPopup: false,
          message: ''
        };
      }

      // If 1 item, show message to buy 2
      if (itemCount === 1) {
        return {
          showPopup: true,
          message: this.config.message2Items
        };
      }

      // If 2 items, show message to buy 3
      if (itemCount === 2) {
        return {
          showPopup: true,
          message: this.config.message3Items
        };
      }

      // Default: no popup (empty cart or other cases)
      return {
        showPopup: false,
        message: ''
      };
    },

    getCartData: function() {
      // First priority: our cached cart data
      if (window.cartData) {
        return window.cartData;
      }

      // Second priority: CartDataManager cache
      if (window.CartDataManager) {
        const cached = window.CartDataManager.getCached ? window.CartDataManager.getCached() : window.CartDataManager.cache;
        if (cached) {
          return cached;
        }
      }

      // Third priority: Shopify global
      if (window.Shopify && window.Shopify.cart) {
        return window.Shopify.cart;
      }

      // Fallback: try to get count from DOM
      const cartHeader = document.querySelector('.cart thead th');
      if (cartHeader) {
        const match = cartHeader.textContent.match(/\((\d+)\s*Items?\)/i);
        if (match) {
          return { item_count: parseInt(match[1]), discount_applications: [] };
        }
      }

      // Last fallback: count cart rows
      const cartRows = document.querySelectorAll('cart-items tbody tr[id^="CartItem-"]');
      if (cartRows.length > 0) {
        return { item_count: cartRows.length, discount_applications: [] };
      }

      return { item_count: 0, discount_applications: [] };
    },

    showPopup: function(message) {
      if (!this.popup || !this.messageElement) return;

      this.messageElement.textContent = message;
      this.popup.style.display = 'flex';
      this.popup.setAttribute('aria-hidden', 'false');
      document.body.classList.add('checkout-popup-open');

      setTimeout(() => {
        if (this.proceedButton) {
          this.proceedButton.focus();
        }
      }, 100);

      console.log('Checkout Offer Popup: Popup shown with message:', message);
    },

    closePopup: function() {
      if (!this.popup) return;

      this.popup.style.display = 'none';
      this.popup.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('checkout-popup-open');
      this.pendingCheckoutAction = null;
      this.isGoKwikCheckout = false;

      console.log('Checkout Offer Popup: Popup closed');
    },

    isPopupVisible: function() {
      return this.popup && this.popup.style.display !== 'none';
    },

    handleProceedCheckout: function() {
      console.log('Checkout Offer Popup: User chose to proceed to checkout');

      const wasGoKwik = this.pendingCheckoutAction && this.pendingCheckoutAction.isGoKwik;

      // Close popup first
      this.popup.style.display = 'none';
      this.popup.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('checkout-popup-open');

      this.pendingCheckoutAction = null;
      this.isGoKwikCheckout = false;

      // Trigger appropriate checkout
      if (wasGoKwik) {
        this.triggerGoKwikCheckout();
      } else {
        this.triggerNativeCheckout();
      }
    },

    triggerNativeCheckout: function() {
      console.log('Checkout Offer Popup: Triggering native checkout');
      window.location.href = '/checkout';
    },

    triggerGoKwikCheckout: function() {
      console.log('Checkout Offer Popup: Triggering GoKwik checkout');

      const goKwikBtn = document.querySelector('.gokwik-checkout button, .gokwik-checkout .btn');

      // Try various GoKwik methods
      if (typeof window.onCheckoutClick === 'function') {
        console.log('Checkout Offer Popup: Using onCheckoutClick function');
        window.onCheckoutClick(goKwikBtn);
        return;
      }

      if (typeof window.gokwikCheckout === 'function') {
        console.log('Checkout Offer Popup: Using gokwikCheckout function');
        window.gokwikCheckout();
        return;
      }

      if (typeof window.GokwikCheckout !== 'undefined' && typeof window.GokwikCheckout.open === 'function') {
        console.log('Checkout Offer Popup: Using GokwikCheckout.open');
        window.GokwikCheckout.open();
        return;
      }

      if (this.originalGoKwikHandler && typeof this.originalGoKwikHandler === 'function') {
        console.log('Checkout Offer Popup: Using original GoKwik handler');
        this.originalGoKwikHandler.call(goKwikBtn, goKwikBtn);
        return;
      }

      // Fallback to native checkout
      console.log('Checkout Offer Popup: GoKwik function not found, falling back to native checkout');
      this.triggerNativeCheckout();
    },

    refreshCartData: async function() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        window.cartData = cart;
        console.log('Checkout Offer Popup: Cart data refreshed, item count:', cart.item_count);
        return cart;
      } catch (error) {
        console.error('Checkout Offer Popup: Failed to refresh cart data', error);
        return null;
      }
    }
  };

  // Initialize when DOM is ready
  function initCheckoutOfferPopup() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        CheckoutOfferPopup.init();
      });
    } else {
      CheckoutOfferPopup.init();
    }
  }

  // Only run on cart page
  if (window.location.pathname.includes('/cart')) {
    initCheckoutOfferPopup();

    // Listen for cart updates
    document.addEventListener('cart:updated', function(event) {
      console.log('Checkout Offer Popup: Cart updated event received');
      CheckoutOfferPopup.refreshCartData().then(function() {
        setTimeout(function() {
          CheckoutOfferPopup.reattachEventListeners();
        }, 100);
      });
    });

    document.addEventListener('cart:refresh', function(event) {
      console.log('Checkout Offer Popup: Cart refresh event received');
      CheckoutOfferPopup.refreshCartData().then(function() {
        setTimeout(function() {
          CheckoutOfferPopup.reattachEventListeners();
        }, 100);
      });
    });

    // Load initial cart data
    fetch('/cart.js')
      .then(function(response) { return response.json(); })
      .then(function(cart) {
        window.cartData = cart;
        console.log('Checkout Offer Popup: Initial cart data loaded, item count:', cart.item_count);
      })
      .catch(function(error) {
        console.error('Checkout Offer Popup: Failed to load initial cart data', error);
      });
  }

  // Expose globally
  window.CheckoutOfferPopup = CheckoutOfferPopup;

})();
