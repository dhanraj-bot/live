document.addEventListener('DOMContentLoaded', () => {

  // 1. read UTM source from URL
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source'); // "facebook", "instagram", null

  // 2. also check referrer as fallback
  const referrer = document.referrer;
  const isFacebookReferrer = referrer.includes('facebook.com') || referrer.includes('fb.com');
  const isInstagramReferrer = referrer.includes('instagram.com');

  // 3. determine source
  let source = 'default';

  if (utmSource === 'facebook' || isFacebookReferrer) {
    source = 'facebook';
  } else if (utmSource === 'instagram' || isInstagramReferrer) {
    source = 'instagram';
  }

  // 4. save to sessionStorage so it persists across pages
  if (utmSource) {
    sessionStorage.setItem('entry_source', source);
  }

  // 5. get saved source if no UTM in current URL
  const savedSource = sessionStorage.getItem('entry_source') || source;

  // 6. show correct layout
  showLayout(savedSource);

});

const showLayout = (source) => {
  // hide all layouts first
  document.querySelectorAll('[data-source]').forEach((el) => {
    el.classList.add('hidden');
  });

  // show matching layout
  const target = document.querySelector(`[data-source="${source}"]`);
  if (target) {
    target.classList.remove('hidden');
  } else {
    // fallback to default
    document.querySelector('[data-source="default"]')?.classList.remove('hidden');
  }
};