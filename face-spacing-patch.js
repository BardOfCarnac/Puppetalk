// Separates the Line Face nose and mouth into distinct vertical bands.
// Loaded after the Line Face feature patches and before boot.js.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('function drawLineFaceNose') || !source.includes('function drawLineFaceMouth')) return source;

    // Nose: a little smaller, and lifted so even the longest Line Face noses
    // terminate clearly above the resting/speaking mouth.
    source = source.replace(
      "const s=hr*.70/38;",
      "const s=hr*.58/38;"
    );
    source = source.replace(
      "ctx.save();ctx.translate(-9*s,-hr*.17);ctx.scale(s,s);",
      "ctx.save();ctx.translate(-9*s,-hr*.30);ctx.scale(s,s);"
    );

    // Mouth: preserve the exact Line Face curve and opening behaviour, but give
    // it its own lower facial band so it never reads as the foot of the nose.
    source = source.replace(
      "ctx.translate(-22*scale,hr*.36-9*scale);",
      "ctx.translate(-22*scale,hr*.48-9*scale);"
    );

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
