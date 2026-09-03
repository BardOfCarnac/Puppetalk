// Puppetalk item polish pass.
// Makes the frisbee easier to retrieve and replaces pre-spawned balloons with a tap-operated pump.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_LASER_FRISBEE_V1') || source.includes('PUPPETALK_ITEM_POLISH_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_LASER_FRISBEE_V1',
      '  // PUPPETALK_LASER_FRISBEE_V1\n  // PUPPETALK_ITEM_POLISH_V1'
    );

    const bodyNeedle = `    }else if(type === 'frisbee'){
      body = Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004});
      gripPoint = {x:-15,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    const bodyCode = `    }else if(type === 'frisbee'){
      body = Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004});
      gripPoint = {x:-15,y:0};
    }else if(type === 'pump'){
      body = Bodies.rectangle(x,y,44,60,{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});
      gripPoint = {x:0,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    if(!source.includes(bodyNeedle)) throw new Error('Item polish patch failed: pump body');
    source = source.replace(bodyNeedle,bodyCode);

    const spawnNeedle = `    for(let i=0;i<12;i++) makeProp('balloon',W*(.65+(i%4)*.043),y+10+Math.floor(i/4)*30);`;
    const spawnCode = `    makeProp('pump',W*.73,H-68);`;
    if(!source.includes(spawnNeedle)) throw new Error('Item polish patch failed: pump spawn');
    source = source.replace(spawnNeedle,spawnCode);

    const closeNeedle = `  function propHandIsClose(slot,hand,prop){
    const p = puppets.get(slot);
    if(!p) return false;
    const hp = handPoint(p,hand);
    return Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y) <= 86;
  }`;
    const closeCode = `  function propHandIsClose(slot,hand,prop){
    const p = puppets.get(slot);
    if(!p) return false;
    const hp = handPoint(p,hand);
    const speed = Math.hypot(prop?.body?.velocity?.x||0,prop?.body?.velocity?.y||0);
    const reach = prop?.type === 'frisbee' ? (speed < 3.8 ? 122 : 102) : 86;
    return Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y) <= reach;
  }`;
    if(!source.includes(closeNeedle)) throw new Error('Item polish patch failed: frisbee host pickup reach');
    source = source.replace(closeNeedle,closeCode);

    const helperNeedle = `  function driveProps(){`;
    const helperCode = `  function pumpNozzleOffset(scale){
    return {x:0,y:-34-18*Math.max(.34,scale||.34)};
  }
  function ensurePumpBalloon(pump){
    if(!pump || pump.type !== 'pump') return null;
    const existing = pump._balloonId ? props.get(pump._balloonId) : null;
    if(existing) return existing;

    const offset = pumpNozzleOffset(.34);
    const nozzle = worldOffset(pump.body,offset);
    const balloon = makeProp('balloon',nozzle.x,nozzle.y);
    balloon._inflation = 0;
    balloon._renderScale = 1;
    balloon._pumpId = pump.id;
    balloon.attachedTo = {
      mode:'pump',pumpId:pump.id,part:'pump',slot:null,
      body:pump.body,offset,angle:0
    };
    Body.setStatic(balloon.body,true);
    balloon.body.collisionFilter.mask = 0;
    pump._balloonId = balloon.id;
    syncAttachedProp(balloon);
    return balloon;
  }
  function inflatePumpBalloon(pump){
    const balloon = ensurePumpBalloon(pump);
    if(!balloon) return {ok:false,message:'The pump is jammed.'};
    balloon._inflation = (balloon._inflation||0)+1;
    const targetScale = .45+.28*Math.sqrt(balloon._inflation);
    const previousScale = Math.max(.05,balloon._renderScale||1);
    const ratio = targetScale/previousScale;
    Body.scale(balloon.body,ratio,ratio);
    balloon._renderScale = targetScale;
    if(balloon.attachedTo?.mode === 'pump') balloon.attachedTo.offset = pumpNozzleOffset(targetScale);
    syncAttachedProp(balloon);
    pump._lastPumpAt = performance.now();
    return {ok:true,message:'Pump '+balloon._inflation+' — balloon growing.'};
  }
  function releasePumpBalloon(balloon){
    if(!balloon || balloon.type !== 'balloon' || balloon.attachedTo?.mode !== 'pump') return false;
    const pump = props.get(balloon._pumpId || balloon.attachedTo?.pumpId);
    if(pump && pump._balloonId === balloon.id) pump._balloonId = null;
    balloon._pumpId = null;
    detachPropAttachment(balloon);
    Body.setVelocity(balloon.body,{x:(Math.random()-.5)*.35,y:-1.15});
    return true;
  }

${helperNeedle}`;
    if(!source.includes(helperNeedle)) throw new Error('Item polish patch failed: pump helpers');
    source = source.replace(helperNeedle,helperCode);

    const stateNeedle = `      type:prop.type,
      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,
      x:b.position.x/W,`;
    const stateCode = `      type:prop.type,
      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,
      inflation:prop.type === 'balloon' ? (prop._inflation||0) : undefined,
      scale:prop.type === 'balloon' ? (prop._renderScale||1) : undefined,
      pumpBalloon:prop.type === 'pump' ? (prop._balloonId||null) : undefined,
      x:b.position.x/W,`;
    if(!source.includes(stateNeedle)) throw new Error('Item polish patch failed: balloon size state');
    source = source.replace(stateNeedle,stateCode);

    const inputPattern = /  function handlePropInput\(slot,msg\)\{[\s\S]*?\n  \}\n\n  function makePuppet\(slot\)\{/;
    const inputCode = `  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop') return;
    if(msg.action === 'pump'){
      const pump = props.get(msg.propId);
      const result = pump?.type === 'pump' ? inflatePumpBalloon(pump) : {ok:false,message:'That is not a balloon pump.'};
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
      return;
    }
    if(msg.action === 'release-pump-balloon'){
      const balloon = props.get(msg.propId);
      const ok = releasePumpBalloon(balloon);
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,ok,message:ok?'Released balloon.':'That balloon is not on the pump.'});
      return;
    }
    let result = null;
    if(msg.action === 'tap') result = tapProp(slot,msg);
    else if(msg.action === 'throw') result = throwHeldProp(slot,msg);
    if(!result) return;
    send(conns.get(slot),{type:'prop-result',propId:msg.propId || result.propId,...result});
  }

  function makePuppet(slot){`;
    if(!inputPattern.test(source)) throw new Error('Item polish patch failed: pump network input');
    source = source.replace(inputPattern,inputCode);

    const radiusNeedle = `      const radius = prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;`;
    const radiusCode = `      const radius = prop.type === 'frisbee' ? 48 : prop.type === 'pump' ? 44 : prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;`;
    if(!source.includes(radiusNeedle)) throw new Error('Item polish patch failed: item tap radii');
    source = source.replace(radiusNeedle,radiusCode);

    const nearestNeedle = `    if(!best || best.distance > 88) return null;
    return best.hand;`;
    const nearestCode = `    const reach = prop?.type === 'frisbee' ? 118 : 88;
    if(!best || best.distance > reach) return null;
    return best.hand;`;
    if(!source.includes(nearestNeedle)) throw new Error('Item polish patch failed: frisbee controller reach');
    source = source.replace(nearestNeedle,nearestCode);

    const pointerNeedle = `    if(prop.heldBy?.slot === slot) return;

    const hand = nearestPropHand(prop);`;
    const pointerCode = `    if(prop.type === 'pump'){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'pump',propId:prop.id});
      return;
    }
    if(prop.type === 'balloon' && prop.attachedTo?.mode === 'pump'){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'release-pump-balloon',propId:prop.id});
      return;
    }
    if(prop.heldBy?.slot === slot) return;

    const hand = nearestPropHand(prop);`;
    if(!source.includes(pointerNeedle)) throw new Error('Item polish patch failed: direct pump gestures');
    source = source.replace(pointerNeedle,pointerCode);

    const rotateNeedle = `  ctx.translate(x,y);
  ctx.rotate(p.a || 0);
  ctx.lineCap = ctx.lineJoin = 'round';`;
    const rotateCode = `  ctx.translate(x,y);
  ctx.rotate(p.a || 0);
  if(p.type === 'balloon') ctx.scale(Math.max(.22,p.scale||1),Math.max(.22,p.scale||1));
  ctx.lineCap = ctx.lineJoin = 'round';`;
    if(!source.includes(rotateNeedle)) throw new Error('Item polish patch failed: balloon render scale');
    source = source.replace(rotateNeedle,rotateCode);

    source = source.replace(
      `    ctx.moveTo(x,y+15*s);`,
      `    ctx.moveTo(x,y+15*s*Math.max(.22,p.scale||1));`
    );

    const pumpDrawNeedle = `  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();`;
    const pumpDrawCode = `  }else if(p.type === 'pump'){
    ctx.fillStyle='#08090a';roundRect(ctx,-25*s,-33*s,50*s,66*s,7*s);ctx.fill();
    ctx.fillStyle='#d9dde2';roundRect(ctx,-20*s,-28*s,40*s,56*s,5*s);ctx.fill();
    ctx.fillStyle='#181a1e';roundRect(ctx,-12*s,-24*s,24*s,34*s,4*s);ctx.fill();
    ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(0,-30*s);ctx.lineTo(0,-49*s);ctx.stroke();
    ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-18*s,-50*s);ctx.lineTo(18*s,-50*s);ctx.stroke();
    ctx.strokeStyle='#f1c84c';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-15*s,-50*s);ctx.lineTo(15*s,-50*s);ctx.stroke();
    ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(2,3*s);ctx.beginPath();ctx.moveTo(20*s,-18*s);ctx.lineTo(31*s,-29*s);ctx.stroke();
  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();`;
    if(!source.includes(pumpDrawNeedle)) throw new Error('Item polish patch failed: pump renderer');
    source = source.replace(pumpDrawNeedle,pumpDrawCode);

    const liftNeedle = `    const lift = baseLift * speedFade;`;
    const liftCode = `    const balloonScale = Math.max(.35,prop._renderScale||1);
    const lift = baseLift * balloonScale*balloonScale * speedFade;`;
    if(!source.includes(liftNeedle)) throw new Error('Item polish patch failed: pumped balloon buoyancy');
    source = source.replace(liftNeedle,liftCode);

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
