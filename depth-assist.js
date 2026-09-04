// Puppetalk 2.5D interaction pass.
// Props keep an independent shallow depth after release. Clear screen-space intent is
// reconciled toward nearby physical targets without exposing a Z-axis control to players.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_SEAT_RENDER_V1') || source.includes('PUPPETALK_DEPTH_ASSIST_V1')) return source;
    source = source.replace(
      '  // PUPPETALK_SEAT_RENDER_V1',
      '  // PUPPETALK_SEAT_RENDER_V1\n  // PUPPETALK_DEPTH_ASSIST_V1'
    );

    const throwNeedle = `    releasePropHolder(prop,false);\n    Body.setVelocity(prop.body,{x:vx,y:vy});`;
    const throwCode = `    prop._throwerSlot = slot;
    prop._depth = window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0;
    prop._depthAssistUntil = performance.now()+1750;
    prop._assistPrevScreen = null;
    releasePropHolder(prop,false);
    Body.setVelocity(prop.body,{x:vx,y:vy});`;
    if(!source.includes(throwNeedle)) throw new Error('Depth assist patch failed: throw depth state');
    source = source.replace(throwNeedle,throwCode);

    const holdNeedle = `  function beginPropHold(prop,slot,hand){\n`;
    const holdCode = `  function beginPropHold(prop,slot,hand){
    prop._throwerSlot = null;
    prop._depth = null;
    prop._depthAssistUntil = 0;
    prop._assistPrevScreen = null;
`;
    if(!source.includes(holdNeedle)) throw new Error('Depth assist patch failed: pickup reset');
    source = source.replace(holdNeedle,holdCode);

    const stateNeedle = `      type:prop.type,\n      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,`;
    const stateCode = `      type:prop.type,
      depth:Number.isFinite(prop._depth) ? prop._depth : undefined,
      throwerSlot:Number.isInteger(prop._throwerSlot) ? prop._throwerSlot : undefined,
      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,`;
    if(!source.includes(stateNeedle)) throw new Error('Depth assist patch failed: prop depth scene state');
    source = source.replace(stateNeedle,stateCode);

    const helperNeedle = `  function driveProps(){`;
    const helpers = `  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;
  const PUPPETALK_ACTION_SCREEN_PAD = 15;
  const PUPPETALK_ACTION_DEPTH_X = .28;
  const PUPPETALK_ACTION_SEAT_ORDER = [0,3,1,4,2,5];

  function puppetalkActionSeatAngle(slot){
    const seat=PUPPETALK_ACTION_SEAT_ORDER[slot] ?? slot ?? 0;
    return seat*Math.PI/3;
  }
  function puppetalkActionHomeX(slot){ return .16+slot*.135; }
  function puppetalkActionDepth(slot){
    return Number.isInteger(slot) ? (window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0) : 0;
  }
  function puppetalkActionClampDepth(depth){
    const tuning=window.PuppetalkForegroundTuning;
    const lo=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
    const hi=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
    return clamp(depth,lo,hi);
  }
  function puppetalkActionProjectPuppetPoint(p,q,viewerSlot){
    if(!p?.torso || !q || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return null;
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
    const scale=window.PuppetalkDepthState?.scaleForDepth?.(viewDepth) || 1;
    const shift=(window.PuppetalkDepthState?.shiftForDepth?.(viewDepth) || 0)*H;
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
    const shift=(window.PuppetalkDepthState?.shiftForDepth?.(viewDepth) || 0)*H;
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

      // The frisbee's swept cut test consumes the same projected path directly. Other
      // thrown props get a small physical reconciliation so Matter can deliver the bounce,
      // stick, or knock that the player visibly aimed for.
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

${helperNeedle}`;
    if(!source.includes(helperNeedle)) throw new Error('Depth assist patch failed: stage helpers');
    source = source.replace(helperNeedle,helpers);

    const tickNeedle = `    driveLaserFrisbeeCuts(now);`;
    const tickCode = `    driveDepthAssistedProps(now);
    driveLaserFrisbeeCuts(now);`;
    if(!source.includes(tickNeedle)) throw new Error('Depth assist patch failed: assist tick');
    source = source.replace(tickNeedle,tickCode);

    const frisbeePathNeedle = `      const current = {x:b.position.x,y:b.position.y};\n      const previous = prop._frisbeePrev || current;\n      prop._frisbeePrev = current;`;
    const frisbeePathCode = `      const current = puppetalkAimProjectPropPoint(prop,prop._throwerSlot);
      const previous = prop._frisbeePrev || current;
      prop._frisbeePrev = current;`;
    if(!source.includes(frisbeePathNeedle)) throw new Error('Depth assist patch failed: frisbee projected sweep');
    source = source.replace(frisbeePathNeedle,frisbeePathCode);

    const initialFrisbeeNeedle = `      prop._frisbeePrev = {x:prop.body.position.x,y:prop.body.position.y};`;
    const initialFrisbeeCode = `      prop._frisbeePrev = puppetalkAimProjectPropPoint(prop,slot);`;
    if(!source.includes(initialFrisbeeNeedle)) throw new Error('Depth assist patch failed: frisbee initial projected point');
    source = source.replace(initialFrisbeeNeedle,initialFrisbeeCode);

    const jointPointNeedle = `            const q = jointCutPoint(constraint);\n            if(!q) continue;\n            const distance = pointSegmentDistance(q,previous,current);`;
    const jointPointCode = `            const qRaw = jointCutPoint(constraint);
            if(!qRaw) continue;
            const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
            const distance = pointSegmentDistance(q,previous,current);`;
    if(!source.includes(jointPointNeedle)) throw new Error('Depth assist patch failed: projected joint cuts');
    source = source.replace(jointPointNeedle,jointPointCode);

    const seamPointNeedle = `            const q = seamCutPoint(p,name);\n            if(!q) continue;\n            const distance = pointSegmentDistance(q,previous,current);`;
    const seamPointCode = `            const qRaw = seamCutPoint(p,name);
            if(!qRaw) continue;
            const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
            const distance = pointSegmentDistance(q,previous,current);`;
    if(!source.includes(seamPointNeedle)) throw new Error('Depth assist patch failed: projected seam cuts');
    source = source.replace(seamPointNeedle,seamPointCode);

    const projectSignatureNeedle = `function puppetalkProjectProp(prop,metaBySlot){`;
    if(!source.includes(projectSignatureNeedle)) throw new Error('Depth assist patch failed: prop projection signature');
    source = source.replace(projectSignatureNeedle,`function puppetalkProjectProp(prop,metaBySlot,viewerSlot){`);

    const projectOpeningNeedle = `function puppetalkProjectProp(prop,metaBySlot,viewerSlot){\n  if(!prop || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return prop;`;
    const projectOpeningCode = `function puppetalkProjectProp(prop,metaBySlot,viewerSlot){
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
    const tuning=window.PuppetalkForegroundTuning;
    const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
    const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
    const viewDepth=Math.max(minDepth,Math.min(maxDepth,viewForward/PUPPETALK_DEPTH_X));
    const depthApi=window.PuppetalkDepthState;
    return {
      ...prop,
      x:puppetalkHomeX(owner)+viewSide,
      y:prop.y+(depthApi?.shiftForDepth?.(viewDepth)||0),
      viewDepth,
      viewScale:depthApi?.scaleForDepth?.(viewDepth)||1
    };
  }`;
    if(!source.includes(projectOpeningNeedle)) throw new Error('Depth assist patch failed: independent prop projection');
    source = source.replace(projectOpeningNeedle,projectOpeningCode);

    const projectCallNeedle = `return {puppets:projected,props:(props||[]).map(prop=>puppetalkProjectProp(prop,metaBySlot))};`;
    const projectCallCode = `return {puppets:projected,props:(props||[]).map(prop=>puppetalkProjectProp(prop,metaBySlot,viewerSlot))};`;
    if(!source.includes(projectCallNeedle)) throw new Error('Depth assist patch failed: viewer-aware prop projection');
    source = source.replace(projectCallNeedle,projectCallCode);

    const renderScaleNeedle = `  const s = Math.max(.72,scale*1.9);`;
    const renderScaleCode = `  const s = Math.max(.72,scale*1.9)*(Number.isFinite(p.viewScale)?p.viewScale:1);`;
    if(!source.includes(renderScaleNeedle)) throw new Error('Depth assist patch failed: prop depth render scale');
    source = source.replace(renderScaleNeedle,renderScaleCode);

    return source;
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
