(function(root){
  'use strict';

  const hex=root.PuppetalkSharedHex;
  if(!hex) return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  // ---------------------------------------------------------------------------
  // Seven geometrically meaningful depth planes. The gesture contract stays the
  // same (quick taps closer, short hold away); only the underlying depth values
  // now correspond to the seven exact cross-hex planes.
  // ---------------------------------------------------------------------------
  function installDepthSystem(){
    const PLANES=[...hex.LEVELS];
    const NEUTRAL=PLANES.indexOf(0);
    const TUNING=Object.freeze({
      minDepth:-1,maxDepth:1,planes:Object.freeze(PLANES),neutralPlane:NEUTRAL,
      quickTapCount:3,quickTapMaxMs:180,longTapMinMs:235,longTapMaxMs:410,
      quickTapWindowMs:760,maxGestureTravel:.045,sharedHex:true
    });

    function scaleForDepth(depth){
      return depth>=0 ? clamp(1+depth*1.58,1,2.58) : clamp(1+depth*.28,.72,1);
    }
    function shiftForDepth(depth){ return depth>=0 ? depth*.245 : depth*.025; }

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
        const state=stateFor(slot); advance(state);
        const next=clamp(state.plane+Math.sign(direction),0,PLANES.length-1);
        if(next===state.plane) return false;
        state.plane=next; state.target=PLANES[next];
        return true;
      }
      function getDepthForSlot(slot){
        if(!Number.isInteger(slot)) return 0;
        const state=stateFor(slot); advance(state); return state.depth;
      }
      function getPlaneForSlot(slot){ return Number.isInteger(slot)?stateFor(slot).plane:NEUTRAL; }
      function tunePoint(point,center,scale,shift){
        if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
        return {...point,x:center.x+(point.x-center.x)*scale,y:center.y+(point.y-center.y)*scale+shift};
      }
      function tunePuppet(p,time=now()){
        if(!p?.torso||!Number.isInteger(p.slot)) return p;
        const state=stateFor(p.slot); advance(state,time);
        const depth=state.depth,scale=scaleForDepth(depth),shift=shiftForDepth(depth),center={x:p.torso.x,y:p.torso.y};
        const out={...p,depth,visualScale:scale,depthPlane:state.plane};
        if(Math.abs(depth)<.0001) return out;
        for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
          if(out[key]) out[key]=tunePoint(out[key],center,scale,shift);
        }
        return out;
      }
      function tuneScene(scene,{width=root.innerWidth||320,height=root.innerHeight||360,time=now()}={}){
        if(scene?.type!=='scene'||!Array.isArray(scene.puppets)) return scene;
        return {...scene,stageViewport:{width:Math.max(1,width),height:Math.max(1,height)},puppets:scene.puppets.map(p=>tunePuppet(p,time)).sort((a,b)=>(a.depth||0)-(b.depth||0))};
      }
      return {stepDepth,getDepthForSlot,getPlaneForSlot,scaleForDepth,shiftForDepth,tunePuppet,tuneScene,stateFor};
    }

    function createController(options={}){
      const now=typeof options.now==='function'?options.now:()=>root.performance?.now?.()||Date.now();
      const dispatch=typeof options.dispatch==='function'?options.dispatch:type=>root.dispatchEvent?.(new root.Event(type));
      let quickTaps=[],gesture=null;
      const grabsOf=input=>Array.isArray(input?.grabs)?input.grabs:(input?.grabbing&&input?.grabPart?[{part:input.grabPart,x:input.x,y:input.y,screenY:input.screenY}]:[]);
      const torsoGrab=input=>grabsOf(input).find(g=>g?.part==='torso')||null;
      const clearQuickTaps=()=>{quickTaps=[];};
      function registerQuickTap(time,sendStep){
        quickTaps=quickTaps.filter(t=>time-t<=TUNING.quickTapWindowMs); quickTaps.push(time);
        if(quickTaps.length>=TUNING.quickTapCount){clearQuickTaps();sendStep?.(1);return true;}
        return false;
      }
      function observeInput(input,sendStep){
        const torso=torsoGrab(input),time=now();
        if(torso&&Number.isFinite(torso.screenY)){
          if(!gesture) gesture={startedAt:time,startX:Number.isFinite(torso.x)?torso.x:.5,startY:Number.isFinite(torso.y)?torso.y:.5,maxTravel:0};
          else{
            const x=Number.isFinite(torso.x)?torso.x:gesture.startX,y=Number.isFinite(torso.y)?torso.y:gesture.startY;
            gesture.maxTravel=Math.max(gesture.maxTravel,Math.hypot(x-gesture.startX,y-gesture.startY));
          }
          return;
        }
        if(!gesture) return;
        const finished=gesture; gesture=null;
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

    const system={tuning:TUNING,createStage,createController,scaleForDepth,shiftForDepth,sharedHex:true};
    root.PuppetalkDepthSystem=system;
    root.PuppetalkForegroundTuning=TUNING;
    root.PuppetalkDepthState=createStage();
    root.PuppetalkDepthController=createController();
  }

  // ---------------------------------------------------------------------------
  // Canonical floor projection. A puppet's raw X is interpreted as the full
  // left/right extent available at its current depth from its own side. That
  // produces one point in the shared hex; every viewer then flattens that point.
  // ---------------------------------------------------------------------------
  function installSeatProjection(){
    const tunedKeys=new Set(['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']);
    const propOwners=new Map();

    function rawPoint(point,center,scale,shift){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
      const safe=Math.max(.0001,scale||1);
      return {...point,x:center.x+(point.x-center.x)/safe,y:center.y+(point.y-shift-center.y)/safe};
    }
    function viewPoint(point,rawCenter,targetCenter,targetScale,targetShift){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) return point;
      return {...point,x:targetCenter.x+(point.x-rawCenter.x)*targetScale,y:rawCenter.y+(point.y-rawCenter.y)*targetScale+targetShift};
    }

    function create(options={}){
      const getDepthState=options.getDepthState||(()=>root.PuppetalkDepthState);

      function projectPuppet(p,viewerSlot){
        if(!p?.torso||!Number.isInteger(p.slot)||!Number.isInteger(viewerSlot)) return {puppet:p,meta:null};
        const depthApi=getDepthState();
        const rawDepth=Number.isFinite(p.depth)?p.depth:0;
        const rawScale=Number.isFinite(p.visualScale)?p.visualScale:(depthApi?.scaleForDepth?.(rawDepth)||1);
        const rawShift=depthApi?.shiftForDepth?.(rawDepth)||0;
        const rawCenter={x:p.torso.x,y:p.torso.y-rawShift};
        const world=hex.worldFromView(rawCenter.x,rawDepth,p.slot);
        const view=hex.viewFromWorld(world,viewerSlot);
        const targetScale=depthApi?.scaleForDepth?.(view.depth)||1;
        const targetShift=depthApi?.shiftForDepth?.(view.depth)||0;
        const targetCenter={x:view.screenX,y:rawCenter.y};
        const out={...p,depth:view.depth,visualScale:targetScale,worldX:world.x,worldY:world.y};
        for(const [key,value] of Object.entries(p)){
          if(!value||Array.isArray(value)||typeof value!=='object'||!Number.isFinite(value.x)||!Number.isFinite(value.y)) continue;
          const raw=tunedKeys.has(key)?rawPoint(value,rawCenter,rawScale,rawShift):value;
          out[key]=viewPoint(raw,rawCenter,targetCenter,targetScale,targetShift);
        }
        return {puppet:out,meta:{slot:p.slot,world,rawCenter,targetCenter,targetScale,targetShift,viewDepth:view.depth}};
      }

      function projectProp(prop,metaBySlot,viewerSlot){
        if(!prop||!Number.isFinite(prop.x)||!Number.isFinite(prop.y)) return prop;
        const depthApi=getDepthState();
        if(Number.isFinite(prop.worldX)&&Number.isFinite(prop.worldY)&&Number.isInteger(viewerSlot)){
          const world={x:prop.worldX,y:prop.worldY};
          const view=hex.viewFromWorld(world,viewerSlot);
          const shift=depthApi?.shiftForDepth?.(view.depth)||0;
          return {...prop,x:view.screenX,y:prop.y+shift,viewDepth:view.depth,viewScale:depthApi?.scaleForDepth?.(view.depth)||1};
        }
        if(Number.isFinite(prop.depth)&&Number.isInteger(prop.throwerSlot)&&!prop.heldBy&&!prop.attachedTo&&Number.isInteger(viewerSlot)){
          const world=hex.worldFromView(prop.x,prop.depth,prop.throwerSlot);
          const view=hex.viewFromWorld(world,viewerSlot);
          const shift=depthApi?.shiftForDepth?.(view.depth)||0;
          return {...prop,x:view.screenX,y:prop.y+shift,viewDepth:view.depth,viewScale:depthApi?.scaleForDepth?.(view.depth)||1,worldX:world.x,worldY:world.y};
        }
        const explicit=Number.isInteger(prop?.heldBy?.slot)?prop.heldBy.slot:Number.isInteger(prop?.attachedTo?.slot)?prop.attachedTo.slot:null;
        if(Number.isInteger(explicit)) propOwners.set(prop.id,explicit);
        const owner=Number.isInteger(explicit)?explicit:propOwners.get(prop.id);
        const meta=metaBySlot.get(owner);
        if(!meta) return prop;
        const project=q=>viewPoint(q,meta.rawCenter,meta.targetCenter,meta.targetScale,meta.targetShift);
        const out={...prop,...project(prop)};
        if(prop.attachedTo?.anchor&&Number.isFinite(prop.attachedTo.anchor.x)&&Number.isFinite(prop.attachedTo.anchor.y)) out.attachedTo={...prop.attachedTo,anchor:project(prop.attachedTo.anchor)};
        return out;
      }

      function seatProjection(puppets,props,viewerSlot){
        if(!Number.isInteger(viewerSlot)) return {puppets,props};
        const metaBySlot=new Map();
        const projected=(puppets||[]).map(p=>{
          const result=projectPuppet(p,viewerSlot);
          if(result.meta) metaBySlot.set(result.meta.slot,result.meta);
          return result.puppet;
        }).sort((a,b)=>(a.depth||0)-(b.depth||0));
        return {puppets:projected,props:(props||[]).map(prop=>projectProp(prop,metaBySlot,viewerSlot))};
      }

      return {
        puppetalkSeatAngle:hex.seatAngle,
        puppetalkHomeX:slot=>.16+slot*.135,
        puppetalkRawPoint:rawPoint,
        puppetalkViewPoint:viewPoint,
        puppetalkProjectPuppet:projectPuppet,
        puppetalkProjectProp:projectProp,
        puppetalkSeatProjection:seatProjection,
        PUPPETALK_SEAT_ORDER:hex.SEAT_ORDER,
        PUPPETALK_DEPTH_X:1,
        PUPPETALK_FOREGROUND_TUNED_KEYS:tunedKeys,
        sharedHex:true
      };
    }

    root.PuppetalkSeatProjection={create,sharedHex:true};
  }

  // ---------------------------------------------------------------------------
  // Prop scene state carries canonical world coordinates when a released prop is
  // using shared-floor flight. Held props still follow their owner as before.
  // ---------------------------------------------------------------------------
  function installPropStatePatch(){
    const original=root.PuppetalkPropState?.create;
    if(typeof original!=='function') return;
    root.PuppetalkPropState.create=function(options){
      const base=original(options);
      if(!base) return base;
      const originalPropState=base.propState;
      return {...base,propState(prop){
        const state=originalPropState(prop);
        if(prop?._hexWorld&&Number.isFinite(prop._hexWorld.x)&&Number.isFinite(prop._hexWorld.y)){
          state.worldX=prop._hexWorld.x;
          state.worldY=prop._hexWorld.y;
        }
        return state;
      }};
    };
  }

  // ---------------------------------------------------------------------------
  // Released frisbees become autonomous objects on the shared floor. Their 2D
  // release velocity is converted once into a world-space vector; the Matter body
  // is then kept as a compatibility carrier for height/spin and legacy systems.
  // ---------------------------------------------------------------------------
  function installPropDriverPatch(){
    const original=root.PuppetalkPropDriver?.create;
    if(typeof original!=='function') return;
    root.PuppetalkPropDriver.create=function(deps){
      const base=original(deps);
      if(!base) return base;
      const {props,Body}=deps;
      const now=typeof deps.now==='function'?deps.now:()=>root.performance?.now?.()||Date.now();
      let last=now();

      function viewport(){ return {W:Math.max(320,root.innerWidth||360),H:Math.max(320,root.innerHeight||640)}; }

      function startFlight(prop,at){
        if(prop.type!=='frisbee'||!prop._cutArmed||!Number.isInteger(prop._throwerSlot)||!Number.isFinite(prop._depth)) return false;
        if(prop._hexFlightThrownAt===prop._thrownAt) return !!prop._hexFlying;
        const {W,H}=viewport(),b=prop.body;
        const start=hex.worldFromView(clamp(b.position.x/W,0,1),prop._depth,prop._throwerSlot);
        const lateral=(b.velocity?.x||0)*60/W*.95;
        const forward=-(b.velocity?.y||0)*60/H*1.18;
        prop._hexWorld=start;
        prop._hexVelocity=hex.worldVelocityFromView(lateral,forward,prop._throwerSlot);
        prop._hexHeightY=b.position.y;
        prop._hexFlying=true;
        prop._hexFlightThrownAt=prop._thrownAt;
        prop._hexLastAt=at;
        Body.setVelocity(b,{x:0,y:0});
        return true;
      }

      function driveHexFlights(at){
        const {W}=viewport();
        props.forEach(prop=>{
          if(prop.heldBy||prop.contest||prop.attachedTo){
            prop._hexFlying=false;
            return;
          }
          startFlight(prop,at);
          if(!prop._hexFlying||!prop._hexWorld||!prop._hexVelocity) return;
          const dt=clamp((at-(prop._hexLastAt||at))/1000,0,.04);
          prop._hexLastAt=at;
          if(dt<=0) return;
          let vx=prop._hexVelocity.x,vy=prop._hexVelocity.y;
          const speed=Math.hypot(vx,vy);
          const curve=.62*dt;
          const c=Math.cos(curve),s=Math.sin(curve);
          const rvx=vx*c-vy*s,rvy=vx*s+vy*c;
          const damping=Math.exp(-.18*dt);
          vx=rvx*damping; vy=rvy*damping;
          let next={x:prop._hexWorld.x+vx*dt,y:prop._hexWorld.y+vy*dt};
          if(!hex.insideHex(next)){
            next=hex.clampToHex(next);
            prop._hexFlying=false;
            prop._cutArmed=false;
          }
          prop._hexWorld=next;
          prop._hexVelocity={x:vx,y:vy};
          const ownerView=hex.viewFromWorld(next,prop._throwerSlot);
          prop._depth=ownerView.depth;
          const bodyX=ownerView.screenX*W;
          if(typeof Body.setPosition==='function') Body.setPosition(prop.body,{x:bodyX,y:prop._hexHeightY});
          Body.setVelocity(prop.body,{x:0,y:0});
          if(speed<.035){prop._hexFlying=false;prop._cutArmed=false;}
        });
      }

      return {...base,driveProps(){
        base.driveProps();
        const at=now();
        driveHexFlights(at);
        last=at;
      },startHexFlight:startFlight,driveHexFlights,sharedHex:true};
    };
  }

  // ---------------------------------------------------------------------------
  // Aim/cut projection uses the same canonical floor. Melee remains intentionally
  // permissive and screen-relative; autonomous props acquire coherent world depth.
  // ---------------------------------------------------------------------------
  function installDepthAssistPatch(){
    const original=root.PuppetalkDepthAssist?.create;
    if(typeof original!=='function') return;
    root.PuppetalkDepthAssist.create=function(deps){
      const base=original(deps);
      if(!base) return base;
      const {props,puppets,clamp:limit,Body,getDimensions}=deps;
      const getDepthState=deps.getDepthState||(()=>root.PuppetalkDepthState);

      function projectPuppetPoint(p,q,viewerSlot){
        if(!p?.torso||!q||!Number.isInteger(p.slot)||!Number.isInteger(viewerSlot)) return null;
        const {W,H}=getDimensions();
        const rawDepth=getDepthState()?.getDepthForSlot?.(p.slot)||0;
        const rawCenter=p.torso.position;
        const world=hex.worldFromView(clamp(rawCenter.x/W,0,1),rawDepth,p.slot);
        const view=hex.viewFromWorld(world,viewerSlot);
        const scale=getDepthState()?.scaleForDepth?.(view.depth)||1;
        const shift=(getDepthState()?.shiftForDepth?.(view.depth)||0)*H;
        return {x:view.screenX*W+(q.x-rawCenter.x)*scale,y:rawCenter.y+(q.y-rawCenter.y)*scale+shift,depth:view.depth,scale,world};
      }

      function projectPropPoint(prop,viewerSlot){
        if(!prop?.body) return {x:0,y:0,depth:0};
        const {W,H}=getDimensions();
        const owner=Number.isInteger(prop._throwerSlot)?prop._throwerSlot:viewerSlot;
        if(!Number.isInteger(owner)||!Number.isInteger(viewerSlot)) return {x:prop.body.position.x,y:prop.body.position.y,depth:0};
        const world=prop._hexWorld&&Number.isFinite(prop._hexWorld.x)&&Number.isFinite(prop._hexWorld.y)
          ? prop._hexWorld
          : hex.worldFromView(clamp(prop.body.position.x/W,0,1),Number.isFinite(prop._depth)?prop._depth:0,owner);
        const view=hex.viewFromWorld(world,viewerSlot);
        const shift=(getDepthState()?.shiftForDepth?.(view.depth)||0)*H;
        return {x:view.screenX*W,y:prop.body.position.y+shift,depth:view.depth,world};
      }

      function driveDepthAssistedProps(at){
        for(const prop of props.values()){
          if(!Number.isInteger(prop._throwerSlot)||(!Number.isFinite(prop._depth)&&!prop._hexWorld)) continue;
          if(prop.heldBy||prop.contest||prop.attachedTo) continue;
          const current=projectPropPoint(prop,prop._throwerSlot);
          const previous=prop._assistPrevScreen||current;
          prop._assistPrevScreen=current;
          if(at>(prop._depthAssistUntil||0)) continue;
          const speed=prop._hexVelocity?Math.hypot(prop._hexVelocity.x,prop._hexVelocity.y)*10:Math.hypot(prop.body.velocity?.x||0,prop.body.velocity?.y||0);
          if(speed<.35) continue;
          let best=null;
          for(const p of puppets.values()){
            if(p.slot===prop._throwerSlot) continue;
            for(const body of (Array.isArray(p?.bodies)?p.bodies:[])){
              const projected=projectPuppetPoint(p,body.position,prop._throwerSlot);
              if(!projected) continue;
              const depthGap=Math.abs(current.depth-projected.depth);
              if(depthGap>.38) continue;
              const w=Math.max(1,body.bounds?.max?.x-body.bounds?.min?.x||18),h=Math.max(1,body.bounds?.max?.y-body.bounds?.min?.y||18);
              const radius=limit(Math.max(w,h)*.48*projected.scale,12,34)+15;
              const distance=base.puppetalkAssistSegmentDistance(projected,previous,current);
              if(distance>radius) continue;
              const score=distance+depthGap*42;
              if(!best||score<best.score) best={body,projected,score};
            }
          }
          if(!best) continue;
          // Do not pull shared-world frisbees onto hidden 3D coordinates. A close
          // projected overlap is already enough to let the existing cut system act.
          if(prop._hexWorld) continue;
          const depthDelta=best.projected.depth-current.depth;
          prop._depth=(Number.isFinite(prop._depth)?prop._depth:0)+limit(depthDelta*.26,-.05,.05);
        }
      }

      return {...base,
        puppetalkActionSeatAngle:hex.seatAngle,
        puppetalkActionHomeX:()=>.5,
        puppetalkActionDepth:slot=>getDepthState()?.getDepthForSlot?.(slot)||0,
        puppetalkActionClampDepth:d=>limit(d,-1,1),
        puppetalkActionProjectPuppetPoint:projectPuppetPoint,
        puppetalkAimProjectPoint:(p,q,v)=>projectPuppetPoint(p,q,v)||q,
        puppetalkAimProjectPropPoint:projectPropPoint,
        driveDepthAssistedProps,
        sharedHex:true
      };
    };
  }

  installDepthSystem();
  installSeatProjection();
  installPropStatePatch();
  installPropDriverPatch();
  installDepthAssistPatch();

  root.PuppetalkSharedHexIntegration=Object.freeze({version:1,active:true,levels:hex.LEVELS});
})(typeof window!=='undefined'?window:globalThis);
