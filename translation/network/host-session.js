(function(global){
  'use strict';

  function create({
    Peer,room,peerId,status,conns,puppets,props,NAMES,
    makePuppet,send,anatomy,propState,
    applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
    cleanLook,cleanPlayerName,removePuppet,setTimer,logError
  }){
    if(typeof Peer !== 'function' || typeof peerId !== 'function' || !status || !conns || !puppets || !props || !NAMES ||
       typeof makePuppet !== 'function' || typeof send !== 'function' || typeof anatomy !== 'function' || typeof propState !== 'function' ||
       typeof applyInput !== 'function' || typeof handlePropInput !== 'function' || typeof handleSpecialItemInput !== 'function' ||
       typeof handleJointRecovery !== 'function' || typeof cleanLook !== 'function' || typeof cleanPlayerName !== 'function' ||
       typeof removePuppet !== 'function' || typeof setTimer !== 'function' || typeof logError !== 'function') return null;

    function updateStatus(extra=''){
      const n = conns.size;
      status.textContent = `${n} puppeteer${n===1?'':'s'} connected${extra ? ' — '+extra : ''}`;
    }

    function freeSlot(){
      for(let i=0;i<6;i++) if(!conns.has(i)) return i;
      return -1;
    }

    const peer = new Peer(peerId(room));
    peer.on('open',()=>status.textContent='stage live — waiting for puppeteers');
    peer.on('connection',conn=>{
      const slot = freeSlot();
      if(slot < 0){
        conn.on('open',()=>{send(conn,{type:'full'});setTimer(()=>conn.close(),120);});
        return;
      }
      conns.set(slot,conn);
      makePuppet(slot);
      conn.on('open',()=>{
        send(conn,{type:'welcome',slot,name:NAMES[slot]});
        send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)});
        updateStatus();
      });
      conn.on('data',msg=>applyInput(slot,msg));
      conn.on('data',msg=>handlePropInput(slot,msg));
      conn.on('data',msg=>handleSpecialItemInput(slot,msg));
      conn.on('data',msg=>handleJointRecovery(slot,msg));
      conn.on('data',msg=>{ if(msg?.type==='look'){ const p=makePuppet(slot); p.look=cleanLook(msg.look,slot); p.color=p.look.color; const chosen=cleanPlayerName(msg.name); if(chosen) p.name=chosen; } });
      const goodbye = ()=>{
        if(conns.get(slot) !== conn) return;
        conns.delete(slot);
        removePuppet(slot);
        updateStatus();
      };
      conn.on('close',goodbye);
      conn.on('error',goodbye);
    });
    peer.on('error',err=>{
      logError(err);
      status.textContent = err.type === 'unavailable-id' ? 'table already in use — start another' : `network error: ${err.type || 'unknown'}`;
    });

    return {peer,updateStatus,freeSlot};
  }

  global.PuppetalkHostSession={create};
})(typeof window!=='undefined'?window:globalThis);
