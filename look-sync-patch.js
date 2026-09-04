// Keeps the selected character look attached to ordinary controller input packets.
// This makes the authoritative host adopt head/face choices even if a one-off look packet is missed.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('function applyInput(slot,msg)') || !source.includes('function cleanLook')) return source;

    source = source.replace(
      "    const input = msg.input || {};",
      "    const input = msg.input || {};\n    if(input.look){\n      p.look = cleanLook(input.look,slot);\n      p.color = p.look.color;\n    }"
    );

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
