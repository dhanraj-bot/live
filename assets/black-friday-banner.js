/**
 * Black Friday Banner Countdown Timer
 * Handles countdown timer functionality and auto-hide on expiration
 */

class BlackFridayBanner {
  constructor(element) {
    this.banner = element;
    this.sectionId = this.banner.dataset.sectionId;
    this.endDate = this.banner.dataset.endDate;
    this.endTime = this.banner.dataset.endTime;
    this.countdown = this.banner.querySelector(`#countdown-${this.sectionId}`);
    
    if (!this.countdown) {
      console.warn('Countdown element not found');
      return;
    }

    this.elements = {
      days: this.countdown.querySelector('[data-days]'),
      hours: this.countdown.querySelector('[data-hours]'),
      minutes: this.countdown.querySelector('[data-minutes]'),
      seconds: this.countdown.querySelector('[data-seconds]')
    };

    this.storageKey = `bf-banner-${this.sectionId}-hidden`;
    this.interval = null;

    this.init();
  }

  init() {
    // Calculate end timestamp
    this.endTimestamp = this.getEndTimestamp();

    if (!this.endTimestamp || this.isExpired()) {
      this.handleExpiration();
      return;
    }

    // Start countdown
    this.startCountdown();
  }

  getEndTimestamp() {
    try {
      // Combine date and time
      const dateTimeString = `${this.endDate}T${this.endTime}`;
      const endDate = new Date(dateTimeString);

      // Validate date
      if (isNaN(endDate.getTime())) {
        console.error('Invalid date format. Use YYYY-MM-DD for date and HH:MM:SS for time.');
        return null;
      }

      return endDate.getTime();
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  }

  isExpired() {
    return Date.now() >= this.endTimestamp;
  }

  isBannerHidden() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return false;
    }
  }

  setBannerHidden() {
    try {
      localStorage.setItem(this.storageKey, 'true');
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  startCountdown() {
    // Update immediately
    this.updateCountdown();

    // Update every second
    this.interval = setInterval(() => {
      if (this.isExpired()) {
        this.handleExpiration();
      } else {
        this.updateCountdown();
      }
    }, 1000);
  }

  updateCountdown() {
    const now = Date.now();
    const distance = this.endTimestamp - now;

    if (distance < 0) {
      this.handleExpiration();
      return;
    }

    // Calculate time units
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Update DOM
    this.elements.days.textContent = this.padZero(days);
    this.elements.hours.textContent = this.padZero(hours);
    this.elements.minutes.textContent = this.padZero(minutes);
    this.elements.seconds.textContent = this.padZero(seconds);

    // Add pulse animation to seconds
    this.elements.seconds.style.animation = 'none';
    setTimeout(() => {
      this.elements.seconds.style.animation = '';
    }, 10);
  }

  padZero(num) {
    return num.toString().padStart(2, '0');
  }

  handleExpiration() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Set all values to 00
    if (this.elements.days) this.elements.days.textContent = '00';
    if (this.elements.hours) this.elements.hours.textContent = '00';
    if (this.elements.minutes) this.elements.minutes.textContent = '00';
    if (this.elements.seconds) this.elements.seconds.textContent = '00';

    // Hide banner
    this.hideBanner(true);
  }

  hideBanner(animate = true) {
    this.banner.setAttribute('data-expired', 'true');
    if (animate) {
      // Add transition class
      this.banner.style.transition = 'opacity 0.5s ease, max-height 0.5s ease, margin 0.5s ease';
      this.banner.style.opacity = '0';
      this.banner.style.maxHeight = '0';
      this.banner.style.margin = '0';
      this.banner.style.overflow = 'hidden';

      // Remove from DOM after animation
      setTimeout(() => {
        this.banner.remove();
      }, 500);
    } else {
      // Remove immediately
      this.banner.remove();
    }

    // Dispatch custom event
    this.dispatchEvent('banner:expired');
  }

  dispatchEvent(eventName) {
    const event = new CustomEvent(eventName, {
      detail: {
        sectionId: this.sectionId,
        endDate: this.endDate,
        endTime: this.endTime
      },
      bubbles: true
    });
    this.banner.dispatchEvent(event);
  }

  destroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Initialize all banners when DOM is ready
function initBlackFridayBanners() {
  const banners = document.querySelectorAll('.black-friday-banner');
  const instances = [];

  banners.forEach(banner => {
    const instance = new BlackFridayBanner(banner);
    instances.push(instance);
  });

  // Store instances globally for potential access
  window.blackFridayBannerInstances = instances;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlackFridayBanners);
} else {
  initBlackFridayBanners();
}

// Reinitialize on Shopify section events (for theme editor)
if (window.Shopify && window.Shopify.designMode) {
  document.addEventListener('shopify:section:load', function(event) {
    if (event.detail && event.detail.sectionId) {
      const banner = document.querySelector(`[data-section-id="${event.detail.sectionId}"]`);
      if (banner && banner.classList.contains('black-friday-banner')) {
        new BlackFridayBanner(banner);
      }
    }
  });

  document.addEventListener('shopify:section:unload', function(event) {
    if (window.blackFridayBannerInstances) {
      window.blackFridayBannerInstances.forEach(instance => {
        if (instance.sectionId === event.detail.sectionId) {
          instance.destroy();
        }
      });
    }
  });
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlackFridayBanner;
}

