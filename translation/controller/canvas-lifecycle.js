(function(root){
  'use strict';

  function create({canvas,stageBox,ctx,getDevicePixelRatio,addEventListenerFn}={}){
    if(!canvas || !stageBox || !ctx || typeof getDevicePixelRatio !== 'function' || typeof addEventListenerFn !== 'function') return null;

    let cw = 1;
    let ch = 1;
    let renderPersonalScene = ()=>{};

    function getDimensions(){ return {cw,ch}; }
    function setRender(fn){ renderPersonalScene = typeof fn === 'function' ? fn : ()=>{}; }
    function resizeCanvas(){
      const rect = stageBox.getBoundingClientRect();
      cw = Math.max(280,rect.width);
      ch = Math.max(250,Math.min(cw*.8,430));
      const dpr = Math.min(getDevicePixelRatio() || 1,2);
      canvas.width = Math.round(cw*dpr);
      canvas.height = Math.round(ch*dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      stageBox.style.minHeight = `${ch}px`;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      renderPersonalScene();
    }
    function start(){
      addEventListenerFn('resize',resizeCanvas,{passive:true});
      resizeCanvas();
    }

    return {getDimensions,setRender,resizeCanvas,start};
  }

  root.PuppetalkControllerCanvas={create};
})(typeof window!=='undefined'?window:globalThis);
