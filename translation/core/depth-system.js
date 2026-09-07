(function(root){
  'use strict';

  const PLANES=[-.48,-.36,-.24,-.12,0,.11,.22,.33,.44,.55,.66,.77,.88,1];
  const NEUTRAL=PLANES.indexOf(0);
  const TUNING=Object.freeze({
    minDepth:PLANES[0],maxDepth:PLANES.at(-1),planes:Object.freeze([...PLANES]),neutralPlane:NEUTRAL,
    quickTapCount:3,quickTapMaxMs:180,longTapMinMs:235,longTapMaxMs:410,quickTapWindowMs:760,maxGestureTravel:.045
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function scaleForDepth(depth){
    return depth>=0?clamp(1+depth*1.58,1,2.58):clamp(1+depth*.58,.72,1);
  }
  function shiftForDepth(depth){return depth>=0?depth*.245:depth*.025;}

  function createStage(options={}){
    const now=typeof options.now==='function'?options.now:()=>root.performance?.now?.()||Date.now();
    const slots=new Map();
    function stateFor(slot){
      if(!slots.has(slot)) slots.set(slot,{depth:0,target:0,plane:NEUTRAL,lastTick:now()});
      return slots.get(slot);
    }
    function advance(state,time=now()){
      const dt=clamp((time-state.lastTick)/1000,0,.15);
      state.lastTick=time;
      if(dt<=0)return state.depth;
      const response=1-Math.exp(-7.2*dt);
      state.depth+=(state.target-state.depth)*response;
      if(Math.abs(state.target-state.depth)<.00035)state.depth=state.target;
      return state.depth;
    }
    function stepDepth(slot,direction){
      if(!Number.isInteger(slot)||!Number.isFinite(direction)||!direction)return false;
      const state=stateFor(slot);advance(state);
      const next=clamp(state.plane+Math.sign(direction),0,PLANES.length-1);
      if(next===state.plane)return false;
      state.plane=next;state.target=PLANES[next];
      return true;
    }
    function getDepthForSlot(slot){
      if(!Number.isInteger(slot))return 0;
      const state=stateFor(slot);advance(state);return state.depth;
    }
    function getPlaneForSlot(slot){return Number.isInteger(slot)?stateFor(slot).plane:NEUTRAL;}
    function tunePoint(point,center,scale,shift){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return point;
      return {...point,x:center.x+(point.x-center.x)*scale,y:center.y+(point.y-center.y)*scale+shift};
    }
    function tunePuppet(p,time=now()){
      if(!p?.torso||!Number.isInteger(p.slot))return p;
      const state=stateFor(p.slot);advance(state,time);
      const depth=state.depth;
      if(Math.abs(depth)<.0001)return {...p,depth:0,visualScale:1,depthPlane:state.plane};
      const scale=scaleForDepth(depth),shift=shiftForDepth(depth),center={x:p.torso.x,y:p.torso.y};
      const out={...p,depth,visualScale:scale,depthPlane:state.plane};
      for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
        if(out[key])out[key]=tunePoint(out[key],center,scale,shift);
      }
      return out;
    }
    function tuneScene(scene,{width=root.innerWidth||320,height=root.innerHeight||360,time=now()}={}){
      if(scene?.type!=='scene'||!Array.isArray(scene.puppets))return scene;
      return {
        ...scene,
        stageViewport:{width:Math.max(1,width),height:Math.max(1,height)},
        puppets:scene.puppets.map(p=>tunePuppet(p,time)).sort((a,b)=>(a.depth||0)-(b.depth||0))
      };
    }
    return {stepDepth,getDepthForSlot,getPlaneForSlot,scaleForDepth,shiftForDepth,tunePuppet,tuneScene,stateFor};
  }

  function createController(options={}){
    const now=typeof options.now==='function'?options.now:()=>root.performance?.now?.()||Date.now();
    const dispatch=typeof options.dispatch==='function'?options.dispatch:type=>root.dispatchEvent?.(new root.Event(type));
    let quickTaps=[];
    let gesture=null;
    const grabsOf=input=>Array.isArray(input?.grabs)?input.grabs:(input?.grabbing&&input?.grabPart?[{part:input.grabPart,x:input.x,y:input.y,screenY:input.screenY}]:[]);
    const torsoGrab=input=>grabsOf(input).find(g=>g?.part==='torso')||null;
    const clearQuickTaps=()=>{quickTaps=[];};
    function registerQuickTap(time,sendStep){
      quickTaps=quickTaps.filter(t=>time-t<=TUNING.quickTapWindowMs);quickTaps.push(time);
      if(quickTaps.length>=TUNING.quickTapCount){clearQuickTaps();sendStep?.(1);return true;}
      return false;
    }
    function observeInput(input,sendStep){
      const torso=torsoGrab(input),time=now();
      if(torso&&Number.isFinite(torso.screenY)){
        if(!gesture){
          gesture={startedAt:time,startX:Number.isFinite(torso.x)?torso.x:.5,startY:Number.isFinite(torso.y)?torso.y:.5,maxTravel:0};
        }else{
          const x=Number.isFinite(torso.x)?torso.x:gesture.startX,y=Number.isFinite(torso.y)?torso.y:gesture.startY;
          gesture.maxTravel=Math.max(gesture.maxTravel,Math.hypot(x-gesture.startX,y-gesture.startY));
        }
        return;
      }
      if(!gesture)return;
      const finished=gesture;gesture=null;
      const duration=time-finished.startedAt;
      if(finished.maxTravel>TUNING.maxGestureTravel){clearQuickTaps();return;}
      if(duration<=TUNING.quickTapMaxMs){registerQuickTap(time,sendStep);return;}
      if(duration>=TUNING.longTapMinMs&&duration<=TUNING.longTapMaxMs){clearQuickTaps();sendStep?.(-1);return;}
      clearQuickTaps();
    }
    function updateSourceStage(scene){
      const next=scene?.stageViewport;
      if(!next||!Number.isFinite(next.width)||!Number.isFinite(next.height))return false;
      const prev=root.PuppetalkSourceStage;
      if(prev&&prev.width===next.width&&prev.height===next.height)return false;
      root.PuppetalkSourceStage={width:next.width,height:next.height};
      dispatch('puppetalk-stage-viewport');
      return true;
    }
    return {observeInput,updateSourceStage,clearQuickTaps};
  }

  const stage=createStage();
  const controller=createController();
  root.PuppetalkDepthSystem={tuning:TUNING,createStage,createController,scaleForDepth,shiftForDepth};
  root.PuppetalkForegroundTuning=TUNING;
  root.PuppetalkDepthState=stage;
  root.PuppetalkDepthController=controller;
})(typeof window!=='undefined'?window:globalThis);
