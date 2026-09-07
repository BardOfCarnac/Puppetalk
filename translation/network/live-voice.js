(function(root){
  'use strict';

  function createStage(options={}){
    const {send}=options;
    if(typeof send!=='function') return null;
    const members=new Map();

    function safeSend(conn,payload){
      if(!conn?.open) return;
      try{send(conn,payload);}catch{}
    }
    function roster(){
      return [...members.entries()].map(([slot,member])=>({slot,peerId:member.peerId,voice:!!member.voice}));
    }
    function broadcast(){
      const payload={type:'voice-roster',peers:roster()};
      members.forEach(member=>safeSend(member.conn,payload));
    }
    function join(conn,slot){
      if(!conn?.peer) return false;
      members.set(slot,{conn,peerId:conn.peer,voice:false});
      broadcast();
      return true;
    }
    function leave(slot){
      if(!members.delete(slot)) return false;
      broadcast();
      return true;
    }
    function data(conn,slot,msg){
      const member=members.get(slot);
      if(!member || member.conn!==conn || msg?.type!=='voice-state') return false;
      const enabled=!!msg.enabled;
      if(member.voice===enabled) return true;
      member.voice=enabled;
      broadcast();
      return true;
    }

    return {join,leave,data,roster,broadcast,getMembers:()=>members};
  }

  function createController(options={}){
    const {
      documentRef=root.document,
      setTimer=(fn,ms)=>root.setTimeout?.(fn,ms),
      clearTimer=id=>root.clearTimeout?.(id),
      random=()=>Math.random(),
      logger=console
    }=options;

    const remoteAudio=new Map();
    const calls=new Map();
    let peer=null;
    let stageConn=null;
    let slot=null;
    let room='';
    let localStream=null;
    let roster=[];
    let rosterSignature='';
    let reconcileTimer=null;
    let retryBound=false;

    function safeSend(conn,payload){
      if(!conn?.open) return;
      try{conn.send(payload);}catch(error){logger.debug?.('Puppetalk voice send failed',error);}
    }
    function hasLiveMic(){
      return !!localStream?.getAudioTracks?.().some(track=>track.readyState==='live' && track.enabled!==false);
    }
    function destroyAudio(peerId){
      const audio=remoteAudio.get(peerId);
      if(!audio) return;
      try{audio.pause();}catch{}
      try{audio.srcObject=null;}catch{}
      try{audio.remove();}catch{}
      remoteAudio.delete(peerId);
    }
    function closeCall(peerId){
      const entry=calls.get(peerId);
      if(entry){
        try{entry.call.close();}catch{}
        calls.delete(peerId);
      }
      destroyAudio(peerId);
    }
    function clearCalls(){
      for(const peerId of [...calls.keys()]) closeCall(peerId);
      for(const peerId of [...remoteAudio.keys()]) destroyAudio(peerId);
    }
    function shouldInitiate(remote){
      if(!peer?.id || !remote?.peerId) return false;
      const selfVoice=hasLiveMic();
      if(!selfVoice && !remote.voice) return false;
      if(selfVoice && !remote.voice) return true;
      if(!selfVoice && remote.voice) return false;
      return peer.id.localeCompare(remote.peerId)<0;
    }
    function retryBlockedAudio(){
      for(const audio of remoteAudio.values()) if(audio.paused) audio.play?.().catch?.(()=>{});
    }
    function bindPlaybackRetry(){
      if(retryBound || !documentRef?.addEventListener) return;
      retryBound=true;
      documentRef.addEventListener('pointerdown',retryBlockedAudio,{passive:true});
    }
    function attachRemoteAudio(peerId,stream){
      destroyAudio(peerId);
      if(!documentRef?.createElement || !documentRef?.body?.appendChild) return;
      const audio=documentRef.createElement('audio');
      audio.autoplay=true;
      audio.playsInline=true;
      audio.setAttribute?.('playsinline','');
      audio.hidden=true;
      audio.srcObject=stream;
      documentRef.body.appendChild(audio);
      remoteAudio.set(peerId,audio);
      const play=audio.play?.();
      play?.catch?.(bindPlaybackRetry);
    }
    function attachCall(call,incoming){
      if(!call?.peer) return;
      const peerId=call.peer;
      const existing=calls.get(peerId);
      if(existing && existing.call!==call) closeCall(peerId);
      calls.set(peerId,{call,incoming:!!incoming});
      call.on?.('stream',stream=>attachRemoteAudio(peerId,stream));
      const finish=()=>{
        if(calls.get(peerId)?.call===call) calls.delete(peerId);
        destroyAudio(peerId);
      };
      call.on?.('close',finish);
      call.on?.('error',error=>{logger.debug?.('Puppetalk voice call error',error);finish();});
    }
    function acceptCall(call){
      if(!call?.peer) return;
      const remoteRoom=String(call.metadata?.puppetalkRoom||'');
      if(remoteRoom && room && remoteRoom!==room){
        try{call.close();}catch{}
        return;
      }
      const remote=roster.find(item=>item.peerId===call.peer);
      if(remote && shouldInitiate(remote)){
        const existing=calls.get(call.peer);
        if(existing && !existing.incoming){
          try{call.close();}catch{}
          return;
        }
      }
      try{
        if(hasLiveMic()) call.answer(localStream);
        else call.answer();
        attachCall(call,true);
      }catch(error){
        logger.debug?.('Puppetalk voice answer failed',error);
        try{call.close();}catch{}
      }
    }
    function establishCalls(){
      reconcileTimer=null;
      if(!peer?.id || peer.destroyed) return;
      const selfVoice=hasLiveMic();
      for(const remote of roster){
        if(!remote?.peerId || remote.peerId===peer.id) continue;
        if(!selfVoice && !remote.voice) continue;
        if(!shouldInitiate(remote) || calls.has(remote.peerId) || !selfVoice) continue;
        try{
          const call=peer.call(remote.peerId,localStream,{metadata:{puppetalkRoom:room,slot}});
          if(call) attachCall(call,false);
        }catch(error){logger.debug?.('Puppetalk voice call failed',error);}
      }
    }
    function scheduleReconcile(reset=false){
      if(reset) clearCalls();
      if(reconcileTimer) clearTimer(reconcileTimer);
      reconcileTimer=setTimer(establishCalls,120+Math.floor(random()*80));
    }
    function peerReady(nextPeer,nextRoom){
      clearCalls();
      if(reconcileTimer){clearTimer(reconcileTimer);reconcileTimer=null;}
      peer=nextPeer||null;
      room=String(nextRoom||'');
      stageConn=null;
      slot=null;
      roster=[];
      rosterSignature='';
      peer?.on?.('call',acceptCall);
      peer?.on?.('close',clearCalls);
    }
    function welcome(conn,nextSlot){
      stageConn=conn||null;
      slot=nextSlot;
      safeSend(stageConn,{type:'voice-state',enabled:hasLiveMic()});
    }
    function data(msg){
      if(msg?.type!=='voice-roster' || !Array.isArray(msg.peers)) return false;
      const next=msg.peers.filter(item=>item && typeof item.peerId==='string');
      const signature=JSON.stringify(next.map(item=>[item.slot,item.peerId,!!item.voice]));
      roster=next;
      if(signature!==rosterSignature){
        rosterSignature=signature;
        scheduleReconcile(true);
      }
      return true;
    }
    function setLocalStream(stream){
      localStream=stream||null;
      stream?.getAudioTracks?.().forEach(track=>track.addEventListener?.('ended',()=>{
        if(localStream===stream) clearLocalStream(stream);
      },{once:true}));
      safeSend(stageConn,{type:'voice-state',enabled:hasLiveMic()});
      scheduleReconcile(true);
    }
    function clearLocalStream(stream){
      if(stream && localStream && stream!==localStream) return false;
      localStream=null;
      safeSend(stageConn,{type:'voice-state',enabled:false});
      scheduleReconcile(true);
      return true;
    }
    function destroy(){
      clearCalls();
      if(reconcileTimer){clearTimer(reconcileTimer);reconcileTimer=null;}
      peer=null;stageConn=null;slot=null;room='';localStream=null;roster=[];rosterSignature='';
    }

    return {
      peerReady,welcome,data,setLocalStream,clearLocalStream,destroy,
      hasLiveMic,getRoster:()=>roster,getCalls:()=>calls,getRemoteAudio:()=>remoteAudio
    };
  }

  root.PuppetalkLiveVoice={createStage,createController};
})(typeof window!=='undefined'?window:globalThis);
