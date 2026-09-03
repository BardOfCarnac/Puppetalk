// Puppetalk voice compatibility for the composed stage connection flow.
// The prop layers expand the initial scene packet, so attach voice membership at
// the stable point immediately before the connection status update instead.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(source.includes('PUPPETALK_VOICE_STAGE_COMPAT_V1')) return source;
    if(!source.includes('window.PuppetalkVoice?.controllerPeer(peer,room);')) return source;
    if(source.includes('window.PuppetalkVoice?.stageJoin(conn,slot);')){
      return `// PUPPETALK_VOICE_STAGE_COMPAT_V1\n${source}`;
    }

    const needle = `      updateStatus();\n    });\n    conn.on('data'`;
    const replacement = `      window.PuppetalkVoice?.stageJoin(conn,slot);\n      updateStatus();\n    });\n    conn.on('data'`;
    if(!source.includes(needle)) throw new Error('Voice stage compatibility patch failed: stage open hook');
    return `// PUPPETALK_VOICE_STAGE_COMPAT_V1\n${source.replace(needle,replacement)}`;
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