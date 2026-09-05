// Translation-only adapter: boot.js still asks for app.js, but the translation
// entry serves the deterministic pre-composed V1 source instead of stacking
// 23 runtime fetch decorators. No app behaviour is changed here.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const sourceUrl = new URL('./translation/generated/app-preboot.js',document.baseURI);

  window.fetch = (...args) => {
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return nativeFetch(...args);
    return nativeFetch(sourceUrl.href,args[1]);
  };

  window.PuppetalkTranslationSource = Object.freeze({
    kind:'precomposed-v1',
    decorators:23,
    source:sourceUrl.href
  });
})();
