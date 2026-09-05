(function(root){
  'use strict';

  function create(options={}){
    const {
      Peer,room,peerId,NAMES,input,send,savedPlayerName,
      hint,youChip,status,dot,
      setTimeoutFn=(callback,ms)=>setTimeout(callback,ms),
      clearTimeoutFn=id=>clearTimeout(id)
    }=options;
    if(!Peer || !room || !peerId || !NAMES || !input || !send || !savedPlayerName || !hint || !youChip || !status || !dot) return null;

    let peer;
    let conn;
    let slot=null;
    let scene=[];
    let propScene=[];
    let lastSent='';
    let reconnectTimer=null;
    let connectGeneration=0;
    let hooks={
      updateSpecialItemButton:()=>{},
      updateGripButtons:()=>{},
      renderPersonalScene:()=>{}
    };

    function setHooks(next={}){
      hooks={
        updateSpecialItemButton:typeof next.updateSpecialItemButton==='function'?next.updateSpecialItemButton:hooks.updateSpecialItemButton,
        updateGripButtons:typeof next.updateGripButtons==='function'?next.updateGripButtons:hooks.updateGripButtons,
        renderPersonalScene:typeof next.renderPersonalScene==='function'?next.renderPersonalScene:hooks.renderPersonalScene
      };
    }

    function setStatus(text,state=''){
      status.textContent=text;
      dot.className=`status-dot ${state}`;
    }

    function transmit(force=false){
      if(!conn?.open) return;
      const body=JSON.stringify(input);
      if(!force && body===lastSent) return;
      lastSent=body;
      send(conn,{type:'input',input});
    }

    function handleData(msg){
      if(msg?.type==='welcome'){
        slot=msg.slot;
        hooks.updateSpecialItemButton(false);
        setStatus(`you are ${savedPlayerName() || NAMES[slot] || msg.name}`,'live');
        youChip.hidden=false;
        hint.textContent='Use one or two fingers on any grab point';
        setTimeoutFn(()=>hint.classList.add('quiet'),3000);
        lastSent='';
        transmit(true);
        send(conn,{type:'look',look:input.look,name:savedPlayerName()});
      }
      if(msg?.type==='scene'){
        scene=Array.isArray(msg.puppets)?msg.puppets:[];
        propScene=Array.isArray(msg.props)?msg.props:[];
        hooks.updateGripButtons();
        hooks.renderPersonalScene();
      }
      if(msg?.type==='prop-result'){
        hint.classList.remove('quiet');
        hint.textContent=msg.message || (msg.ok?'Prop grip updated.':'Could not grip prop.');
        if(msg.ok) setTimeoutFn(()=>hint.classList.add('quiet'),1500);
      }
      if(msg?.type==='special-item-result'){
        hint.classList.remove('quiet');
        hint.textContent=msg.message || 'Special item updated.';
        if(msg.ok || msg.alreadyOut) hooks.updateSpecialItemButton(true);
        setTimeoutFn(()=>hint.classList.add('quiet'),1700);
      }
      if(msg?.type==='full'){
        setStatus('table is full','bad');
        hint.textContent='This table already has six puppeteers.';
      }
    }

    function connect(){
      const generation=++connectGeneration;
      if(reconnectTimer){ clearTimeoutFn(reconnectTimer); reconnectTimer=null; }
      if(peer && !peer.destroyed) peer.destroy();
      setStatus('connecting');
      hint.textContent='Connecting to the ensemble…';
      peer=new Peer();
      peer.on('open',()=>{
        setStatus('joining…');
        conn=peer.connect(peerId(room),{serialization:'json'});
        conn.on('data',handleData);
        const autoReconnect=()=>{
          if(generation!==connectGeneration || reconnectTimer) return;
          setStatus('reconnecting…','bad');
          reconnectTimer=setTimeoutFn(()=>{ reconnectTimer=null; connect(); },1200);
        };
        conn.on('close',autoReconnect);
        conn.on('error',autoReconnect);
      });
      peer.on('error',err=>{
        setStatus(err.type==='peer-unavailable'?'table not found':`network error: ${err.type || 'unknown'}`,'bad');
      });
    }

    return {
      setHooks,setStatus,transmit,handleData,connect,
      getPeer:()=>peer,getConn:()=>conn,getSlot:()=>slot,getScene:()=>scene,getPropScene:()=>propScene,
      getReconnectTimer:()=>reconnectTimer,getConnectGeneration:()=>connectGeneration
    };
  }

  root.PuppetalkControllerSession={create};
})(typeof window!=='undefined'?window:globalThis);
