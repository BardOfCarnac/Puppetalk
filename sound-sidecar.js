// Puppetalk isolated live voice sidecar.
// Runs after boot.js and never patches Puppetalk networking, fetch, Peer prototypes, or getUserMedia.
(() => {
  try {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
    if(mode !== 'controller' || !room || !window.Peer || !navigator.mediaDevices?.getUserMedia) return;

    const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];
    let slot = null;
    let peer = null;
    let micStream = null;
    let deafened = false;
    let retryTimer = null;
    let uiTimer = null;
    const outbound = new Map();
    const inbound = new Map();
    const audios = new Map();

    const voiceId = s => `puppetalk-voice-${room.toLowerCase()}-${s}`;

    function liveMic(){
      return !!micStream?.getAudioTracks?.().some(t=>t.readyState === 'live' && t.enabled);
    }

    function stopAudio(id){
      const audio = audios.get(id);
      if(!audio) return;
      try{ audio.pause(); }catch{}
      try{ audio.srcObject = null; }catch{}
      audio.remove?.();
      audios.delete(id);
    }

    function closeOutbound(id){
      const call = outbound.get(id);
      if(call){ try{ call.close(); }catch{} }
      outbound.delete(id);
    }

    function attachIncoming(call,stream){
      const id = call.peer;
      stopAudio(id);
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.hidden = true;
      audio.muted = deafened;
      audio.srcObject = stream;
      document.body.appendChild(audio);
      audios.set(id,audio);
      audio.play()?.catch(()=>{});
      refreshUi();
    }

    function accept(call){
      if(call?.metadata?.puppetalkSound !== 3 || String(call.metadata.room || '').toUpperCase() !== room){
        try{ call.close(); }catch{}
        return;
      }
      inbound.set(call.peer,call);
      try{ call.answer(); }catch{ try{ call.close(); }catch{} return; }
      call.on('stream',stream=>attachIncoming(call,stream));
      const done=()=>{
        if(inbound.get(call.peer)===call) inbound.delete(call.peer);
        stopAudio(call.peer);
        refreshUi();
      };
      call.on('close',done);
      call.on('error',done);
    }

    function openPeer(){
      if(slot == null || peer || !window.Peer) return;
      try{
        peer = new Peer(voiceId(slot));
        peer.on('call',accept);
        peer.on('open',()=>{
          reconcile();
          refreshUi();
        });
        peer.on('error',err=>{
          console.debug('Puppetalk voice sidecar peer error',err);
          if(err?.type === 'unavailable-id'){
            try{ peer.destroy(); }catch{}
            peer = null;
            setTimeout(openPeer,1200);
          }
          refreshUi();
        });
        peer.on('close',()=>{
          peer = null;
          outbound.clear();
          refreshUi();
        });
      }catch(err){
        console.debug('Puppetalk voice sidecar could not start peer',err);
        peer = null;
      }
    }

    function callSeat(other){
      if(!peer?.open || !liveMic() || other===slot || outbound.has(other)) return;
      let call;
      try{
        call = peer.call(voiceId(other),micStream,{metadata:{puppetalkSound:3,room,from:slot}});
      }catch(err){
        console.debug('Puppetalk voice call failed',err);
        return;
      }
      if(!call) return;
      outbound.set(other,call);
      const done=()=>{
        if(outbound.get(other)===call) outbound.delete(other);
      };
      call.on('close',done);
      call.on('error',done);
    }

    function reconcile(){
      if(!peer?.open || !liveMic()) return;
      for(let i=0;i<6;i++) callSeat(i);
    }

    async function enableVoice(){
      if(liveMic()) return;
      try{
        micStream = await navigator.mediaDevices.getUserMedia({audio:{
          echoCancellation:true,
          noiseSuppression:true,
          autoGainControl:true,
          channelCount:{ideal:1},
          latency:{ideal:.01}
        }});
        micStream.getAudioTracks().forEach(track=>track.addEventListener('ended',disableVoice,{once:true}));
        reconcile();
      }catch(err){
        console.debug('Puppetalk voice microphone unavailable',err);
        micStream = null;
      }
      refreshUi();
    }

    function disableVoice(){
      const stream = micStream;
      micStream = null;
      outbound.forEach((_,id)=>closeOutbound(id));
      try{ stream?.getTracks?.().forEach(t=>t.stop()); }catch{}
      refreshUi();
    }

    function syncWithMouthButton(){
      const button = document.querySelector('#mic');
      if(!button || button.dataset.soundSidecarBound) return;
      button.dataset.soundSidecarBound='1';
      button.addEventListener('click',()=>{
        // Let Puppetalk's own mouth-mic handler run first, then mirror its resulting state.
        setTimeout(()=>{
          const text = String(button.textContent || '').toLowerCase();
          const appMicOn = text.includes('disable') || text.includes('mute');
          if(appMicOn) enableVoice();
          else disableVoice();
        },80);
      });
    }

    function findSlot(){
      if(slot != null) return;
      const text = String(document.querySelector('#controller-status')?.textContent || '');
      for(let i=0;i<NAMES.length;i++){
        if(text.toLowerCase().includes(NAMES[i].toLowerCase())){
          slot=i;
          openPeer();
          refreshUi();
          return;
        }
      }
    }

    function installUi(){
      syncWithMouthButton();
      findSlot();
      const card=document.querySelector('.voice-card');
      if(!card) return;
      const title=card.querySelector('.control-title span:first-child');
      const note=card.querySelector('.control-title span:last-child');
      if(title) title.textContent='Voice';
      if(note) note.textContent='live audio + mouth';
      const actions=card.querySelector('.voice-actions');
      if(actions && !document.querySelector('#sidecar-deafen')){
        const b=document.createElement('button');
        b.id='sidecar-deafen';
        b.type='button';
        b.textContent='Deafen';
        b.addEventListener('click',()=>{
          deafened=!deafened;
          audios.forEach(a=>{ a.muted=deafened; if(!deafened) a.play()?.catch(()=>{}); });
          refreshUi();
        });
        actions.appendChild(b);
      }
      if(!document.querySelector('#sidecar-status')){
        const s=document.createElement('div');
        s.id='sidecar-status';
        s.className='small muted';
        s.style.marginTop='8px';
        card.appendChild(s);
      }
      refreshUi();
    }

    function refreshUi(){
      const b=document.querySelector('#sidecar-deafen');
      if(b){
        b.textContent=deafened?'Hear everyone':'Deafen';
        b.classList.toggle('active',deafened);
      }
      const s=document.querySelector('#sidecar-status');
      if(!s) return;
      if(slot==null) s.textContent='Voice waiting for table connection';
      else if(!peer?.open) s.textContent='Voice connecting…';
      else if(deafened) s.textContent='Table audio muted';
      else if(liveMic()) s.textContent=`Mic live · hearing ${audios.size}`;
      else s.textContent=`Listening · ${audios.size} voice${audios.size===1?'':'s'}`;
    }

    const observer=new MutationObserver(installUi);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    addEventListener('pointerdown',()=>{
      if(!deafened) audios.forEach(a=>a.play()?.catch(()=>{}));
    },{passive:true});
    retryTimer=setInterval(reconcile,1800);
    uiTimer=setInterval(()=>{ findSlot(); refreshUi(); },700);
    addEventListener('pagehide',()=>{
      clearInterval(retryTimer);
      clearInterval(uiTimer);
      disableVoice();
      try{ peer?.destroy(); }catch{}
    },{once:true});
    installUi();

    window.PuppetalkSoundSidecar={version:3,get slot(){return slot;},get micLive(){return liveMic();}};
  }catch(err){
    console.error('Puppetalk sound sidecar disabled',err);
  }
})();