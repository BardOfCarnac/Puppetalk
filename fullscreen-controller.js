(()=>{
  const mode=new URLSearchParams(location.search).get('mode');
  if(mode!=='controller'||window.PuppetalkFullscreenController) return;

  const TAP_MAX_MS=240;
  const HOLD_MIN_MS=430;
  const MAX_TRAVEL_PX=14;
  let bodyGesture=null;
  let ready=false;
  let toastTimer=null;

  function ensureChrome(){
    if(ready) return true;
    const shell=document.querySelector('.controller-shell');
    const canvas=document.querySelector('#personal-canvas');
    if(!shell||!canvas) return false;

    document.body.classList.add('puppetalk-fullscreen');

    const guide=document.createElement('div');
    guide.className='depth-gesture-guide';
    guide.textContent='tap body: closer · hold: away';
    guide.setAttribute('aria-hidden','true');

    const toast=document.createElement('div');
    toast.className='depth-toast';
    toast.setAttribute('aria-hidden','true');

    document.body.append(guide,toast);
    setTimeout(()=>guide.classList.add('quiet'),5200);
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('resize'))));
    ready=true;
    return true;
  }

  function currentGrabIsBody(){
    const hint=document.querySelector('#stage-hint')?.textContent||'';
    return /\b(body|torso)\b/i.test(hint)&&/holding|pulling/i.test(hint);
  }

  function showToast(text){
    const toast=document.querySelector('.depth-toast');
    const guide=document.querySelector('.depth-gesture-guide');
    if(!toast) return;
    if(toastTimer) clearTimeout(toastTimer);
    toast.textContent=text;
    toast.classList.add('show');
    guide?.classList.add('quiet');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),520);
  }

  document.addEventListener('pointerdown',event=>{
    if(event.target?.id!=='personal-canvas') return;
    queueMicrotask(()=>{
      if(!ensureChrome()||!currentGrabIsBody()) return;
      bodyGesture={
        pointerId:event.pointerId,
        startedAt:performance.now(),
        startX:event.clientX,
        startY:event.clientY,
        maxTravel:0
      };
    });
  });

  document.addEventListener('pointermove',event=>{
    if(!bodyGesture||event.pointerId!==bodyGesture.pointerId) return;
    bodyGesture.maxTravel=Math.max(
      bodyGesture.maxTravel,
      Math.hypot(event.clientX-bodyGesture.startX,event.clientY-bodyGesture.startY)
    );
  });

  function finishGesture(event){
    if(!bodyGesture||event.pointerId!==bodyGesture.pointerId) return;
    const gesture=bodyGesture;
    bodyGesture=null;
    const duration=performance.now()-gesture.startedAt;
    if(gesture.maxTravel>MAX_TRAVEL_PX) return;
    if(duration<=TAP_MAX_MS) showToast('CLOSER');
    else if(duration>=HOLD_MIN_MS) showToast('AWAY');
  }

  document.addEventListener('pointerup',finishGesture);
  document.addEventListener('pointercancel',event=>{
    if(bodyGesture&&event.pointerId===bodyGesture.pointerId) bodyGesture=null;
  });

  const observer=new MutationObserver(()=>ensureChrome());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureChrome();

  window.PuppetalkFullscreenController={version:32};
})();
