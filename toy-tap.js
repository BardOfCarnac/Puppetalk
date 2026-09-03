// Puppetalk prop interaction pass.
// Replaces grip buttons with tap-to-grab and makes stealing a repeated-tap physical tug.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_TOY_SYSTEM_V1') || source.includes('PUPPETALK_TOY_TAP_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_TOY_SYSTEM_V1',
      '  // PUPPETALK_TOY_SYSTEM_V1\n  // PUPPETALK_TOY_TAP_V1'
    );

    source = source.replace(
      '    const prop = {id,type,body,gripPoint,heldBy:null};',
      '    const prop = {id,type,body,gripPoint,heldBy:null,contest:null};'
    );

    const drivePattern = /  function driveProps\(\)\{[\s\S]*?\n  \}\n\n  function propState\(prop\)\{[\s\S]*?\n  \}\n\n  function handBody/;
    const driveCode = `  function updatePropContest(prop,now){
    const tug = prop.contest;
    if(!tug || !prop.heldBy) return;
    const holder = propGrips.get(gripKey(prop.heldBy.slot,prop.heldBy.hand));
    if(!holder){ cancelPropContest(prop); return; }
    const dt = Math.max(0,Math.min(.08,(now-tug.lastUpdateAt)/1000));
    tug.lastUpdateAt = now;
    if(now-tug.lastTapAt > 260) tug.score = Math.max(0,tug.score-dt*.12);
    tug.score = clamp(tug.score,0,1.05);
    holder.constraint.stiffness = .86-tug.score*.58;
    tug.constraint.stiffness = .14+tug.score*.72;
    if(tug.score >= 1){ promotePropContest(prop); return; }
    if(tug.score <= 0 && now-tug.lastTapAt > 700) cancelPropContest(prop);
  }

  function driveProps(){
    const now = performance.now();
    props.forEach(prop=>{
      if(prop.type === 'balloon'){
        const b = prop.body;
        Body.applyForce(b,b.position,{x:0,y:-b.mass*engine.gravity.y*engine.gravity.scale*1.42});
      }
      updatePropContest(prop,now);
    });
  }

  function propState(prop){
    const b = prop.body;
    return {
      id:prop.id,
      type:prop.type,
      x:b.position.x/W,
      y:b.position.y/H,
      a:b.angle || 0,
      heldBy:prop.heldBy ? {slot:prop.heldBy.slot,hand:prop.heldBy.hand} : null,
      contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,
      tug:prop.contest ? clamp(prop.contest.score,0,1) : 0
    };
  }

  function handBody`;
    if(!drivePattern.test(source)) throw new Error('Toy tap patch failed: contest simulation');
    source = source.replace(drivePattern,driveCode);

    const gripPattern = /  function releasePropGrip\(slot,hand\)\{[\s\S]*?\n  \}\n\n  function makePuppet\(slot\)\{/;
    const gripCode = `  function gripRecord(slot,hand){ return propGrips.get(gripKey(slot,hand)); }
  function freePropHand(slot,hand,propId=null){
    const held = gripRecord(slot,hand);
    return !held || held.propId === propId;
  }
  function clearPropGrip(slot,hand){
    const key = gripKey(slot,hand);
    const grip = propGrips.get(key);
    if(!grip) return null;
    Composite.remove(engine.world,grip.constraint);
    propGrips.delete(key);
    return grip;
  }
  function makePropGrip(prop,slot,hand,stiffness,role){
    const p = puppets.get(slot);
    if(!p || !freePropHand(slot,hand,prop.id)) return null;
    const constraint = Constraint.create({
      bodyA:handBody(p,hand),pointA:{x:0,y:23},
      bodyB:prop.body,pointB:prop.gripPoint || {x:0,y:0},
      length:3,stiffness,damping:.19
    });
    Composite.add(engine.world,constraint);
    const grip = {propId:prop.id,constraint,role};
    propGrips.set(gripKey(slot,hand),grip);
    return grip;
  }
  function cancelPropContest(prop){
    const tug = prop?.contest;
    if(!tug) return;
    clearPropGrip(tug.slot,tug.hand);
    prop.contest = null;
    const holder = prop.heldBy && gripRecord(prop.heldBy.slot,prop.heldBy.hand);
    if(holder) holder.constraint.stiffness = .88;
  }
  function promotePropContest(prop){
    const tug = prop?.contest;
    if(!tug) return false;
    if(prop.heldBy) clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
    tug.constraint.stiffness = .88;
    const record = gripRecord(tug.slot,tug.hand);
    if(record) record.role = 'holder';
    prop.heldBy = {slot:tug.slot,hand:tug.hand};
    prop.contest = null;
    return true;
  }
  function releasePropHolder(prop,promote=false){
    if(!prop?.heldBy) return;
    clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
    prop.heldBy = null;
    if(promote && prop.contest) promotePropContest(prop);
    else cancelPropContest(prop);
  }
  function beginPropHold(prop,slot,hand){
    const grip = makePropGrip(prop,slot,hand,.88,'holder');
    if(!grip) return false;
    prop.heldBy = {slot,hand};
    return true;
  }
  function beginPropContest(prop,slot,hand,now){
    const grip = makePropGrip(prop,slot,hand,.17,'contest');
    if(!grip) return false;
    prop.contest = {slot,hand,constraint:grip.constraint,score:.18,lastTapAt:now,lastUpdateAt:now};
    return true;
  }
  function propHandIsClose(slot,hand,prop){
    const p = puppets.get(slot);
    if(!p) return false;
    const hp = handPoint(p,hand);
    return Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y) <= 86;
  }
  function tapProp(slot,msg){
    const prop = props.get(msg?.propId);
    const hand = msg?.hand;
    if(!prop || (hand !== 'left' && hand !== 'right')) return {ok:false,message:'Tap the object with a nearby hand.'};
    if(!propHandIsClose(slot,hand,prop)) return {ok:false,message:'Move a hand a little closer first.'};
    const now = performance.now();

    if(!prop.heldBy){
      if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
      if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Could not get hold of it.'};
      return {ok:true,message:'Picked up '+prop.type+'.'};
    }

    if(prop.heldBy.slot === slot){
      if(prop.contest){
        prop.contest.score = Math.max(0,prop.contest.score-.19);
        prop.contest.lastTapAt = now;
        prop.contest.lastUpdateAt = now;
        if(prop.contest.score <= .01) cancelPropContest(prop);
        return {ok:true,message:'Held your ground.'};
      }
      releasePropHolder(prop,false);
      return {ok:true,message:'Dropped '+prop.type+'.'};
    }

    if(prop.contest){
      if(prop.contest.slot !== slot) return {ok:false,message:'Someone else is already tugging at it.'};
      if(prop.contest.hand !== hand) return {ok:false,message:'Keep using the same hand for this tug.'};
      prop.contest.score = Math.min(1.05,prop.contest.score+.19);
      prop.contest.lastTapAt = now;
      prop.contest.lastUpdateAt = now;
      if(prop.contest.score >= 1){
        promotePropContest(prop);
        return {ok:true,message:'Pulled the '+prop.type+' free.'};
      }
      return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
    }

    if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
    if(!beginPropContest(prop,slot,hand,now)) return {ok:false,message:'Could not get a grip on it.'};
    return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
  }
  function releaseAllPropGrips(slot){
    props.forEach(prop=>{
      if(prop.contest?.slot === slot) cancelPropContest(prop);
      if(prop.heldBy?.slot === slot) releasePropHolder(prop,true);
    });
  }
  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop' || msg.action !== 'tap') return;
    const result = tapProp(slot,msg);
    send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
  }

  function makePuppet(slot){`;
    if(!gripPattern.test(source)) throw new Error('Toy tap patch failed: grip interaction');
    source = source.replace(gripPattern,gripCode);

    // Grip is now a scene gesture, not controller chrome.
    source = source.replace('        <button id="grip-left" type="button">Grip L</button>\n','');
    source = source.replace('        <button id="grip-right" type="button">Grip R</button>\n','');

    const pointerNeedle = `  canvas.addEventListener('pointercancel',stopDrag);`;
    const pointerCode = `  canvas.addEventListener('pointercancel',stopDrag);

  function propDisplayPoint(q){
    return typeof displayPoint === 'function' ? displayPoint(q,cw,ch) : {x:q.x*cw,y:q.y*ch};
  }
  function pickTappedProp(event){
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX-rect.left;
    const py = event.clientY-rect.top;
    let best = null;
    for(const prop of propScene){
      const q = propDisplayPoint(prop);
      const radius = prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;
      const distance = Math.hypot(px-q.x,py-q.y);
      if(distance <= radius && (!best || distance < best.distance)) best = {prop,distance};
    }
    return best?.prop || null;
  }
  function nearestPropHand(prop){
    const mine = myPuppet();
    if(!mine) return null;
    const q = propDisplayPoint(prop);
    const left = propDisplayPoint(mine.wl);
    const right = propDisplayPoint(mine.wr);
    const dl = Math.hypot(left.x-q.x,left.y-q.y);
    const dr = Math.hypot(right.x-q.x,right.y-q.y);
    const distance = Math.min(dl,dr);
    if(distance > 88) return null;
    return dl <= dr ? 'left' : 'right';
  }
  canvas.addEventListener('pointerdown',event=>{
    const prop = pickTappedProp(event);
    if(!prop) return;
    const hand = nearestPropHand(prop);
    if(!hand) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(conn?.open && slot !== null) send(conn,{type:'prop',action:'tap',propId:prop.id,hand});
  },true);`;
    if(!source.includes(pointerNeedle)) throw new Error('Toy tap patch failed: pointer gesture');
    source = source.replace(pointerNeedle,pointerCode);

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
