(function(root){
  'use strict';

  function create(options={}){
    const {
      getDepthState=()=>root.PuppetalkDepthState,
      getForegroundTuning=()=>root.PuppetalkForegroundTuning
    }=options;

    const PUPPETALK_SEAT_ORDER=[0,3,1,4,2,5];
    const PUPPETALK_DEPTH_X=.28;
    const PUPPETALK_FOREGROUND_TUNED_KEYS=new Set(['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']);
    const puppetalkPropOwners=new Map();

    function puppetalkSeatAngle(slot){
      const seat=PUPPETALK_SEAT_ORDER[slot] ?? slot ?? 0;
      return seat*Math.PI/3;
    }
    function puppetalkHomeX(slot){ return .16+slot*.135; }
    function puppetalkRawPoint(point,center,scale,shift){
      if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
      const safe=Math.max(.0001,scale||1);
      return {...point,x:center.x+(point.x-center.x)/safe,y:center.y+(point.y-shift-center.y)/safe};
    }
    function puppetalkViewPoint(point,rawCenter,targetCenter,targetScale,targetShift){
      if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
      return {...point,x:targetCenter.x+(point.x-rawCenter.x)*targetScale,y:rawCenter.y+(point.y-rawCenter.y)*targetScale+targetShift};
    }
    function puppetalkProjectPuppet(p,viewerSlot){
      if(!p?.torso || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return {puppet:p,meta:null};
      const depthApi=getDepthState();
      const tuning=getForegroundTuning();
      const rawDepth=Number.isFinite(p.depth)?p.depth:0;
      const rawScale=Number.isFinite(p.visualScale)?p.visualScale:(depthApi?.scaleForDepth?.(rawDepth)||1);
      const rawShift=depthApi?.shiftForDepth?.(rawDepth)||0;
      const rawCenter={x:p.torso.x,y:p.torso.y-rawShift};
      let delta=puppetalkSeatAngle(p.slot)-puppetalkSeatAngle(viewerSlot);
      while(delta>Math.PI) delta-=Math.PI*2;
      while(delta< -Math.PI) delta+=Math.PI*2;
      const c=Math.cos(delta),s=Math.sin(delta);
      const localSide=rawCenter.x-puppetalkHomeX(p.slot);
      const localForward=rawDepth*PUPPETALK_DEPTH_X;
      const viewSide=localSide*c+localForward*s;
      const viewForward=localForward*c-localSide*s;
      const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
      const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
      const viewDepth=Math.max(minDepth,Math.min(maxDepth,viewForward/PUPPETALK_DEPTH_X));
      const targetScale=depthApi?.scaleForDepth?.(viewDepth)||1;
      const targetShift=depthApi?.shiftForDepth?.(viewDepth)||0;
      const targetCenter={x:puppetalkHomeX(p.slot)+viewSide,y:rawCenter.y};
      const out={...p,depth:viewDepth,visualScale:targetScale};
      for(const [key,value] of Object.entries(p)){
        if(!value || Array.isArray(value) || typeof value!=='object') continue;
        if(!Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
        // foreground-tuning v36 only projects the original visible points. New seam
        // endpoints/segment centres arrive raw, so do not "undo" a transform they never had.
        const raw=PUPPETALK_FOREGROUND_TUNED_KEYS.has(key)
          ? puppetalkRawPoint(value,rawCenter,rawScale,rawShift)
          : value;
        out[key]=puppetalkViewPoint(raw,rawCenter,targetCenter,targetScale,targetShift);
      }
      return {puppet:out,meta:{slot:p.slot,rawCenter,targetCenter,targetScale,targetShift}};
    }
    function puppetalkProjectProp(prop,metaBySlot,viewerSlot){
      if(!prop || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return prop;
      if(Number.isFinite(prop.depth) && Number.isInteger(prop.throwerSlot) && !prop.heldBy && !prop.attachedTo && Number.isInteger(viewerSlot)){
        const owner=prop.throwerSlot;
        let delta=puppetalkSeatAngle(owner)-puppetalkSeatAngle(viewerSlot);
        while(delta>Math.PI) delta-=Math.PI*2;
        while(delta< -Math.PI) delta+=Math.PI*2;
        const c=Math.cos(delta),s=Math.sin(delta);
        const localSide=prop.x-puppetalkHomeX(owner);
        const localForward=prop.depth*PUPPETALK_DEPTH_X;
        const viewSide=localSide*c+localForward*s;
        const viewForward=localForward*c-localSide*s;
        const tuning=getForegroundTuning();
        const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
        const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
        const viewDepth=Math.max(minDepth,Math.min(maxDepth,viewForward/PUPPETALK_DEPTH_X));
        const depthApi=getDepthState();
        return {
          ...prop,
          x:puppetalkHomeX(owner)+viewSide,
          y:prop.y+(depthApi?.shiftForDepth?.(viewDepth)||0),
          viewDepth,
          viewScale:depthApi?.scaleForDepth?.(viewDepth)||1
        };
      }
      const explicit=Number.isInteger(prop?.heldBy?.slot)?prop.heldBy.slot:Number.isInteger(prop?.attachedTo?.slot)?prop.attachedTo.slot:null;
      if(Number.isInteger(explicit)) puppetalkPropOwners.set(prop.id,explicit);
      const owner=Number.isInteger(explicit)?explicit:puppetalkPropOwners.get(prop.id);
      const meta=metaBySlot.get(owner);
      if(!meta) return prop;
      const project=q=>puppetalkViewPoint(q,meta.rawCenter,meta.targetCenter,meta.targetScale,meta.targetShift);
      const out={...prop,...project(prop)};
      if(prop.attachedTo?.anchor && Number.isFinite(prop.attachedTo.anchor.x) && Number.isFinite(prop.attachedTo.anchor.y)){
        out.attachedTo={...prop.attachedTo,anchor:project(prop.attachedTo.anchor)};
      }
      return out;
    }
    function puppetalkSeatProjection(puppets,props,viewerSlot){
      if(!Number.isInteger(viewerSlot)) return {puppets,props};
      const metaBySlot=new Map();
      const projected=(puppets||[]).map(p=>{
        const r=puppetalkProjectPuppet(p,viewerSlot);
        if(r.meta) metaBySlot.set(r.meta.slot,r.meta);
        return r.puppet;
      }).sort((a,b)=>(a.depth||0)-(b.depth||0));
      return {puppets:projected,props:(props||[]).map(prop=>puppetalkProjectProp(prop,metaBySlot,viewerSlot))};
    }

    return {
      puppetalkSeatAngle,puppetalkHomeX,puppetalkRawPoint,puppetalkViewPoint,
      puppetalkProjectPuppet,puppetalkProjectProp,puppetalkSeatProjection,
      PUPPETALK_SEAT_ORDER,PUPPETALK_DEPTH_X,PUPPETALK_FOREGROUND_TUNED_KEYS
    };
  }

  root.PuppetalkSeatProjection={create};
})(typeof window!=='undefined'?window:globalThis);
