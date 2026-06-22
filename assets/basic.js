// Scroll to Similar Styles section when clicking on similar icon
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('click', function(event) {
    const relatedProductsTrigger = event.target.closest('[data-related-products-trigger][data-similar-styles-source]');
    if (relatedProductsTrigger) {
      event.preventDefault();
      event.stopPropagation();

      const sheetId = relatedProductsTrigger.getAttribute('aria-controls');
      const sheet = sheetId ? document.getElementById(sheetId) : null;
      const targetId = relatedProductsTrigger.dataset.relatedProductsTarget;
      const sourceId = relatedProductsTrigger.dataset.similarStylesSource;
      const target = targetId ? document.getElementById(targetId) : null;
      const source = (sourceId ? document.getElementById(sourceId) : null)
        || relatedProductsTrigger.closest('.product-card')?.querySelector('[data-similar-styles-content]');

      if (target) {
        const isCardLayout = source?.dataset.similarStylesLayout === 'cards';

        target.classList.toggle('related-products-sheet__body--cards', isCardLayout);
        target.classList.toggle('related-products-sheet__body--similar-styles', !isCardLayout);
        target.innerHTML = source && source.innerHTML.trim()
          ? source.innerHTML
          : '<p class="text-subtext m-0">No similar styles found.</p>';
        target.dataset.loaded = sourceId || 'similar-styles';
      }

      if (sheet) {
        if (typeof sheet.show === 'function') {
          sheet.show(relatedProductsTrigger);
        } else {
          sheet.hidden = false;
          sheet.setAttribute('open', '');
          sheet.setAttribute('active', '');
        }
      }

      return;
    }

    const similarIcon = event.target.closest('.product-card_similar_icon');

    if (similarIcon) {
      event.preventDefault();

      const targetSection = document.getElementById('similar-styles-list');

      if (targetSection) {
        // Get the element's position relative to the document
        const elementPosition = targetSection.getBoundingClientRect().top + window.pageYOffset;
        // Offset to account for fixed headers (adjust if needed)
        const offsetPosition = elementPosition - 80;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }, true);
});
