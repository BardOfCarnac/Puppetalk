// Puppetalk focused prop-render scale pass.
// Keeps prop artwork on the same projection scale as puppet anatomy.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if(window.PuppetalkPropRenderScale) return;

  function patch(source){
    if(typeof source !== 'string' || source.includes('PUPPETALK_PROP_RENDER_SCALE_V1')) return source;
    const needle = '  const s = Math.max(.72,scale*1.9);';
    if(!source.includes(needle)) return source;
    source = source.replace(
      needle,
      '  // PUPPETALK_PROP_RENDER_SCALE_V1\n  const s = Math.max(.52,scale);'
    );
    return source;
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };

  window.PuppetalkPropRenderScale = {version:1};
})();
