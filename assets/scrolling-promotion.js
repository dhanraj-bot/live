if (!customElements.get('scrolling-promotion')) {
  class ScrollingPromotion extends HTMLElement {
    constructor() {
      super();
      if (FoxTheme.config.motionReduced) return;
      this.promotion = this.querySelector('.promotion');
      // Disable scroll animations - initialize immediately
      this.init();
    }
    init() {
      if (this.childElementCount === 1) {
        this.promotion.classList.add('promotion--animated');

        for (let index = 0; index < 10; index++) {
          this.clone = this.promotion.cloneNode(true);
          this.appendChild(this.clone);
        }

        // pause when out of view
        const observer = new IntersectionObserver(
          (entries, _observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.scrollingPlay();
              } else {
                this.scrollingPause();
              }
            });
          },
          { rootMargin: '0px 0px 50px 0px' }
        );

        observer.observe(this);
      }
    }

    scrollingPlay() {
      this.classList.remove('scrolling-promotion--paused');
    }

    scrollingPause() {
      this.classList.add('scrolling-promotion--paused');
    }
  }
  customElements.define('scrolling-promotion', ScrollingPromotion);
}
