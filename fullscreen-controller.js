(()=>{
  const mode = new URLSearchParams(location.search).get('mode');
  if(mode !== 'controller' || window.PuppetalkFullscreenController) return;

  const EDGE = .055;
  let bodyPointer = null;
  let ready = false;

  function ensureChrome(){
    if(ready) return true;
    const shell = document.querySelector('.controller-shell');
    const canvas = document.querySelector('#personal-canvas');
    if(!shell || !canvas) return false;

    document.body.classList.add('puppetalk-fullscreen');

    const top = document.createElement('div');
    top.className = 'depth-rim depth-rim-top';
    top.dataset.label = 'walk away';
    top.setAttribute('aria-hidden','true');

    const bottom = document.createElement('div');
    bottom.className = 'depth-rim depth-rim-bottom';
    bottom.dataset.label = 'walk closer';
    bottom.setAttribute('aria-hidden','true');

    document.body.append(top,bottom);
    ready = true;
    return true;
  }

  function clearDepthChrome(){
    bodyPointer = null;
    document.body.classList.remove('depth-body-drag','depth-edge-top','depth-edge-bottom');
  }

  function currentGrabIsBody(){
    const hint = document.querySelector('#stage-hint')?.textContent || '';
    return /\b(body|torso)\b/i.test(hint) && /holding|pulling/i.test(hint);
  }

  function updateDepthChrome(event){
    if(bodyPointer == null || event.pointerId !== bodyPointer) return;
    const y = Math.max(0,Math.min(1,event.clientY/Math.max(window.innerHeight,1)));
    document.body.classList.add('depth-body-drag');
    document.body.classList.toggle('depth-edge-top',y <= EDGE);
    document.body.classList.toggle('depth-edge-bottom',y >= 1-EDGE);
  }

  document.addEventListener('pointerdown',event=>{
    if(event.target?.id !== 'personal-canvas') return;
    queueMicrotask(()=>{
      if(!ensureChrome() || !currentGrabIsBody()) return;
      bodyPointer = event.pointerId;
      updateDepthChrome(event);
    });
  });

  document.addEventListener('pointermove',event=>{
    if(bodyPointer == null && event.target?.id === 'personal-canvas' && currentGrabIsBody()){
      bodyPointer = event.pointerId;
    }
    updateDepthChrome(event);
  });

  document.addEventListener('pointerup',event=>{
    if(event.pointerId === bodyPointer) clearDepthChrome();
  });
  document.addEventListener('pointercancel',event=>{
    if(event.pointerId === bodyPointer) clearDepthChrome();
  });

  const observer = new MutationObserver(()=>ensureChrome());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureChrome();

  window.PuppetalkFullscreenController = {version:29,edge:EDGE};
})();
