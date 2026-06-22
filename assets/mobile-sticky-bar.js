if (!customElements.get('mobile-sticky-bar')) {
  customElements.define(
    'mobile-sticky-bar',

    class MobileStickyBar extends HTMLElement {
      constructor() {
        super();
        this.updateActiveState = this.updateActiveState.bind(this);
      }

      connectedCallback() {
        // Only initialize on mobile
        if (window.innerWidth <= 767) {
          document.body.classList.add('mobile-sticky-bar-enabled');
          this.calculateHeight();
        }

        this.links = Array.from(this.querySelectorAll('.mobile-sticky-bar__link'));
        this.bindLinkEvents();
        this.updateActiveState();
        window.addEventListener('popstate', this.updateActiveState);
      }

      disconnectedCallback() {
        window.removeEventListener('popstate', this.updateActiveState);
      }

      calculateHeight() {
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty('--mobile-sticky-bar-height', `${this.offsetHeight}px`);
        });
      }

      bindLinkEvents() {
        if (!this.links.length) return;

        this.links.forEach((link) => {
          link.addEventListener('click', () => {
            this.setActiveLink(link);
          });
        });
      }

      normalizePath(pathname) {
        if (!pathname) return '/';
        const cleanPath = pathname.replace(/\/+$/, '');
        return cleanPath || '/';
      }

      isTemplateMatch(link) {
        if (link.classList.contains('mobile-sticky-bar__home')) {
          return document.body.classList.contains('template-index');
        }
        if (link.classList.contains('mobile-sticky-bar__products')) {
          return document.body.classList.contains('template-collection');
        }
        if (link.classList.contains('mobile-sticky-bar__search')) {
          return document.body.classList.contains('template-search');
        }
        if (link.classList.contains('mobile-sticky-bar__cart')) {
          return document.body.classList.contains('template-cart');
        }

        return false;
      }

      isPathMatch(link) {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('javascript:')) return false;

        const currentPath = this.normalizePath(window.location.pathname);

        try {
          const linkPath = this.normalizePath(new URL(href, window.location.origin).pathname);

          if (linkPath === '/') return currentPath === '/';
          return currentPath === linkPath || currentPath.startsWith(`${linkPath}/`);
        } catch (e) {
          return false;
        }
      }

      setActiveLink(activeLink) {
        if (!this.links.length) return;

        this.links.forEach((link) => {
          link.classList.toggle('is-active', link === activeLink);
        });
      }

      updateActiveState() {
        if (!this.links.length) return;

        let activeLink = this.links.find((link) => link.getAttribute('aria-current') === 'page');

        if (!activeLink) {
          activeLink = this.links.find((link) => this.isTemplateMatch(link));
        }

        if (!activeLink) {
          activeLink = this.links.find((link) => this.isPathMatch(link));
        }

        this.setActiveLink(activeLink || null);
      }
    }
  );
}
