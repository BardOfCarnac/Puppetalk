// Adds the lobby-selected player name to the existing character look packet.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes("const send = (conn,msg)")) return source;

    source = source.replace(
      "const send = (conn,msg) => { if(conn?.open) conn.send(msg); };",
      "const send = (conn,msg) => { if(conn?.open) conn.send(msg); };\nconst cleanPlayerName = v => String(v || '').trim().replace(/\\s+/g,' ').slice(0,24);\nfunction savedPlayerName(){ try{return cleanPlayerName(localStorage.getItem('puppetalk-name'));}catch{return '';} }"
    );

    source = source.replaceAll(
      "send(conn,{type:'look',look:input.look});",
      "send(conn,{type:'look',look:input.look,name:savedPlayerName()});"
    );

    source = source.replace(
      "conn.on('data',msg=>{ if(msg?.type==='look'){ const p=makePuppet(slot); p.look=cleanLook(msg.look,slot); p.color=p.look.color; } });",
      "conn.on('data',msg=>{ if(msg?.type==='look'){ const p=makePuppet(slot); p.look=cleanLook(msg.look,slot); p.color=p.look.color; const chosen=cleanPlayerName(msg.name); if(chosen) p.name=chosen; } });"
    );

    source = source.replace(
      "setStatus(`you are ${NAMES[slot] || msg.name}`,'live');",
      "setStatus(`you are ${savedPlayerName() || NAMES[slot] || msg.name}`,'live');"
    );

    return source;
  }

  window.fetch = async (...args) => {
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