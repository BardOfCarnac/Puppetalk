(function(root){
  'use strict';

  const hex=root.PuppetalkSharedHex;
  if(!hex) return;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const PLANES=[...hex.LEVELS];
  // The literal outer planes are vertices of the regular hex, so their lateral
  // cross-section has zero width. Keep them as the logical field labels, but use
  // inset playable centres so entering field 1/7 never traps the puppet.
  const PLAYABLE_DEPTHS=Object.freeze([-.84,-.5,-.25,0,.25,.5,.84]);
  const NEUTRAL=3;
  const TUNING=Object.freeze({
    minDepth:-1,maxDepth:1,
    planes:Object.freeze(PLANES),
    playableDepths:PLAYABLE_DEPTHS,
    neutralPlane:NEUTRAL,
    quickTapCount:3,quickTapMaxMs:180,longTapMinMs:235,longTapMaxMs:410,
    quickTapWindowMs:760,maxGestureTravel:.045,
    sharedHex:true,flattenedPerspective:true
  });

  function planeCoordinate(depth){
    const d=clamp(Number(depth)||0,PLAYABLE_DEPTHS[0],PLAYABLE_DEPTHS.at(-1));
    if(d<=PLAYABLE_DEPTHS[0]) return 0;
    if(d>=PLAYABLE_DEPTHS.at(-1)) return PLAYABLE_DEPTHS.length-1;
    for(let i=0;i<PLAYABLE_DEPTHS.length-1;i++){
      const a=PLAYABLE_DEPTHS[i],b=PLAYABLE_DEPTHS[i+1];
      if(d<=b){
        const t=(d-a)/Math.max(1e-9,b-a);
        return i+t;
      }
    }
    return NEUTRAL;
  }

  // Equal visual increments per logical field, deliberately very flat.
  // Anchors: .90, .933, .967, 1.0, 1.033, 1.067, 1.10.
  function scaleForDepth(depth){
    return .90+(planeCoordinate(depth)/6)*.20;
  }

  // Depth no longer moves the puppet's physical/visual root down the screen.
  // This also prevents visual depth from feeding back into torso locomotion.
  function shiftForDepth(){ return 0; }

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
      if(dt<=0) return state.depth;
      const response=1-Math.exp(-7.2*dt);
      state.depth+=(state.target-state.depth)*response;
      if(Math.abs(state.target-state.depth)<.00035) state.depth=state.target;
      return state.depth;
    }

    function stepDepth(slot,direction){
      if(!Number.isInteger(slot)||!Number.isFinite(direction)||!direction) return false;
      const state=stateFor(slot);
      advance(state);
      const next=clamp(state.plane+Math.sign(direction),0,PLANES.length-1);
      if(next===state.plane) return false;
      state.plane=next;
      state.target=PLAYABLE_DEPTHS[next];
      return true;
    }

    function getDepthForSlot(slot){
      if(!Number.isInteger(slot)) return 0;
      const state=stateFor(slot);
      advance(state);
      return state.depth;
    }

    function getPlaneForSlot(slot){
      return Number.isInteger(slot)?stateFor(slot).plane:NEUTRAL;
    }

    function tunePoint(point,center,scale){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
      return {...point,
        x:center.x+(point.x-center.x)*scale,
        y:center.y+(point.y-center.y)*scale
      };
    }

    function tunePuppet(p,time=now()){
      if(!p?.torso||!Number.isInteger(p.slot)) return p;
      const state=stateFor(p.slot);
      advance(state,time);
      const depth=state.depth;
      const scale=scaleForDepth(depth);
      const center={x:p.torso.x,y:p.torso.y};
      const out={...p,depth,visualScale:scale,depthPlane:state.plane};
      if(Math.abs(scale-1)<.0001) return out;
      for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
        if(out[key]) out[key]=tunePoint(out[key],center,scale);
      }
      return out;
    }

    function tuneScene(scene,{width=root.innerWidth||320,height=root.innerHeight||360,time=now()}={}){
      if(scene?.type!=='scene'||!Array.isArray(scene.puppets)) return scene;
      return {
        ...scene,
        stageViewport:{width:Math.max(1,width),height:Math.max(1,height)},
        puppets:scene.puppets.map(p=>tunePuppet(p,time)).sort((a,b)=>(a.depth||0)-(b.depth||0))
      };
    }

    return {
      stepDepth,getDepthForSlot,getPlaneForSlot,
      scaleForDepth,shiftForDepth,tunePuppet,tuneScene,stateFor,
      playableDepths:PLAYABLE_DEPTHS
    };
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
      quickTaps=quickTaps.filter(t=>time-t<=TUNING.quickTapWindowMs);
      quickTaps.push(time);
      if(quickTaps.length>=TUNING.quickTapCount){clearQuickTaps();sendStep?.(1);return true;}
      return false;
    }

    function observeInput(input,sendStep){
      const torso=torsoGrab(input),time=now();
      if(torso&&Number.isFinite(torso.screenY)){
        if(!gesture){
          gesture={startedAt:time,startX:Number.isFinite(torso.x)?torso.x:.5,startY:Number.isFinite(torso.y)?torso.y:.5,maxTravel:0};
        }else{
          const x=Number.isFinite(torso.x)?torso.x:gesture.startX;
          const y=Number.isFinite(torso.y)?torso.y:gesture.startY;
          gesture.maxTravel=Math.max(gesture.maxTravel,Math.hypot(x-gesture.startX,y-gesture.startY));
        }
        return;
      }
      if(!gesture) return;
      const finished=gesture;
      gesture=null;
      const duration=time-finished.startedAt;
      if(finished.maxTravel>TUNING.maxGestureTravel){clearQuickTaps();return;}
      if(duration<=TUNING.quickTapMaxMs){registerQuickTap(time,sendStep);return;}
      if(duration>=TUNING.longTapMinMs&&duration<=TUNING.longTapMaxMs){clearQuickTaps();sendStep?.(-1);return;}
      clearQuickTaps();
    }

    function updateSourceStage(scene){
      const next=scene?.stageViewport;
      if(!next||!Number.isFinite(next.width)||!Number.isFinite(next.height)) return false;
      const prev=root.PuppetalkSourceStage;
      if(prev&&prev.width===next.width&&prev.height===next.height) return false;
      root.PuppetalkSourceStage={width:next.width,height:next.height};
      dispatch('puppetalk-stage-viewport');
      return true;
    }

    return {observeInput,updateSourceStage,clearQuickTaps};
  }

  const system={
    tuning:TUNING,createStage,createController,
    scaleForDepth,shiftForDepth,planeCoordinate,
    playableDepths:PLAYABLE_DEPTHS,
    sharedHex:true,flattenedPerspective:true
  };

  // This script runs after shared-hex-integration and before bootstrap, so every
  // subsequently composed stage/controller/prop system receives the tuned state.
  root.PuppetalkDepthSystem=system;
  root.PuppetalkForegroundTuning=TUNING;
  root.PuppetalkDepthState=createStage();
  root.PuppetalkDepthController=createController();
  root.PuppetalkSharedHexTuning=Object.freeze({version:1,active:true,playableDepths:PLAYABLE_DEPTHS});
})(typeof window!=='undefined'?window:globalThis);
