(function(root){
  'use strict';

  function create(options={}){
    const {
      micButton,level,talkButton,input,transmit,setStatus,clamp,
      getUserMedia=constraints=>navigator.mediaDevices.getUserMedia(constraints),
      createAudioContext=()=>new AudioContext(),
      requestFrame=callback=>requestAnimationFrame(callback),
      cancelFrame=id=>cancelAnimationFrame(id),
      setTimer=(callback,ms)=>setInterval(callback,ms),
      clearTimer=id=>clearInterval(id),
      ByteArray=Uint8Array,
      logger=console
    }=options;

    if(!micButton || !level || !talkButton || !input || !transmit || !setStatus || !clamp) return null;

    let micStop=null;
    let manualTimer=null;

    async function enableMic(){
      if(micStop){
        micStop();
        micStop=null;
        micButton.textContent='Enable microphone';
        input.mouth=0;
        level.style.width='0%';
        transmit(true);
        return;
      }
      try{
        const stream=await getUserMedia({audio:true});
        const audio=createAudioContext();
        const source=audio.createMediaStreamSource(stream);
        const analyser=audio.createAnalyser();
        analyser.fftSize=512;
        analyser.smoothingTimeConstant=.45;
        source.connect(analyser);
        const data=new ByteArray(analyser.fftSize);
        let raf=0;
        let lastMouth=-1;
        let lastUpdate=0;
        const sample=now=>{
          analyser.getByteTimeDomainData(data);
          let sum=0;
          for(const value of data){
            const n=(value-128)/128;
            sum+=n*n;
          }
          const rms=Math.sqrt(sum/data.length);
          level.style.width=`${clamp(rms*540,0,100)}%`;
          let mouth=0;
          if(rms>.028) mouth=rms>.105?2:1;
          if(mouth!==lastMouth && now-lastUpdate>45){
            input.mouth=mouth;
            lastMouth=mouth;
            lastUpdate=now;
            transmit(true);
          }
          raf=requestFrame(sample);
        };
        raf=requestFrame(sample);
        micStop=()=>{
          cancelFrame(raf);
          stream.getTracks().forEach(track=>track.stop());
          audio.close();
        };
        micButton.textContent='Disable microphone';
      }catch(err){
        logger.error(err);
        setStatus('microphone unavailable','bad');
      }
    }

    function startManualTalk(event){
      event.preventDefault();
      if(manualTimer) return;
      let phase=0;
      const chatter=()=>{
        phase=(phase+1)%3;
        input.mouth=phase===0?1:phase===1?2:1;
        transmit(true);
      };
      chatter();
      manualTimer=setTimer(chatter,95);
      talkButton.classList.add('active');
    }

    function stopManualTalk(){
      if(manualTimer){
        clearTimer(manualTimer);
        manualTimer=null;
      }
      input.mouth=0;
      talkButton.classList.remove('active');
      transmit(true);
    }

    function install(){
      micButton.addEventListener('click',enableMic);
      talkButton.addEventListener('pointerdown',startManualTalk);
      talkButton.addEventListener('pointerup',stopManualTalk);
      talkButton.addEventListener('pointercancel',stopManualTalk);
      talkButton.addEventListener('pointerleave',event=>{ if(event.buttons) stopManualTalk(); });
    }

    return {enableMic,startManualTalk,stopManualTalk,install};
  }

  root.PuppetalkControllerAudio=create ? {create} : null;
})(typeof window!=='undefined'?window:globalThis);
