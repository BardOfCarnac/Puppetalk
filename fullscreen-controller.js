(()=>{
  const mode=new URLSearchParams(location.search).get('mode');
  if(mode!=='controller'||window.PuppetalkFullscreenController) return;

  const QUICK_TAP_MAX_MS=180;
  const LONG_TAP_MIN_MS=235;
  const LONG_TAP_MAX_MS=410;
  const QUICK_TAP_COUNT=3;
  const QUICK_TAP_WINDOW_MS=760;
  const MAX_TRAVEL_PX=14;
  let bodyGesture=null;
  let quickTaps=[];
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
    guide.textContent='3 quick taps: closer · long tap: away';
    guide.setAttribute('aria-hidden','true');
    Object.assign(guide.style,{
      position:'fixed',left:'50%',bottom:'16px',transform:'translateX(-50%)',zIndex:'38',
      padding:'7px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:'999px',
      background:'rgba(5,6,8,.48)',backdropFilter:'blur(9px)',color:'rgba(255,255,255,.72)',
      font:'700 9px/1 system-ui,sans-serif',letterSpacing:'.08em',textTransform:'uppercase',
      pointerEvents:'none',transition:'opacity .45s ease',whiteSpace:'nowrap'
    });

    const toast=document.createElement('div');
    toast.className='depth-toast';
    toast.setAttribute('aria-hidden','true');
    Object.assign(toast.style,{
      position:'fixed',left:'50%',top:'43%',transform:'translate(-50%,-50%) scale(.94)',zIndex:'42',
      padding:'9px 13px',border:'1px solid rgba(255,255,255,.18)',borderRadius:'999px',
      background:'rgba(5,6,8,.62)',backdropFilter:'blur(12px)',color:'#fff',
      font:'800 10px/1 system-ui,sans-serif',letterSpacing:'.18em',pointerEvents:'none',opacity:'0',
      transition:'opacity .12s ease,transform .12s ease'
    });

    document.body.append(guide,toast);
    setTimeout(()=>{guide.style.opacity='.18';},5200);
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
    toast.style.opacity='1';
    toast.style.transform='translate(-50%,-50%) scale(1)';
    if(guide) guide.style.opacity='.12';
    toastTimer=setTimeout(()=>{
      toast.style.opacity='0';
      toast.style.transform='translate(-50%,-50%) scale(.94)';
    },420);
  }

  function resetQuickTaps(){ quickTaps=[]; }

  function registerQuickTap(now){
    quickTaps=quickTaps.filter(time=>now-time<=QUICK_TAP_WINDOW_MS);
    quickTaps.push(now);
    if(quickTaps.length>=QUICK_TAP_COUNT){
      resetQuickTaps();
      showToast('CLOSER');
      return;
    }
    showToast(`${quickTaps.length}/${QUICK_TAP_COUNT}`);
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
    const now=performance.now();
    const duration=now-gesture.startedAt;

    if(gesture.maxTravel>MAX_TRAVEL_PX){
      resetQuickTaps();
      return;
    }

    if(duration<=QUICK_TAP_MAX_MS){
      registerQuickTap(now);
      return;
    }

    if(duration>=LONG_TAP_MIN_MS&&duration<=LONG_TAP_MAX_MS){
      resetQuickTaps();
      showToast('AWAY');
      return;
    }

    resetQuickTaps();
  }

  document.addEventListener('pointerup',finishGesture);
  document.addEventListener('pointercancel',event=>{
    if(bodyGesture&&event.pointerId===bodyGesture.pointerId){
      bodyGesture=null;
      resetQuickTaps();
    }
  });

  const observer=new MutationObserver(()=>ensureChrome());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureChrome();

  window.PuppetalkFullscreenController={version:34};
})();
