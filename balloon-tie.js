// Puppetalk balloon attachment pass.
// Lets held balloons be tied to puppet body parts, with lift fed back into the ragdoll.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_DART_STICK_V1') || source.includes('PUPPETALK_BALLOON_TIE_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_DART_STICK_V1',
      '  // PUPPETALK_DART_STICK_V1\n  // PUPPETALK_BALLOON_TIE_V1'
    );

    source = source.replace(
      "    makeProp('balloon',W*.76,y+46);",
      "    for(let i=0;i<8;i++) makeProp('balloon',W*(.69+(i%4)*.038),y+18+Math.floor(i/4)*34);"
    );

    const helperNeedle = `  function propForBody(body){
    for(const prop of props.values()) if(prop.body === body) return prop;
    return null;
  }`;

    const helperCode = `  function propForBody(body){
    for(const prop of props.values()) if(prop.body === body) return prop;
    return null;
  }
  function closestPointOnBody(body,point){
    if(!body?.bounds) return {x:body.position.x,y:body.position.y};
    return {
      x:clamp(point.x,body.bounds.min.x,body.bounds.max.x),
      y:clamp(point.y,body.bounds.min.y,body.bounds.max.y)
    };
  }
  function nearestBalloonTarget(prop,slot,hand){
    const owner = puppets.get(slot);
    const heldBody = owner ? handBody(owner,hand) : null;
    let best = null;
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        const body = p[part];
        if(!body || body === heldBody) continue;
        const hit = closestPointOnBody(body,prop.body.position);
        const distance = Math.hypot(prop.body.position.x-hit.x,prop.body.position.y-hit.y);
        if(distance <= 46 && (!best || distance < best.distance)){
          best = {slot:p.slot,part,body,point:hit,distance};
        }
      }
    }
    return best;
  }
  function tieBalloonToBody(prop,target){
    if(!prop || prop.type !== 'balloon' || !target?.body || prop.attachedTo) return false;
    cancelPropContest(prop);
    if(prop.heldBy) releasePropHolder(prop,false);
    const numeric = Number(String(prop.id).replace(/\D+/g,'')) || 1;
    prop.attachedTo = {
      slot:target.slot,
      part:target.part,
      body:target.body,
      offset:localOffset(target.body,target.point || target.body.position),
      angle:0,
      mode:'balloon',
      stringLength:58+(numeric%3)*6,
      phase:numeric*.83
    };
    Body.setStatic(prop.body,true);
    prop.body.collisionFilter.mask = 0;
    syncAttachedProp(prop);
    return true;
  }
  function driveAttachedBalloon(prop,now){
    const a = prop?.attachedTo;
    if(prop?.type !== 'balloon' || a?.mode !== 'balloon' || !a.body) return;
    const anchor = worldOffset(a.body,a.offset);
    // Around six balloons can overcome a standing puppet's total weight; one should
    // mainly tug at its individual limb/body segment.
    const lift = .00305;
    const sway = Math.sin(now*.0016+(a.phase||0))*.00032;
    Body.applyForce(a.body,anchor,{x:sway,y:-lift});
  }
  function balloonAttachmentState(prop){
    const a = prop?.attachedTo;
    if(!a) return null;
    const anchor = a.body ? worldOffset(a.body,a.offset) : null;
    return {
      slot:a.slot,
      part:a.part,
      mode:a.mode || 'embedded',
      anchor:anchor ? {x:anchor.x/W,y:anchor.y/H} : null
    };
  }`;

    if(!source.includes(helperNeedle)) throw new Error('Balloon tie patch failed: target helpers');
    source = source.replace(helperNeedle,helperCode);

    const syncNeedle = `  function syncAttachedProp(prop){
    const a = prop?.attachedTo;
    if(!a?.body) return;
    Body.setPosition(prop.body,worldOffset(a.body,a.offset));
    Body.setAngle(prop.body,(a.body.angle||0)+a.angle);
  }`;

    const syncCode = `  function syncAttachedProp(prop){
    const a = prop?.attachedTo;
    if(!a?.body) return;
    if(a.mode === 'balloon'){
      const anchor = worldOffset(a.body,a.offset);
      const now = performance.now();
      const sway = Math.sin(now*.0016+(a.phase||0))*7;
      Body.setPosition(prop.body,{x:anchor.x+sway,y:anchor.y-(a.stringLength||62)});
      Body.setAngle(prop.body,Math.sin(now*.0013+(a.phase||0))*.06);
      return;
    }
    Body.setPosition(prop.body,worldOffset(a.body,a.offset));
    Body.setAngle(prop.body,(a.body.angle||0)+a.angle);
  }`;

    if(!source.includes(syncNeedle)) throw new Error('Balloon tie patch failed: attachment sync');
    source = source.replace(syncNeedle,syncCode);

    source = source.replace(
      `      updatePropContest(prop,now);
      syncAttachedProp(prop);`,
      `      updatePropContest(prop,now);
      driveAttachedBalloon(prop,now);
      syncAttachedProp(prop);`
    );

    source = source.replace(
      `      attachedTo:prop.attachedTo ? {slot:prop.attachedTo.slot,part:prop.attachedTo.part} : null`,
      `      attachedTo:balloonAttachmentState(prop)`
    );

    const heldNeedle = `    if(prop.heldBy.slot === slot){
      if(prop.contest){`;
    const heldCode = `    if(prop.heldBy.slot === slot){
      if(prop.type === 'balloon' && !prop.contest){
        const target = nearestBalloonTarget(prop,slot,hand);
        if(target && tieBalloonToBody(prop,target)){
          return {ok:true,message:'Tied balloon to '+target.part+'.'};
        }
      }
      if(prop.contest){`;

    if(!source.includes(heldNeedle)) throw new Error('Balloon tie patch failed: tap-to-tie interaction');
    source = source.replace(heldNeedle,heldCode);

    source = source.replace(
      `    releaseAllPropGrips(slot);
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));`,
      `    releaseAllPropGrips(slot);
    props.forEach(prop=>{ if(prop.attachedTo?.slot === slot) detachPropAttachment(prop); });
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));`
    );

    const drawNeedle = `  const x = projected.x;
  const y = projected.y;
  const s = Math.max(.72,scale*1.9);
  ctx.save();`;
    const drawCode = `  const x = projected.x;
  const y = projected.y;
  const s = Math.max(.72,scale*1.9);
  if(p.type === 'balloon' && p.attachedTo?.mode === 'balloon' && p.attachedTo.anchor){
    const anchor = typeof displayPoint === 'function' ? displayPoint(p.attachedTo.anchor,w,h) : {x:p.attachedTo.anchor.x*w,y:p.attachedTo.anchor.y*h};
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,.48)';
    ctx.lineWidth=Math.max(1,s);
    ctx.beginPath();
    ctx.moveTo(x,y+15*s);
    ctx.quadraticCurveTo((x+anchor.x)*.5+7*s,(y+anchor.y)*.5,x:anchor.x,y:anchor.y);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();`;

    if(!source.includes(drawNeedle)) throw new Error('Balloon tie patch failed: tether drawing hook');
    source = source.replace(drawNeedle,drawCode.replace('x:anchor.x,y:anchor.y','anchor.x,anchor.y'));

    const looseString = `    ctx.strokeStyle = 'rgba(255,255,255,.45)';ctx.lineWidth = Math.max(1,s);
    ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();`;
    const looseStringCode = `    if(!p.attachedTo?.anchor){
      ctx.strokeStyle = 'rgba(255,255,255,.45)';ctx.lineWidth = Math.max(1,s);
      ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();
    }`;
    if(!source.includes(looseString)) throw new Error('Balloon tie patch failed: loose balloon string');
    source = source.replace(looseString,looseStringCode);

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
