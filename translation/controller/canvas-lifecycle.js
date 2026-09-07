(function(root){
  'use strict';

  function create({
    canvas,stageBox,ctx,getDevicePixelRatio,addEventListenerFn,
    getInnerHeight=()=>root.innerHeight,
    setTimeoutFn=(callback,ms)=>typeof root.setTimeout==='function'?root.setTimeout(callback,ms):null,
    requestFrameFn=callback=>typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(callback):null,
    visualViewport=root.visualViewport
  }={}){
    if(!canvas || !stageBox || !ctx || typeof getDevicePixelRatio !== 'function' || typeof addEventListenerFn !== 'function') return null;

    let cw = 1;
    let ch = 1;
    let renderPersonalScene = ()=>{};

    function getDimensions(){ return {cw,ch}; }
    function setRender(fn){ renderPersonalScene = typeof fn === 'function' ? fn : ()=>{}; }
    function resizeCanvas(){
      const rect = stageBox.getBoundingClientRect();
      cw = Math.max(280,rect.width);
      const measuredHeight = rect.height || getInnerHeight() || 0;
      ch = Math.max(320,measuredHeight);
      const dpr = Math.min(getDevicePixelRatio() || 1,2);
      canvas.width = Math.round(cw*dpr);
      canvas.height = Math.round(ch*dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      stageBox.style.minHeight = `${ch}px`;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      renderPersonalScene();
    }
    function settleProjection(){ resizeCanvas(); }
    function start(){
      addEventListenerFn('resize',settleProjection,{passive:true});
      addEventListenerFn('orientationchange',()=>setTimeoutFn(settleProjection,90),{passive:true});
      addEventListenerFn('puppetalk-stage-viewport',settleProjection,{passive:true});
      addEventListenerFn('puppetalk-scene-change',settleProjection,{passive:true});
      visualViewport?.addEventListener?.('resize',settleProjection,{passive:true});
      resizeCanvas();
      requestFrameFn(()=>requestFrameFn(settleProjection));
      setTimeoutFn(settleProjection,160);
    }

    return {getDimensions,setRender,resizeCanvas,settleProjection,start};
  }

  root.PuppetalkControllerCanvas={create};
})(typeof window!=='undefined'?window:globalThis);
