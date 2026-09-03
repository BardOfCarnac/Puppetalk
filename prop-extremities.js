// Puppetalk extremity + contact prop pass.
// Feet can grip/throw props, balloons stick on body contact, and moving feet kick balls.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_BALLOON_TIE_V1') || !source.includes('PUPPETALK_TOY_THROW_V1') || source.includes('PUPPETALK_PROP_EXTREMITIES_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_BALLOON_TIE_V1',
      '  // PUPPETALK_BALLOON_TIE_V1\n  // PUPPETALK_PROP_EXTREMITIES_V1'
    );

    // More balloons to make cumulative lift worth exploring.
    source = source.replace(
      "    for(let i=0;i<8;i++) makeProp('balloon',W*(.69+(i%4)*.038),y+18+Math.floor(i/4)*34);",
      "    for(let i=0;i<12;i++) makeProp('balloon',W*(.65+(i%4)*.043),y+10+Math.floor(i/4)*30);"
    );

    const bodyNeedle = `  function handBody(p,hand){ return hand === 'left' ? p.faL : p.faR; }
  function handPoint(p,hand){ return grabWorldPoint(p,hand === 'left' ? 'leftHand' : 'rightHand'); }`;
    const bodyCode = `  function handBody(p,hand){
    if(hand === 'left') return p.faL;
    if(hand === 'right') return p.faR;
    if(hand === 'leftFoot') return p.shL;
    if(hand === 'rightFoot') return p.shR;
    return null;
  }
  function handPoint(p,hand){
    if(hand === 'left') return grabWorldPoint(p,'leftHand');
    if(hand === 'right') return grabWorldPoint(p,'rightHand');
    if(hand === 'leftFoot') return grabWorldPoint(p,'leftFoot');
    if(hand === 'rightFoot') return grabWorldPoint(p,'rightFoot');
    return p?.torso?.position || {x:0,y:0};
  }
  function propGripLocalPoint(hand){
    return hand === 'leftFoot' || hand === 'rightFoot' ? {x:0,y:25} : {x:0,y:23};
  }
  function validPropEffector(hand){
    return hand === 'left' || hand === 'right' || hand === 'leftFoot' || hand === 'rightFoot';
  }`;
    if(!source.includes(bodyNeedle)) throw new Error('Prop extremities patch failed: grip body helpers');
    source = source.replace(bodyNeedle,bodyCode);

    source = source.replace(
      `      bodyA:handBody(p,hand),pointA:{x:0,y:23},`,
      `      bodyA:handBody(p,hand),pointA:propGripLocalPoint(hand),`
    );

    source = source.replace(
      `    if(!prop || (hand !== 'left' && hand !== 'right')) return {ok:false,message:'Tap the object with a nearby hand.'};`,
      `    if(!prop || !validPropEffector(hand)) return {ok:false,message:'Tap the object with a nearby hand or foot.'};`
    );

    source = source.replace(
      `    if(hand !== 'left' && hand !== 'right') return {ok:false,message:'Choose a throwing hand.'};`,
      `    if(!validPropEffector(hand)) return {ok:false,message:'Choose a throwing hand or foot.'};`
    );

    const nearestNeedle = `  function nearestPropHand(prop){
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
  }`;
    const nearestCode = `  function nearestPropHand(prop){
    const mine = myPuppet();
    if(!mine) return null;
    const q = propDisplayPoint(prop);
    const candidates = [
      {hand:'left',point:mine.wl},
      {hand:'right',point:mine.wr},
      {hand:'leftFoot',point:mine.al},
      {hand:'rightFoot',point:mine.ar}
    ];
    let best = null;
    for(const candidate of candidates){
      if(!candidate.point) continue;
      const p = propDisplayPoint(candidate.point);
      const distance = Math.hypot(p.x-q.x,p.y-q.y);
      if(!best || distance < best.distance) best = {hand:candidate.hand,distance};
    }
    if(!best || best.distance > 88) return null;
    return best.hand;
  }`;
    if(!source.includes(nearestNeedle)) throw new Error('Prop extremities patch failed: controller effector picker');
    source = source.replace(nearestNeedle,nearestCode);

    // Held balloons no longer reserve a second tap for tying: contact does the job,
    // and the touch can fall through to the hand/foot underneath like other held props.
    const heldBalloonNeedle = `    if(prop.heldBy?.slot === slot){
      // Held balloons reserve a direct tap for tying. Other held props still pass
      // through to the hand so they can be swung naturally.
      if(prop.type === 'balloon'){
        const hand = prop.heldBy.hand || nearestPropHand(prop);
        if(hand && conn?.open && slot !== null){
          event.preventDefault();
          event.stopImmediatePropagation();
          send(conn,{type:'prop',action:'tap',propId:prop.id,hand});
        }
      }
      return;
    }`;
    if(source.includes(heldBalloonNeedle)) source = source.replace(heldBalloonNeedle,`    if(prop.heldBy?.slot === slot) return;`);

    const throwGrabNeedle = `      if(!grab || (grab.part !== 'leftHand' && grab.part !== 'rightHand')) return;
      const hand = grab.part === 'leftHand' ? 'left' : 'right';`;
    const throwGrabCode = `      if(!grab) return;
      const hand = grab.part === 'leftHand' ? 'left'
        : grab.part === 'rightHand' ? 'right'
        : grab.part === 'leftFoot' ? 'leftFoot'
        : grab.part === 'rightFoot' ? 'rightFoot'
        : null;
      if(!hand) return;`;
    if(!source.includes(throwGrabNeedle)) throw new Error('Prop extremities patch failed: throw effector tracking');
    source = source.replace(throwGrabNeedle,throwGrabCode);

    const initNeedle = `  resize();
  ensureTestProps();
  installDartImpacts();
  requestAnimationFrame(tick);`;
    const initCode = `  function installPropContactPhysics(){
    Matter.Events.on(engine,'collisionStart',event=>{
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'balloon' || prop.attachedTo || prop.contest) continue;
        const target = puppetPartForBody(other);
        if(!target) continue;

        // A balloon being carried should not glue itself straight back onto the
        // exact extremity carrying it, but contact with any other body part sticks.
        if(prop.heldBy){
          const holder = puppets.get(prop.heldBy.slot);
          const heldBody = holder ? handBody(holder,prop.heldBy.hand) : null;
          if(heldBody === target.body) continue;
        }
        const point = closestPointOnBody(target.body,prop.body.position);
        tieBalloonToBody(prop,{...target,point});
      }
    });

    Matter.Events.on(engine,'collisionActive',event=>{
      const now = performance.now();
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'ball' || prop.heldBy || prop.attachedTo) continue;
        const target = puppetPartForBody(other);
        if(!target || (target.part !== 'shL' && target.part !== 'shR')) continue;
        if(now-(prop._lastKickAt||0) < 130) continue;

        const footLocal = {x:0,y:25};
        const r = Vector.rotate(footLocal,other.angle||0);
        const omega = other.angularVelocity || 0;
        const footV = {
          x:(other.velocity?.x||0)-omega*r.y,
          y:(other.velocity?.y||0)+omega*r.x
        };
        const footSpeed = Math.hypot(footV.x,footV.y);
        if(footSpeed < 1.15) continue;

        const current = prop.body.velocity || {x:0,y:0};
        let vx = current.x + footV.x*1.08;
        let vy = current.y + footV.y*1.08;
        const speed = Math.hypot(vx,vy);
        if(speed > 15){
          const k = 15/speed;
          vx *= k; vy *= k;
        }
        Body.setVelocity(prop.body,{x:vx,y:vy});
        Body.setAngularVelocity(prop.body,clamp((prop.body.angularVelocity||0)+omega*.48,-.32,.32));
        prop._lastKickAt = now;
      }
    });
  }

  resize();
  ensureTestProps();
  installDartImpacts();
  installPropContactPhysics();
  requestAnimationFrame(tick);`;
    if(!source.includes(initNeedle)) throw new Error('Prop extremities patch failed: physics install');
    source = source.replace(initNeedle,initCode);

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
