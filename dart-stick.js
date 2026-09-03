// Puppetalk sticky dart pass.
// Adds a generic body-relative prop attachment primitive and uses it for darts.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_TOY_SYSTEM_V1') || !source.includes('PUPPETALK_TOY_TAP_V1') || source.includes('PUPPETALK_DART_STICK_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_TOY_TAP_V1',
      '  // PUPPETALK_TOY_TAP_V1\n  // PUPPETALK_DART_STICK_V1'
    );

    source = source.replace(
      '    const prop = {id,type,body,gripPoint,heldBy:null,contest:null};',
      '    const prop = {id,type,body,gripPoint,heldBy:null,contest:null,attachedTo:null};'
    );

    source = source.replace(
      `    makeProp('ball',W*.39,y);
    makeProp('dart',W*.55,y+22);
    makeProp('balloon',W*.69,y+46);`,
      `    makeProp('ball',W*.34,y);
    for(let i=0;i<6;i++) makeProp('dart',W*(.45+i*.045),y+18+(i%2)*20);
    makeProp('balloon',W*.76,y+46);`
    );

    const helperNeedle = `  function handBody(p,hand){ return hand === 'left' ? p.faL : p.faR; }
  function handPoint(p,hand){ return grabWorldPoint(p,hand === 'left' ? 'leftHand' : 'rightHand'); }
  const gripKey = (slot,hand)=>\`\${slot}:\${hand}\`;`;

    const helperCode = `  function handBody(p,hand){ return hand === 'left' ? p.faL : p.faR; }
  function handPoint(p,hand){ return grabWorldPoint(p,hand === 'left' ? 'leftHand' : 'rightHand'); }
  const gripKey = (slot,hand)=>\`\${slot}:\${hand}\`;

  const ATTACHABLE_PARTS = ['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR'];
  function puppetPartForBody(body){
    if(!body) return null;
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        if(p[part] === body) return {slot:p.slot,part,body};
      }
    }
    return null;
  }
  function propForBody(body){
    for(const prop of props.values()) if(prop.body === body) return prop;
    return null;
  }
  function localOffset(body,world){
    return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);
  }
  function worldOffset(body,local){
    const r = Vector.rotate(local,body.angle);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }
  function attachPropToBody(prop,target){
    if(!prop || !target?.body || prop.attachedTo) return false;
    cancelPropContest(prop);
    if(prop.heldBy) releasePropHolder(prop,false);
    prop.attachedTo = {
      slot:target.slot,
      part:target.part,
      body:target.body,
      offset:localOffset(target.body,prop.body.position),
      angle:(prop.body.angle||0)-(target.body.angle||0)
    };
    Body.setStatic(prop.body,true);
    prop.body.collisionFilter.mask = 0;
    return true;
  }
  function detachPropAttachment(prop){
    const a = prop?.attachedTo;
    if(!a) return false;
    const inherited = a.body?.velocity ? {x:a.body.velocity.x,y:a.body.velocity.y} : {x:0,y:0};
    prop.attachedTo = null;
    prop.body.collisionFilter.mask = 0xFFFFFFFF;
    Body.setStatic(prop.body,false);
    Body.setVelocity(prop.body,inherited);
    return true;
  }
  function syncAttachedProp(prop){
    const a = prop?.attachedTo;
    if(!a?.body) return;
    Body.setPosition(prop.body,worldOffset(a.body,a.offset));
    Body.setAngle(prop.body,(a.body.angle||0)+a.angle);
  }
  function installDartImpacts(){
    Matter.Events.on(engine,'collisionStart',event=>{
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'dart' || prop.heldBy || prop.contest || prop.attachedTo) continue;
        const target = puppetPartForBody(other);
        if(!target) continue;
        const rvx = (prop.body.velocity?.x||0)-(other.velocity?.x||0);
        const rvy = (prop.body.velocity?.y||0)-(other.velocity?.y||0);
        const relativeSpeed = Math.hypot(rvx,rvy);
        if(relativeSpeed < 2.15) continue;
        attachPropToBody(prop,target);
      }
    });
  }`;

    if(!source.includes(helperNeedle)) throw new Error('Dart stick patch failed: attachment helpers');
    source = source.replace(helperNeedle,helperCode);

    source = source.replace(
      '      updatePropContest(prop,now);',
      `      updatePropContest(prop,now);
      syncAttachedProp(prop);`
    );

    source = source.replace(
      `      contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,
      tug:prop.contest ? clamp(prop.contest.score,0,1) : 0`,
      `      contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,
      tug:prop.contest ? clamp(prop.contest.score,0,1) : 0,
      attachedTo:prop.attachedTo ? {slot:prop.attachedTo.slot,part:prop.attachedTo.part} : null`
    );

    const tapNeedle = `    const now = performance.now();

    if(!prop.heldBy){`;
    const tapCode = `    const now = performance.now();

    if(prop.attachedTo){
      if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
      detachPropAttachment(prop);
      if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Pulled it free, but could not hold it.'};
      return {ok:true,message:'Pulled the '+prop.type+' free.'};
    }

    if(!prop.heldBy){`;
    if(!source.includes(tapNeedle)) throw new Error('Dart stick patch failed: pull-free interaction');
    source = source.replace(tapNeedle,tapCode);

    source = source.replace(
      `  resize();
  ensureTestProps();
  requestAnimationFrame(tick);`,
      `  resize();
  ensureTestProps();
  installDartImpacts();
  requestAnimationFrame(tick);`
    );

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
