// Reasserts the selected character look over the ordinary controller connection.
// The host already understands type:'look'; this makes delivery reliable without
// touching boot.js's later replacement of applyInput().
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes("const send = (conn,msg) => { if(conn?.open) conn.send(msg); };")) return source;

    source = source.replace(
      "const send = (conn,msg) => { if(conn?.open) conn.send(msg); };",
      `const PUPPETALK_LAST_LOOK_SENT = new WeakMap();
const send = (conn,msg) => {
  if(!conn?.open) return;
  conn.send(msg);
  // The normal input object already contains input.look. Mirror it as the profile
  // packet the host understands, but only when that profile actually changes.
  if(msg?.type === 'input' && msg.input?.look){
    const name = typeof savedPlayerName === 'function' ? savedPlayerName() : '';
    const profile = {type:'look',look:msg.input.look,name};
    const key = JSON.stringify(profile);
    if(PUPPETALK_LAST_LOOK_SENT.get(conn) !== key){
      PUPPETALK_LAST_LOOK_SENT.set(conn,key);
      conn.send(profile);
    }
  }
};`
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
