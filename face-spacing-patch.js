// Restores the native Line Face 100x100 layout for eyes, nose and mouth.
// DiceBear positions: eyes translate(19 33), nose translate(40 28), mouth translate(30 63).
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('function drawLineFaceNose') || !source.includes('function drawLineFaceMouth')) return source;

    // One shared scale maps the original 100x100 Line Face canvas into the puppet head.
    // Eyes originate at (19,33), so relative to the 100x100 centre they start at (-31,-17).
    source = source.replace(
      "const s=hr*1.05/62;",
      "const s=hr*2/100;"
    );
    source = source.replace(
      "ctx.save();ctx.translate(-31*s,-hr*.20-6*s);ctx.scale(s,s);",
      "ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);"
    );

    // Nose origin: (40,28) -> (-10,-22) from face centre.
    source = source.replace(
      "const s=hr*.70/38;",
      "const s=hr*2/100;"
    );
    source = source.replace(
      "ctx.save();ctx.translate(-9*s,-hr*.17);ctx.scale(s,s);",
      "ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);"
    );

    // Mouth origin: (30,63) -> (-20,+13) from face centre.
    // Keep the Puppetalk speaking deformation, but start from DiceBear's authored resting placement.
    source = source.replace(
      "const scale = hr*.85/44;",
      "const scale = hr*2/100;"
    );
    source = source.replace(
      "ctx.translate(-22*scale,hr*.36-9*scale);",
      "ctx.translate(-20*scale,13*scale);"
    );

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
