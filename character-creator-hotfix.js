// Repairs escaped newlines produced by the first character-creator source decorator.
// Loaded after character-creator-patch.js and before boot.js.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if (!/app\.js(?:\?|$)/.test(target)) return response;

    let text = await response.text();

    // The creator decorator accidentally emitted three literal "\\n" sequences
    // into executable app source. Convert only those known joins to real newlines.
    text = text.replace(
      "const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];\\n\nconst LOOK_PALETTE",
      "const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];\n\nconst LOOK_PALETTE"
    );
    text = text.replace(
      '</section>\\n\\n      <section class="card compact-controls">',
      '</section>\n\n      <section class="card compact-controls">'
    );
    text = text.replace(
      "\\n  document.querySelector('#poses').addEventListener('click',event=>{",
      "\n  document.querySelector('#poses').addEventListener('click',event=>{"
    );

    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
