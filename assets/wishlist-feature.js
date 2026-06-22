// Handle guest wishlist login redirect
document.addEventListener('DOMContentLoaded', function() {
  const guestWishlistButtons = document.querySelectorAll('.guest-wishlist-login-btn');
  guestWishlistButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      const returnUrl = this.getAttribute('data-return-url');
      const loginUrl = this.getAttribute('href');
      // Store return URL in sessionStorage
      sessionStorage.setItem('wishlist_return_url', returnUrl);
      // Redirect to login with return_url parameter
      window.location.href = loginUrl + '?return_url=' + encodeURIComponent(returnUrl);
    });
  });
});
// Global wishlist login redirect handler
function checkWishlistRedirect() {
    const returnUrl = sessionStorage.getItem('wishlist_return_url');
    if (returnUrl) {
    // Check if user is logged in by looking for customer-specific elements
    const isLoggedIn = document.querySelector('[data-customer-logged-in="true"]') !== null ||
                        document.querySelector('.customer-logged-in') !== null ||
                        document.querySelector('[href*="/account/logout"]') !== null ||
                        window.location.pathname.includes('/account') && !window.location.pathname.includes('/login');
    if (isLoggedIn) {
        // Clear the stored URL
        sessionStorage.removeItem('wishlist_return_url');
        // Redirect to cart
        window.location.href = returnUrl;
    }
    }
}

// Check on DOM ready
document.addEventListener('DOMContentLoaded', checkWishlistRedirect);

// Also check after a delay to catch late-loading elements
setTimeout(checkWishlistRedirect, 1000);

// Check on window load
window.addEventListener('load', checkWishlistRedirect);

// Listen for URL changes (in case of SPA navigation)
let currentUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(checkWishlistRedirect, 500);
    }
}, 100);