(() => {
  const STORAGE_KEY = 'sleektheme:recently-viewed-collections';
  const MAX_ITEMS = 20;

  const safeParseJSON = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  };

  const hasLocalStorage = () => {
    try {
      const testKey = 'sleek:test';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  };

  const normalizeCollection = (el) => {
    const id = parseInt(el.dataset.collectionId, 10);
    const handle = (el.dataset.collectionHandle || '').trim();
    const title = (el.dataset.collectionTitle || '').trim();
    const url = (el.dataset.collectionUrl || '').trim();
    const image = (el.dataset.collectionImage || '').trim();
    const aspectRatio = parseFloat(el.dataset.collectionAspectRatio || '');

    if (!handle && !Number.isFinite(id)) return null;
    if (!url) return null;

    return {
      id: Number.isFinite(id) ? id : null,
      handle: handle || null,
      title: title || handle || 'Collection',
      url,
      image: image || null,
      aspectRatio: Number.isFinite(aspectRatio) ? aspectRatio : null,
      ts: Date.now(),
    };
  };

  const upsert = (items, item) => {
    const filtered = items.filter((existing) => {
      if (item.handle && existing.handle === item.handle) return false;
      if (item.id && existing.id === item.id) return false;
      return true;
    });

    filtered.unshift(item);
    return filtered.slice(0, MAX_ITEMS);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('[data-recently-viewed-collection]');
    if (!el) return;

    if (!hasLocalStorage()) return;

    const item = normalizeCollection(el);
    if (!item) return;

    const existing = safeParseJSON(window.localStorage.getItem(STORAGE_KEY) || '[]', []);
    const items = Array.isArray(existing) ? existing : [];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(upsert(items, item)));
  });
})();

