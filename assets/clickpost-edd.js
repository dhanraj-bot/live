/**
 * Clickpost EDD: PDP pincode check (cached per pincode), PLP cards (one API, ticker + observer).
 * Same pincode = same result; no duplicate API calls.
 * Delivery date: single max date only (no range). v2
 * 
 * Cutoff Time Logic:
 * - Before cutoff: Show Next Day Delivery with countdown timer (if SLA = 1)
 * - After cutoff: Hide Next Day Delivery, show only Standard Delivery with max SLA days from API
 * - Mobile widget hidden after cutoff
 */
(function () {
  'use strict';

  const CONFIG = {
    pickupPincode: '421302',
    eddApiUrl: 'https://ds.clickpost.in/api/v2/predicted_sla_api/?username=powerlook&key=b3c04d78-8c15-4fd7-944a-eeed1d9ca8f3&check_drop_pincode_validity=true',
    cutoffEnabled: window.CLICKPOST_EDD_CONFIG?.cutoffEnabled ?? true,
    cutoffTime: window.CLICKPOST_EDD_CONFIG?.cutoffTime ?? '15:00'
  };

  const PINCODE_REGEX = /^\d{6}$/;
  const CUTOFF_STORAGE_KEY = 'clickpost-edd-timer-id';
  const AUTO_FILLED_KEY = 'clickpost-edd-auto-filled';
  const GUEST_PINCODE_STORAGE_KEY = 'clickpost-edd-guest-pincode';
  const PLP_UPDATE_INTERVAL_MS = 1000;
  const PLP_DEBOUNCE_MS = 150;

  /**
   * True only when customer is logged in (theme sets RFQ_CUSTOMER.id when logged in).
   * When logged out, customer.id is null so we must not auto-fill.
   */
  function isCustomerLoggedIn() {
    try {
      if (typeof window === 'undefined' || !window.RFQ_CUSTOMER) return false;
      var id = window.RFQ_CUSTOMER.id;
      return id != null && id !== '' && (typeof id !== 'number' || !isNaN(id));
    } catch (e) {
      return false;
    }
  }

  /**
   * Get customer pincode from saved address only when logged in.
   * Uses theme's window.RFQ_CUSTOMER.default_address.zip. Does not use localStorage
   * so that after logout we never auto-fill (localStorage can persist from previous session).
   * @returns {string|null} 6-digit pincode or null
   */
  function getCustomerPincode() {
    try {
      if (!isCustomerLoggedIn()) return null;
      var zip = null;
      if (window.RFQ_CUSTOMER.default_address) {
        var z = window.RFQ_CUSTOMER.default_address.zip;
        if (z != null && typeof z === 'string') zip = z.trim();
        else if (typeof z === 'number' && !isNaN(z)) zip = String(z).trim();
      }
      if (!zip || zip.length !== 6 || !/^\d{6}$/.test(zip)) return null;
      return zip;
    } catch (e) {
      return null;
    }
  }

  function getGuestPincode() {
    try {
      if (isCustomerLoggedIn()) return null;
      var pincode = window.localStorage ? window.localStorage.getItem(GUEST_PINCODE_STORAGE_KEY) : null;
      pincode = pincode ? String(pincode).trim() : '';
      return validatePincode(pincode).valid ? pincode : null;
    } catch (e) {
      return null;
    }
  }

  function setGuestPincode(pincode) {
    try {
      if (!window.localStorage || isCustomerLoggedIn()) return;
      window.localStorage.setItem(GUEST_PINCODE_STORAGE_KEY, String(pincode || '').trim());
    } catch (e) {}
  }

  function getActivePincode() {
    return getCustomerPincode() || getGuestPincode();
  }

  /**
   * Parse cutoff time string (HH:MM) and return hours and minutes.
   * @param {string} timeStr - Time in HH:MM format (e.g., "15:00")
   * @returns {{ hours: number, minutes: number }}
   */
  function parseCutoffTime(timeStr) {
    var parts = (timeStr || '15:00').split(':');
    return {
      hours: parseInt(parts[0], 10) || 15,
      minutes: parseInt(parts[1], 10) || 0
    };
  }

  /**
   * Check if current time is before cutoff time.
   * Uses Indian Standard Time (IST) for consistency.
   * @returns {boolean} true if before cutoff, false if after
   */
  function isBeforeCutoff() {
    if (!CONFIG.cutoffEnabled) return true;
    
    var cutoff = parseCutoffTime(CONFIG.cutoffTime);
    var now = new Date();
    
    var istOffset = 5.5 * 60;
    var utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    var istMinutes = utcMinutes + istOffset;
    if (istMinutes >= 1440) istMinutes -= 1440;
    
    var cutoffMinutes = cutoff.hours * 60 + cutoff.minutes;
    return istMinutes < cutoffMinutes;
  }

  /**
   * Get remaining time until cutoff in milliseconds.
   * @returns {number} milliseconds until cutoff, or 0 if past cutoff
   */
  function getTimeUntilCutoff() {
    if (!CONFIG.cutoffEnabled) return Infinity;
    
    var cutoff = parseCutoffTime(CONFIG.cutoffTime);
    var now = new Date();
    
    var istOffset = 5.5 * 60 * 60 * 1000;
    var istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
    
    var cutoffToday = new Date(istNow);
    cutoffToday.setHours(cutoff.hours, cutoff.minutes, 0, 0);
    
    var diff = cutoffToday.getTime() - istNow.getTime();
    return diff > 0 ? diff : 0;
  }

  /**
   * Format countdown timer text with hr, min, sec labels.
   * @param {number} ms - milliseconds remaining
   * @returns {string} formatted time string (e.g., "2hr 30min 15sec" or "30min 15sec")
   */
  function formatCountdownTimer(ms) {
    if (ms <= 0) return '0min 0sec';
    
    var totalSeconds = Math.floor(ms / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return hours + 'hr ' + minutes + 'min ' + seconds + 'sec';
    }
    return minutes + 'min ' + seconds + 'sec';
  }

  /**
   * Validate Indian pincode (6 digits, valid range 100001–999999).
   * Rejects empty, non-6-digit, 000000, and out-of-range pincodes.
   * @param {string} pincode
   * @returns {{ valid: boolean, message?: string }}
   */
  function validatePincode(pincode) {
    const trimmed = String(pincode || '').trim();
    if (!trimmed) {
      return { valid: false, message: 'Please enter valid Pincode.' };
    }
    if (!PINCODE_REGEX.test(trimmed)) {
      return { valid: false, message: 'Please enter valid Pincode.' };
    }
    var num = parseInt(trimmed, 10);
    if (num < 100001 || num > 999999) {
      return { valid: false, message: 'Please enter valid Pincode.' };
    }
    return { valid: true };
  }

  /**
   * Get ordinal suffix for day (1st, 2nd, 3rd, 4th, ...).
   * @param {number} n
   * @returns {string}
   */
  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Short month name (Jan, Feb, ...).
   * @param {Date} d
   * @returns {string}
   */
  function getShortMonth(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()];
  }

  /**
   * Format Standard Delivery date: show ONLY the maximum date (max SLA days).
   * No start date, no range. Used on both PLP and PDP.
   * SLA is 100% API-driven - no manual cutoff logic applied.
   * @param {number} min - unused; kept for API compatibility
   * @param {number} max - max SLA days from API; used to compute final delivery date
   * @param {string|null} pickupDateStr - pickup date from API (optional)
   * @returns {string} e.g. "1st Mar"
   */
  function formatStandardEddText(min, max, pickupDateStr) {
    var base = pickupDateStr ? new Date(pickupDateStr) : new Date();
    base.setHours(0, 0, 0, 0);
    var maxDays = Number(max) || Number(min) || 0;
    var dateMax = new Date(base);
    dateMax.setDate(dateMax.getDate() + maxDays);
    return getOrdinal(dateMax.getDate()) + ' ' + getShortMonth(dateMax);
  }

  /** Format days range for PLP e.g. "2–5 Days". */
  function formatStandardEddDaysText(min, max) {
    var mn = Number(min) || 0;
    var mx = Number(max) || mn;
    if (mn === mx) return mn + ' Day' + (mn !== 1 ? 's' : '');
    return mn + '–' + mx + ' Days';
  }

  /**
   * Format Express delivery date: "tomorrow" for next-day delivery (SLA = 1).
   * SLA is 100% API-driven.
   * @returns {string}
   */
  function formatExpressEddText() {
    return 'tomorrow';
  }

  /** Next-day delivery: single date only (tomorrow). For PLP. SLA is API-driven. */
  function getNextDayDateOnly() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return getOrdinal(d.getDate()) + ' ' + getShortMonth(d);
  }

  /**
   * Call EDD API.
   * @param {string} dropPincode
   * @returns {Promise<{ success: boolean, standardEddText?: string, predicted_sla_min?: number, predicted_sla_max?: number, pickup_date?: string|null, source_edd_model?: string, error?: string }>}
   */
  function fetchEdd(dropPincode) {
    var options = {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify([{
        pickup_pincode: CONFIG.pickupPincode,
        drop_pincode: String(dropPincode).trim()
      }])
    };
    return fetch(CONFIG.eddApiUrl, options)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.meta || !data.meta.success) {
          var apiMessage = (data.meta && data.meta.message) ? data.meta.message : '';
          var errorMsg = 'Pincode not serviceable for delivery.';
          if (apiMessage.toLowerCase().includes('invalid drop pincode')) {
            errorMsg = 'Please enter a valid pincode.';
          } else if (apiMessage) {
            errorMsg = apiMessage;
          }
          return { success: false, error: errorMsg };
        }
        var result = data.result && data.result[0];
        if (!result) {
          return { success: false, error: 'Could not get delivery date.' };
        }
        /* Check for invalid drop pincode from API response (check_drop_pincode_validity=true) */
        if (result.drop_pincode_valid === false || (result.message && result.message.toLowerCase().includes('invalid drop pincode'))) {
          return { success: false, error: 'Please enter a valid pincode.' };
        }
        /* 
         * Invalid pincode handling: Check source_edd_model
         * Valid pincode: source_edd_model = "ClickPost EDD"
         * Invalid pincode: source_edd_model = "Uploaded SLA" or other values
         * If not "ClickPost EDD", treat as invalid pincode and show error
         */
        var sourceModel = (result.source_edd_model || '').trim();
        if (sourceModel !== 'ClickPost EDD') {
          return { success: false, error: 'Please enter a valid pincode.' };
        }
        return {
          success: true,
          predicted_sla_min: result.predicted_sla_min,
          predicted_sla_max: result.predicted_sla_max,
          pickup_date: result.pickup_date || null,
          source_edd_model: sourceModel
        };
      })
      .catch(function (err) {
        return { success: false, error: 'Unable to fetch delivery date. Please try again.' };
      });
  }

  /**
   * Fetch city/state from pincode via api.postalpincode.in (optional; API may be down).
   * If it fails, EDD API is still used and location shows "Delivery available".
   * @param {string} pincode - 6-digit pincode
   * @returns {Promise<string|null>} e.g. "Gurugram, Haryana, India" or null
   */
  function fetchCityFromPincode(pincode) {
    var pin = String(pincode || '').trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return Promise.resolve(null);
    return fetch('https://api.postalpincode.in/pincode/' + pin)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data[0]) return null;
        var first = data[0];
        if (first.Status !== 'Success' || !first.PostOffice || first.PostOffice.length === 0) return null;
        var po = first.PostOffice[0];
        var city = (po && po.District) || (po && po.Name && po.Name.split(' ')[0]) || '';
        var state = (po && po.State) || '';
        if (!city && !state) return null;
        var parts = [city, state].filter(Boolean);
        return parts.length ? parts.join(', ') + ', India' : null;
      })
      .catch(function () { return null; });
  }

  /** Fallback location text when postal API fails but EDD confirms delivery. */
  const LOCATION_FALLBACK = 'Delivery available';

  /**
   * Stop the countdown timer for a section (reset when new pincode is checked).
   * @param {Element} section
   */
  function stopTimer(section) {
    var timerId = section[CUTOFF_STORAGE_KEY];
    if (timerId != null) {
      clearInterval(timerId);
      section[CUTOFF_STORAGE_KEY] = null;
    }
  }

  /**
   * Get mobile EDD block for section (same section id).
   * @param {Element} section - .clickpost-edd section with data-clickpost-section-id
   * @returns {Element|null}
   */
  function getMobileEddBlock(section) {
    var sectionId = section.getAttribute('data-clickpost-section-id');
    if (!sectionId) return null;
    return document.querySelector('.clickpost-edd-mobile[data-clickpost-section-id="' + sectionId + '"]');
  }

  function getMobileEddWrapper(section) {
    var mobile = getMobileEddBlock(section);
    if (!mobile) return null;
    return mobile.closest('[data-clickpost-edd-mobile-wrapper]');
  }

  /**
   * Show mobile EDD block for express delivery (SLA = 1).
   * @param {Element} section
   * @param {string} deliveryText - delivery date text
   */
  function showMobileEddBlock(section, deliveryText) {
    var mobile = getMobileEddBlock(section);
    if (!mobile) return;
    var wrapper = getMobileEddWrapper(section);
    var textEl = mobile.querySelector('[data-js-timer]');
    if (textEl) textEl.textContent = deliveryText || 'Tomorrow';
    if (wrapper) wrapper.style.display = '';
    mobile.classList.add('clickpost-edd-mobile--visible');
    mobile.style.display = 'flex';
    mobile.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide mobile EDD block.
   * @param {Element} section
   */
  function hideMobileEddBlock(section) {
    var mobile = getMobileEddBlock(section);
    if (!mobile) return;
    var wrapper = getMobileEddWrapper(section);
    mobile.classList.remove('clickpost-edd-mobile--visible');
    mobile.style.display = 'none';
    mobile.setAttribute('aria-hidden', 'true');
    if (wrapper) wrapper.style.display = 'none';
  }

  /**
   * Update mobile-only EDD block (same section). Show only when Next Day (1 SLA); hide when SLA > 1.
   * @param {Element} section - .clickpost-edd section with data-clickpost-section-id
   * @param {string} expressDateText
   * @param {string} timerText
   * @param {boolean} isExpress - if true show mobile block (1 SLA day), else hide (SLA > 1 or not express)
   */
  function updateMobileEddBlock(section, expressDateText, timerText, isExpress) {
    if (!isExpress) {
      hideMobileEddBlock(section);
      return;
    }
    /* Only show if timerText is valid */
    var hasValidTimer = timerText && timerText !== '—' && timerText.trim() !== '';
    if (hasValidTimer) {
      showMobileEddBlock(section, timerText);
    }
  }

  function setLocationRowVisibility(section, show) {
    var locationRow = section.querySelector('.clickpost-edd__location-row');
    if (locationRow) locationRow.style.display = show ? 'flex' : 'none';
  }

  function setDeliveryOptionsVisibility(section, show) {
    var standardOption = section.querySelector('[data-js-standard-option]');
    var expressOption = section.querySelector('[data-js-express-option]');
    var divider = section.querySelector('[data-js-delivery-divider]');
    if (standardOption) standardOption.style.display = show ? 'flex' : 'none';
    if (expressOption) expressOption.style.display = show ? 'flex' : 'none';
    if (divider) divider.style.display = show ? 'block' : 'none';
  }

  /**
   * Show only Standard OR Express option (one at a time). Hides divider.
   * @param {Element} section
   * @param {boolean} isExpress - true = show Express with timer, false = show Standard without timer
   */
  function setSingleDeliveryOption(section, isExpress) {
    var standardOption = section.querySelector('[data-js-standard-option]');
    var expressOption = section.querySelector('[data-js-express-option]');
    var divider = section.querySelector('[data-js-delivery-divider]');
    if (standardOption) standardOption.style.display = isExpress ? 'none' : 'flex';
    if (expressOption) expressOption.style.display = isExpress ? 'flex' : 'none';
    if (divider) divider.style.display = 'none';
  }

  function setLocationText(locationEl, text, isError) {
    if (!locationEl) return;
    locationEl.textContent = text;
    locationEl.style.color = isError ? '#c00' : '';
  }

  /** PDP cache: same pincode returns same result (no duplicate API calls). */
  var pdpCache = { pincode: '', cityText: '', eddResult: null };

  function applyPdpResult(section, cityText, eddResult) {
    var locationEl = section.querySelector('[data-js-location]');
    var standardDateEl = section.querySelector('[data-js-standard-date]');
    var expressDateEl = section.querySelector('[data-js-express-date]');
    var timerEl = section.querySelector('[data-js-timer]');
    var minDays = eddResult.predicted_sla_min;
    var maxDays = eddResult.predicted_sla_max;
    
    var beforeCutoff = isBeforeCutoff();
    var isNextDayEligible = (minDays === 1 && maxDays === 1);
    var showNextDay = isNextDayEligible && beforeCutoff;

    setLocationText(locationEl, cityText, false);
    setDeliveryOptionsVisibility(section, true);
    setSingleDeliveryOption(section, showNextDay);

    if (showNextDay) {
      if (expressDateEl) expressDateEl.textContent = formatExpressEddText();
      startCutoffTimer(section, timerEl);
      updateMobileEddBlock(section, formatExpressEddText(), formatCountdownTimer(getTimeUntilCutoff()), true);
    } else {
      updateMobileEddBlock(section, null, null, false);
      if (timerEl) timerEl.style.display = 'none';
      stopTimer(section);
      
      if (standardDateEl) {
        standardDateEl.textContent = formatStandardEddText(minDays, maxDays, eddResult.pickup_date) || '—';
      }
    }
  }

  /**
   * Start countdown timer for cutoff time.
   * When timer reaches 0, switch from Next Day to Standard Delivery.
   * @param {Element} section
   * @param {Element} timerEl
   */
  function startCutoffTimer(section, timerEl) {
    stopTimer(section);
    
    if (!timerEl) return;
    
    var updateTimer = function() {
      var remaining = getTimeUntilCutoff();
      
      if (remaining <= 0) {
        stopTimer(section);
        timerEl.textContent = '00:00';
        timerEl.style.display = 'none';
        
        if (pdpCache.eddResult) {
          applyPdpResult(section, pdpCache.cityText || LOCATION_FALLBACK, pdpCache.eddResult);
        }
        return;
      }
      
      timerEl.textContent = formatCountdownTimer(remaining);
      timerEl.style.display = '';
      
      var mobile = getMobileEddBlock(section);
      if (mobile) {
        var mobileTimerEl = mobile.querySelector('[data-js-timer]');
        if (mobileTimerEl) {
          mobileTimerEl.textContent = formatCountdownTimer(remaining);
        }
      }
    };
    
    updateTimer();
    section[CUTOFF_STORAGE_KEY] = setInterval(updateTimer, 1000);
  }

  /**
   * Run check: validate pincode, then show cached result or fetch (city + EDD). Same pincode = same result.
   */
  function runCheck(section) {
    var input = section.querySelector('.clickpost-edd__input');
    var btn = section.querySelector('.clickpost-edd__check-btn');
    var locationEl = section.querySelector('[data-js-location]');
    var standardDateEl = section.querySelector('[data-js-standard-date]');
    var expressDateEl = section.querySelector('[data-js-express-date]');
    var timerEl = section.querySelector('[data-js-timer]');
    var pincode = (input && input.value) ? String(input.value).trim() : '';

    stopTimer(section);
    updateMobileEddBlock(section, null, null, false);
    if (timerEl) timerEl.textContent = '—';
    if (expressDateEl) expressDateEl.textContent = '—';
    setDeliveryOptionsVisibility(section, false);

    var validation = validatePincode(pincode);
    if (!validation.valid) {
      setLocationRowVisibility(section, true);
      setLocationText(locationEl, validation.message, true);
      if (standardDateEl) standardDateEl.textContent = '';
      return Promise.resolve({ success: false, error: validation.message });
    }

    /* Same pincode: use cache so result is consistent (no duplicate API). */
    if (pdpCache.pincode === pincode && pdpCache.eddResult) {
      setLocationRowVisibility(section, true);
      applyPdpResult(section, pdpCache.cityText || LOCATION_FALLBACK, pdpCache.eddResult);
      /* Also update card blocks from cached result */
      updateCardBlocksFromPdpResult(pdpCache.eddResult);
      return Promise.resolve({ success: true });
    }

    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    setLocationRowVisibility(section, true);
    setLocationText(locationEl, 'Checking...', false);
    var requestPincode = pincode;

    /* EDD API is source of truth: if it returns SLA, pincode is valid. Postal API (area name) is optional. */
    return Promise.all([fetchCityFromPincode(pincode), fetchEdd(pincode)]).then(function (results) {
      var cityText = results[0];
      var eddResult = results[1];
      var currentPin = (input && input.value) ? String(input.value).trim() : '';
      if (currentPin !== requestPincode) return { success: false, stale: true };

      if (!eddResult || !eddResult.success) {
        setLocationText(locationEl, (eddResult && eddResult.error) ? eddResult.error : 'Pincode not serviceable for delivery.', true);
        if (standardDateEl) standardDateEl.textContent = '';
        hideAllEddCardBlocks();
        return { success: false, error: (eddResult && eddResult.error) ? eddResult.error : 'Pincode not serviceable for delivery.' };
      }
      pdpCache.pincode = pincode;
      pdpCache.cityText = cityText || null;
      pdpCache.eddResult = eddResult;
      applyPdpResult(section, cityText || LOCATION_FALLBACK, eddResult);
      
      /* Also update card blocks (related products, recently viewed on PDP) */
      updateCardBlocksFromPdpResult(eddResult);
      return { success: true };
    }).catch(function () {
      var currentPin = (input && input.value) ? String(input.value).trim() : '';
      if (currentPin === requestPincode) {
        setLocationText(locationEl, 'Something went wrong. Please try again.', true);
      }
      return { success: false, error: 'Something went wrong. Please try again.' };
    }).finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    });
  }

  /**
   * Show PDP EDD widget.
   * @param {Element} section
   */
  function showPdpEddWidget(section) {
    if (section) section.style.display = '';
  }

  /**
   * Update card blocks (related products, recently viewed on PDP) from PDP EDD result.
   * Populates plpEddCache and applies to all card blocks on the page.
   * SLA is 100% API-driven - no cutoff logic applied.
   * @param {Object} eddResult - EDD API result
   */
  function updateCardBlocksFromPdpResult(eddResult) {
    if (!eddResult || !eddResult.success) {
      hideAllEddCardBlocks();
      return;
    }
    
    /* Populate plpEddCache so applyPlpEddCache can use it */
    plpEddCache.pincode = pdpCache.pincode;
    plpEddCache.minDays = eddResult.predicted_sla_min;
    plpEddCache.maxDays = eddResult.predicted_sla_max;
    plpEddCache.pickupDate = eddResult.pickup_date || null;
    
    showAllEddCardBlocks();
    applyPlpEddCache();
    startPlpTicker();
    
    /* Apply again after delays to catch late-loading sections (related products, recently viewed) */
    setTimeout(function() {
      showAllEddCardBlocks();
      applyPlpEddCache();
    }, 500);
    setTimeout(function() {
      showAllEddCardBlocks();
      applyPlpEddCache();
    }, 1500);
    setTimeout(function() {
      showAllEddCardBlocks();
      applyPlpEddCache();
    }, 3000);
  }

  function init() {
    var sections = document.querySelectorAll('.clickpost-edd');
    
    /* Check if logged-in user has no pincode - hide mobile EDD widget only (PDP stays visible) */
    var loggedInNoPincode = isCustomerLoggedIn() && !getCustomerPincode();
    
    sections.forEach(function (section) {
      var input = section.querySelector('.clickpost-edd__input');
      var btn = section.querySelector('.clickpost-edd__check-btn');
      
      /* Hide mobile widget if logged-in user has no pincode, but keep PDP visible */
      if (loggedInNoPincode) {
        var mobile = getMobileEddBlock(section);
        if (mobile) mobile.style.display = 'none';
      }
      
      showPdpEddWidget(section);
      setLocationRowVisibility(section, false);
      setDeliveryOptionsVisibility(section, false);
      if (btn) btn.addEventListener('click', function () { runCheck(section); });
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            runCheck(section);
          }
        });
      }

      /* Auto-fill pincode for logged-in customers, or guest pincode from the modal, and run EDD check once */
      if (input && !section[AUTO_FILLED_KEY]) {
        var activePincode = getActivePincode();
        if (activePincode && validatePincode(activePincode).valid) {
          var currentVal = (input.value || '').trim();
          if (currentVal === '') {
            input.value = activePincode;
            section[AUTO_FILLED_KEY] = true;
            runCheck(section);
          }
        }
      }
    });

    /* Collection page / all cards: update EDD on product cards for the active customer/guest pincode */
    updateCollectionCardsEdd();
  }

  /** PLP cache: raw result (one API call). SLA is 100% API-driven. */
  var plpEddCache = { pincode: null, minDays: null, maxDays: null, pickupDate: null };
  var plpTickerId = null;
  var plpObserver = null;
  var globalCardObserver = null;
  var plpDebounceTimer = null;

  /** 
   * PLP display: Show "Tomorrow" only if SLA = 1 AND before cutoff.
   * After cutoff, always show standard delivery date.
   */
  function getPlpDisplayText() {
    if (plpEddCache.minDays == null || plpEddCache.maxDays == null) return null;
    var minDays = Number(plpEddCache.minDays);
    var maxDays = Number(plpEddCache.maxDays);
    if (isNaN(minDays)) minDays = 0;
    if (isNaN(maxDays)) maxDays = minDays;
    
    var beforeCutoff = isBeforeCutoff();
    var isNextDayEligible = (minDays === 1 && maxDays === 1);
    
    if (isNextDayEligible && beforeCutoff) {
      return 'Get it by Tomorrow';
    }
    
    var datePart = formatStandardEddText(minDays, maxDays, plpEddCache.pickupDate);
    return datePart ? 'Get it by ' + datePart : null;
  }

  /** 
   * PLP icon: "tomorrow" only when next-day eligible AND before cutoff.
   * After cutoff, always show "days" type.
   */
  function getPlpDisplayType() {
    if (plpEddCache.minDays == null || plpEddCache.maxDays == null) return 'days';
    var minDays = Number(plpEddCache.minDays);
    var maxDays = Number(plpEddCache.maxDays);
    
    var beforeCutoff = isBeforeCutoff();
    var isNextDayEligible = (minDays === 1 && maxDays === 1);
    
    return (isNextDayEligible && beforeCutoff) ? 'tomorrow' : 'days';
  }

  /** Apply PLP cache to all cards; set data-edd-display for Tomorrow icon. */
  function applyPlpEddCache() {
    /* If cache not populated, try to fetch */
    if (plpEddCache.minDays == null) {
      initCardBlocksEdd();
      return;
    }
    var displayText = getPlpDisplayText();
    if (displayText == null) return;
    var displayType = getPlpDisplayType();
    var elements = document.querySelectorAll('.clickpost-edd__option_content');
    elements.forEach(function (el) {
      if (el && el.textContent !== undefined) el.textContent = displayText;
      var block = el.closest('.clickpost-edd__card-block');
      if (block) block.setAttribute('data-edd-display', displayType);
    });
  }

  function stopPlpTicker() {
    if (plpTickerId != null) {
      clearInterval(plpTickerId);
      plpTickerId = null;
    }
  }

  function startPlpTicker() {
    stopPlpTicker();
    plpTickerId = setInterval(function () {
      if (plpEddCache.minDays == null) {
        stopPlpTicker();
        return;
      }
      applyPlpEddCache();
    }, PLP_UPDATE_INTERVAL_MS);
  }

  /**
   * Observe ProductGridContainer for new cards (Load More / infinite scroll); apply EDD from cache.
   */
  function setupPlpObserver() {
    var container = document.getElementById('ProductGridContainer');
    if (!container || plpObserver) return;
    plpObserver = new MutationObserver(function (mutations) {
      var hasNewCards = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains('card')) hasNewCards = true;
          else if (node.querySelector && node.querySelector('.clickpost-edd__option_content')) hasNewCards = true;
          else if (node.querySelector && node.querySelector('.card')) hasNewCards = true;
          if (hasNewCards) break;
        }
        if (hasNewCards) break;
      }
      if (!hasNewCards) return;
      if (plpDebounceTimer) clearTimeout(plpDebounceTimer);
      plpDebounceTimer = setTimeout(function () {
        plpDebounceTimer = null;
        applyPlpEddCache();
      }, PLP_DEBOUNCE_MS);
    });
    plpObserver.observe(container, { childList: true, subtree: true });
  }

  function cleanupPlp() {
    stopPlpTicker();
    if (plpDebounceTimer) {
      clearTimeout(plpDebounceTimer);
      plpDebounceTimer = null;
    }
    if (plpObserver) {
      plpObserver.disconnect();
      plpObserver = null;
    }
    plpEddCache.pincode = null;
    plpEddCache.minDays = null;
    plpEddCache.maxDays = null;
    plpEddCache.pickupDate = null;
  }

  /**
   * Hide all EDD card blocks when logged-in user has no pincode or invalid pincode.
   */
  function hideAllEddCardBlocks() {
    var blocks = document.querySelectorAll('.clickpost-edd__card-block');
    blocks.forEach(function (block) {
      block.style.display = 'none';
      var divider = block.previousElementSibling;
      if (divider && divider.classList && divider.classList.contains('clickpost-divider')) {
        divider.style.display = 'none';
      }
    });
  }

  /**
   * Show all EDD card blocks (restore default display).
   */
  function showAllEddCardBlocks() {
    var blocks = document.querySelectorAll('.clickpost-edd__card-block');
    blocks.forEach(function (block) {
      block.style.display = '';
      var divider = block.previousElementSibling;
      if (divider && divider.classList && divider.classList.contains('clickpost-divider')) {
        divider.style.display = '';
      }
    });
  }

  /** PLP/cards: one EDD API call, cache result, show dates. SLA is 100% API-driven. */
  function updateCollectionCardsEdd() {
    var elements = document.querySelectorAll('.clickpost-edd__option_content');
    
    /* If no elements, nothing to do here (initCardBlocksEdd will handle card blocks) */
    if (elements.length === 0) {
      return;
    }
    
    /* If no valid customer/guest pincode, hide EDD blocks entirely */
    var pincode = getActivePincode();
    if (!pincode || !validatePincode(pincode).valid) {
      cleanupPlp();
      hideAllEddCardBlocks();
      return;
    }
    
    /* If cache already populated, just apply it */
    if (plpEddCache.minDays != null && plpEddCache.pincode === pincode) {
      showAllEddCardBlocks();
      applyPlpEddCache();
      startPlpTicker();
      setupPlpObserver();
      return;
    }

    fetchEdd(pincode).then(function (result) {
      if (!result || !result.success) {
        hideAllEddCardBlocks();
        return;
      }
      showAllEddCardBlocks();
      plpEddCache.pincode = pincode;
      plpEddCache.minDays = result.predicted_sla_min;
      plpEddCache.maxDays = result.predicted_sla_max;
      plpEddCache.pickupDate = result.pickup_date || null;
      applyPlpEddCache();
      startPlpTicker();
      setupPlpObserver();
      /* Also update cart page delivery text if present */
      updateCartDeliveryText(result);
    }).catch(function () {
      hideAllEddCardBlocks();
    });
  }

  /**
   * Update cart page delivery text based on EDD result.
   * Shows: "Hurray! You will get Free Delivery by [date]." or "...by Tomorrow."
   * Respects cutoff time - only shows Tomorrow if before cutoff and SLA = 1.
   * @param {Object} eddResult - EDD API result
   */
  function updateCartDeliveryText(eddResult) {
    var dynamicEl = document.querySelector('.dynamic_delivery_text');
    var staticEl = document.querySelector('.static_delivery_text');
    if (!dynamicEl) return;
    
    if (!eddResult || !eddResult.success) {
      if (dynamicEl) dynamicEl.style.display = 'none';
      if (staticEl) staticEl.style.display = '';
      return;
    }
    
    var maxDays = Number(eddResult.predicted_sla_max) || 0;
    var minDays = Number(eddResult.predicted_sla_min) || 0;
    
    var beforeCutoff = isBeforeCutoff();
    var isNextDayEligible = (minDays === 1 && maxDays === 1);
    
    var deliveryTimeText = '';
    if (isNextDayEligible && beforeCutoff) {
      deliveryTimeText = '<span class="cart-edd-days">Tomorrow.</span>';
    } else {
      var deliveryDate = new Date();
      deliveryDate.setHours(0, 0, 0, 0);
      deliveryDate.setDate(deliveryDate.getDate() + maxDays);
      var dateText = getOrdinal(deliveryDate.getDate()) + ' ' + getShortMonth(deliveryDate);
      deliveryTimeText = '<span class="cart-edd-days">' + dateText + '.</span>';
    }
    
    var html = '<span class="cart-edd-free">Free Delivery</span> by ' + deliveryTimeText;
    
    dynamicEl.innerHTML = html;
    dynamicEl.style.display = '';
    if (staticEl) staticEl.style.display = 'none';
  }

  /**
   * Initialize EDD for any page with card blocks (Homepage, PLP, Cart, PDP).
   * Fetches EDD data and populates plpEddCache for all card blocks.
   * SLA is 100% API-driven - no cutoff logic applied.
   */
  function initCardBlocksEdd() {
    var cardBlocks = document.querySelectorAll('.clickpost-edd__card-block');
    var dynamicEl = document.querySelector('.dynamic_delivery_text');
    
    /* If no card blocks and no cart delivery text, nothing to do */
    if (cardBlocks.length === 0 && !dynamicEl) return;
    
    /* If cache already populated (e.g., from PDP check), just apply it */
    if (plpEddCache.minDays != null) {
      showAllEddCardBlocks();
      applyPlpEddCache();
      if (dynamicEl) updateCartDeliveryText({ 
        success: true, 
        predicted_sla_min: plpEddCache.minDays, 
        predicted_sla_max: plpEddCache.maxDays,
        pickup_date: plpEddCache.pickupDate 
      });
      return;
    }
    
    var pincode = getActivePincode();
    if (!pincode || !validatePincode(pincode).valid) {
      hideAllEddCardBlocks();
      return;
    }
    
    fetchEdd(pincode).then(function (result) {
      if (!result || !result.success) {
        hideAllEddCardBlocks();
        if (dynamicEl) dynamicEl.style.display = 'none';
        return;
      }
      
      /* Populate cache */
      plpEddCache.pincode = pincode;
      plpEddCache.minDays = result.predicted_sla_min;
      plpEddCache.maxDays = result.predicted_sla_max;
      plpEddCache.pickupDate = result.pickup_date || null;
      
      /* Update cart delivery text if present */
      updateCartDeliveryText(result);
      
      /* Update all card blocks */
      showAllEddCardBlocks();
      applyPlpEddCache();
      startPlpTicker();
    }).catch(function () {
      hideAllEddCardBlocks();
    });
  }

  document.addEventListener('clickpost-edd:cards-added', function () {
    applyPlpEddCache();
  });

  /* Listen for recommendations:loaded event from recently-viewed-products (uses capture for non-bubbling events) */
  document.addEventListener('recommendations:loaded', function () {
    if (plpEddCache.minDays != null) {
      applyPlpEddCache();
    }
  }, true);

  /**
   * Setup global observer to watch for dynamically added product cards in any section.
   * This handles: Recently Viewed, Frequently Bought Together, Homepage sections, Product Tabs.
   */
  function setupGlobalCardObserver() {
    if (globalCardObserver) return;
    var pincode = getActivePincode();
    if (!pincode || !validatePincode(pincode).valid) return;
    
    var pendingUpdate = null;
    globalCardObserver = new MutationObserver(function (mutations) {
      var hasNewCards = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.querySelector && node.querySelector('.clickpost-edd__option_content')) {
            hasNewCards = true;
            break;
          }
          if (node.classList && node.classList.contains('clickpost-edd__card-block')) {
            hasNewCards = true;
            break;
          }
        }
        if (hasNewCards) break;
      }
      if (hasNewCards) {
        /* Debounce and apply cache if available, or fetch if not */
        if (pendingUpdate) clearTimeout(pendingUpdate);
        pendingUpdate = setTimeout(function() {
          pendingUpdate = null;
          if (plpEddCache.minDays != null) {
            showAllEddCardBlocks();
            applyPlpEddCache();
          } else {
            /* Cache not populated, trigger fetch */
            initCardBlocksEdd();
          }
        }, 100);
      }
    });
    
    globalCardObserver.observe(document.body, { childList: true, subtree: true });
  }

  function submitPincode(pincode) {
    var trimmed = String(pincode || '').trim();
    var validation = validatePincode(trimmed);
    if (!validation.valid) {
      return Promise.resolve({ success: false, error: validation.message });
    }

    if (!isCustomerLoggedIn()) {
      setGuestPincode(trimmed);
    }

    var sections = document.querySelectorAll('.clickpost-edd');
    if (sections.length > 0) {
      var checks = [];
      sections.forEach(function (section) {
        var input = section.querySelector('.clickpost-edd__input');
        if (input) input.value = trimmed;
        checks.push(runCheck(section));
      });
      return Promise.all(checks).then(function (results) {
        var success = results.some(function (result) { return result && result.success; });
        if (success) {
          setupGlobalCardObserver();
          return { success: true };
        }
        return results[0] || { success: false, error: 'Unable to fetch delivery date. Please try again.' };
      });
    }

    return fetchEdd(trimmed).then(function (result) {
      if (!result || !result.success) {
        hideAllEddCardBlocks();
        return { success: false, error: (result && result.error) ? result.error : 'Unable to fetch delivery date. Please try again.' };
      }
      pdpCache.pincode = trimmed;
      pdpCache.cityText = null;
      pdpCache.eddResult = result;
      updateCardBlocksFromPdpResult(result);
      updateCartDeliveryText(result);
      setupGlobalCardObserver();
      return { success: true };
    });
  }

  document.addEventListener('clickpost-edd:submit-pincode', function (event) {
    var detail = event.detail || {};
    submitPincode(detail.pincode).then(function (result) {
      document.dispatchEvent(new CustomEvent('clickpost-edd:pincode-result', {
        detail: {
          pincode: detail.pincode,
          result: result
        }
      }));
    });
  });

  window.ClickpostEdd = window.ClickpostEdd || {};
  window.ClickpostEdd.submitPincode = submitPincode;
  window.ClickpostEdd.getActivePincode = getActivePincode;

  // Expose applyPlpEddCache globally for dynamic sections (cart discount recommendations, etc.)
  window.applyPlpEddCache = applyPlpEddCache;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      initCardBlocksEdd();
      setupGlobalCardObserver();
    });
  } else {
    init();
    initCardBlocksEdd();
    setupGlobalCardObserver();
  }
})();
