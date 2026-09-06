(function(global){
  'use strict';

  function create(options={}){
    const {
      canvas,ctx,Bodies,Composite,engine,
      getBounds,setBounds,setDimensions,
      ensureTestProps,installDartImpacts,installPropContactPhysics,tick,
      getViewport=()=>({
        width:typeof innerWidth==='number'?innerWidth:0,
        height:typeof innerHeight==='number'?innerHeight:0,
        dpr:typeof devicePixelRatio==='number'?devicePixelRatio:1
      }),
      addEventListenerFn=(type,handler,opts)=>addEventListener(type,handler,opts),
      requestFrame=callback=>requestAnimationFrame(callback)
    }=options;

    if(!canvas || !ctx || !Bodies || !Composite || !engine ||
       typeof getBounds!=='function' || typeof setBounds!=='function' || typeof setDimensions!=='function' ||
       typeof ensureTestProps!=='function' || typeof installDartImpacts!=='function' ||
       typeof installPropContactPhysics!=='function' || typeof tick!=='function' ||
       typeof getViewport!=='function' || typeof addEventListenerFn!=='function' || typeof requestFrame!=='function') return null;

    function resize(){
      const viewport=getViewport()||{};
      const W=Math.max(Number(viewport.width)||0,320);
      const H=Math.max(Number(viewport.height)||0,360);
      const dpr=Math.min(Number(viewport.dpr)||1,2);
      setDimensions(W,H);
      canvas.width=Math.round(W*dpr);
      canvas.height=Math.round(H*dpr);
      canvas.style.width=`${W}px`;
      canvas.style.height=`${H}px`;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      (getBounds()||[]).forEach(body=>Composite.remove(engine.world,body));
      const bounds=[
        Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
        Bodies.rectangle(W/2,-22,W+160,44,{isStatic:true,friction:.65}),
        Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
        Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
      ];
      setBounds(bounds);
      Composite.add(engine.world,bounds);
    }

    function start(){
      addEventListenerFn('resize',resize,{passive:true});
      resize();
      ensureTestProps();
      installDartImpacts();
      installPropContactPhysics();
      requestFrame(tick);
    }

    return {resize,start};
  }

  global.PuppetalkStageLifecycle={create};
})(typeof window!=='undefined'?window:globalThis);
