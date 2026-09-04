// Puppetalk slim visual body pass.
// Physics/collision dimensions stay unchanged; only the rendered silhouette is slimmer
// so a six-person scene keeps useful negative space on a phone.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(typeof source !== 'string' || !source.includes('function drawAnatomy(ctx,p,w,h') || source.includes('PUPPETALK_SLIM_CHARACTER_V1')) return source;

    source = source.replace(
      'function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){',
      '// PUPPETALK_SLIM_CHARACTER_V1\nfunction drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){'
    );

    source = source.replace(
      "    ctx.lineWidth = Math.max(5,(width+6)*scale);",
      "    const visualWidth = width*.68;\n    ctx.lineWidth = Math.max(4,(visualWidth+4)*scale);"
    );
    source = source.replace(
      "    ctx.lineWidth = Math.max(3,width*scale);",
      "    ctx.lineWidth = Math.max(2.5,visualWidth*scale);"
    );

    // Keep height/reach exactly as the physics rig, but give the torso less visual mass.
    source = source.replace(
      '  const tw = Math.max(20,48*scale);',
      '  const tw = Math.max(16,34.5*scale);'
    );

    // The head centre stays at the same world point; only its visible radius shrinks.
    source = source.replace(
      '  const hr = Math.max(13,26*scale);',
      '  const hr = Math.max(11,22*scale);'
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
})();
