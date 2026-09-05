(function(root){
  'use strict';

  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;
  const PUPPETALK_ACTION_SCREEN_PAD = 15;
  const PUPPETALK_ACTION_DEPTH_X = .28;
  const PUPPETALK_ACTION_SEAT_ORDER = [0,3,1,4,2,5];

  function create({props,puppets,clamp,Body,getDimensions,getDepthState,getForegroundTuning}){
    function puppetalkActionSeatAngle(slot){
      const seat=PUPPETALK_ACTION_SEAT_ORDER[slot] ?? slot ?? 0;
      return seat*Math.PI/3;
    }
    function puppetalkActionHomeX(slot){ return .16+slot*.135; }
    function puppetalkActionDepth(slot){
      const depthState=getDepthState();
      return Number.isInteger(slot) ? (depthState?.getDepthForSlot?.(slot) || 0) : 0;
    }
    function puppetalkActionClampDepth(depth){
      const tuning=getForegroundTuning();
      const lo=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
      const hi=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
      return clamp(depth,lo,hi);
    }
    function puppetalkActionProjectPuppetPoint(p,q,viewerSlot){
      if(!p?.torso || !q || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return null;
      const {W,H}=getDimensions();
      const rawDepth=puppetalkActionDepth(p.slot);
      const rawCenter=p.torso.position;
      let delta=puppetalkActionSeatAngle(p.slot)-puppetalkActionSeatAngle(viewerSlot);
      while(delta>Math.PI) delta-=Math.PI*2;
      while(delta< -Math.PI) delta+=Math.PI*2;
      const c=Math.cos(delta),s=Math.sin(delta);
      const localSide=rawCenter.x/W-puppetalkActionHomeX(p.slot);
      const localForward=rawDepth*PUPPETALK_ACTION_DEPTH_X;
      const viewSide=localSide*c+localForward*s;
      const viewForward=localForward*c-localSide*s;
      const viewDepth=puppetalkActionClampDepth(viewForward/PUPPETALK_ACTION_DEPTH_X);
      const depthState=getDepthState();
      const scale=depthState?.scaleForDepth?.(viewDepth) || 1;
      const shift=(depthState?.shiftForDepth?.(viewDepth) || 0)*H;
      const centerX=(puppetalkActionHomeX(p.slot)+viewSide)*W;
      return {
        x:centerX+(q.x-rawCenter.x)*scale,
        y:rawCenter.y+(q.y-rawCenter.y)*scale+shift,
        depth:viewDepth,
        scale
      };
    }
    function puppetalkAimProjectPoint(p,q,viewerSlot){
      return puppetalkActionProjectPuppetPoint(p,q,viewerSlot) || q;
    }
    function puppetalkAimProjectPropPoint(prop,viewerSlot){
      if(!prop?.body) return {x:0,y:0,depth:0};
      const {W,H}=getDimensions();
      const owner=Number.isInteger(prop._throwerSlot)?prop._throwerSlot:viewerSlot;
      if(!Number.isInteger(owner) || !Number.isInteger(viewerSlot) || !Number.isFinite(prop._depth)){
        return {x:prop.body.position.x,y:prop.body.position.y,depth:0};
      }
      let delta=puppetalkActionSeatAngle(owner)-puppetalkActionSeatAngle(viewerSlot);
      while(delta>Math.PI) delta-=Math.PI*2;
      while(delta< -Math.PI) delta+=Math.PI*2;
      const c=Math.cos(delta),s=Math.sin(delta);
      const localSide=prop.body.position.x/W-puppetalkActionHomeX(owner);
      const localForward=prop._depth*PUPPETALK_ACTION_DEPTH_X;
      const viewSide=localSide*c+localForward*s;
      const viewForward=localForward*c-localSide*s;
      const viewDepth=puppetalkActionClampDepth(viewForward/PUPPETALK_ACTION_DEPTH_X);
      const depthState=getDepthState();
      const shift=(depthState?.shiftForDepth?.(viewDepth) || 0)*H;
      return {
        x:(puppetalkActionHomeX(owner)+viewSide)*W,
        y:prop.body.position.y+shift,
        depth:viewDepth
      };
    }
    function puppetalkAssistSegmentDistance(point,a,b){
      const abx=b.x-a.x,aby=b.y-a.y;
      const d=abx*abx+aby*aby;
      if(d<.0001) return Math.hypot(point.x-a.x,point.y-a.y);
      const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
      return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
    }
    function puppetalkAssistBodyRadius(body,scale=1){
      if(!body?.bounds) return 18;
      const w=Math.max(1,body.bounds.max.x-body.bounds.min.x);
      const h=Math.max(1,body.bounds.max.y-body.bounds.min.y);
      return clamp(Math.max(w,h)*.48*scale,12,34);
    }
    function puppetalkAssistBodies(p){
      return Array.isArray(p?.bodies) ? p.bodies.filter(Boolean) : [];
    }
    function driveDepthAssistedProps(now){
      for(const prop of props.values()){
        if(!Number.isInteger(prop._throwerSlot) || !Number.isFinite(prop._depth)) continue;
        if(prop.heldBy || prop.contest || prop.attachedTo) continue;
        const b=prop.body;
        const current=puppetalkAimProjectPropPoint(prop,prop._throwerSlot);
        const previous=prop._assistPrevScreen || current;
        prop._assistPrevScreen=current;
        if(now>(prop._depthAssistUntil||0)) continue;
        const speed=Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
        if(speed<2.2) continue;

        let best=null;
        for(const p of puppets.values()){
          if(p.slot===prop._throwerSlot) continue;
          for(const body of puppetalkAssistBodies(p)){
            const projected=puppetalkActionProjectPuppetPoint(p,body.position,prop._throwerSlot);
            if(!projected) continue;
            const depthGap=Math.abs(prop._depth-projected.depth);
            if(depthGap>PUPPETALK_ACTION_DEPTH_TOLERANCE) continue;
            const radius=puppetalkAssistBodyRadius(body,projected.scale)+PUPPETALK_ACTION_SCREEN_PAD;
            const distance=puppetalkAssistSegmentDistance(projected,previous,current);
            if(distance>radius) continue;
            const score=distance+depthGap*42;
            if(!best || score<best.score) best={p,body,projected,depthGap,distance,score};
          }
        }
        if(!best) continue;

        const depthDelta=best.projected.depth-prop._depth;
        prop._depth += clamp(depthDelta*.26,-.05,.05);

        if(prop.type!=='frisbee'){
          const dx=best.body.position.x-best.projected.x;
          const dy=best.body.position.y-best.projected.y;
          const mismatch=Math.hypot(dx,dy);
          if(mismatch<115){
            Body.translate(b,{x:clamp(dx*.18,-6,6),y:clamp(dy*.18,-6,6)});
            Body.setVelocity(b,{
              x:(b.velocity?.x||0)+clamp(dx*.012,-1.05,1.05),
              y:(b.velocity?.y||0)+clamp(dy*.012,-1.05,1.05)
            });
          }
        }
      }
    }

    return {
      PUPPETALK_ACTION_DEPTH_TOLERANCE,PUPPETALK_ACTION_SCREEN_PAD,PUPPETALK_ACTION_DEPTH_X,PUPPETALK_ACTION_SEAT_ORDER,
      puppetalkActionSeatAngle,puppetalkActionHomeX,puppetalkActionDepth,puppetalkActionClampDepth,
      puppetalkActionProjectPuppetPoint,puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,
      puppetalkAssistSegmentDistance,puppetalkAssistBodyRadius,puppetalkAssistBodies,driveDepthAssistedProps
    };
  }

  root.PuppetalkDepthAssist = {create};
})(typeof window !== 'undefined' ? window : globalThis);
