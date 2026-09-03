// Puppetalk physical throw pass.
// A held prop releases only when its controlling hand is flicked and the finger lifts.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_TOY_TAP_V1') || source.includes('PUPPETALK_TOY_THROW_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_TOY_TAP_V1',
      '  // PUPPETALK_TOY_TAP_V1\n  // PUPPETALK_TOY_THROW_V1'
    );

    const handlerNeedle = `  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop' || msg.action !== 'tap') return;
    const result = tapProp(slot,msg);
    send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
  }`;

    const handlerCode = `  function throwHeldProp(slot,msg){
    const hand = msg?.hand;
    if(hand !== 'left' && hand !== 'right') return {ok:false,message:'Choose a throwing hand.'};
    const grip = gripRecord(slot,hand);
    if(!grip) return {ok:false,message:'That hand is not holding anything.'};
    const prop = props.get(grip.propId);
    if(!prop || prop.heldBy?.slot !== slot || prop.heldBy?.hand !== hand) return {ok:false,message:'That prop is no longer held.'};

    const p = puppets.get(slot);
    const hb = p ? handBody(p,hand) : null;
    const handV = hb?.velocity || {x:0,y:0};
    const propV = prop.body.velocity || {x:0,y:0};

    const gestureVX = clamp(Number(msg.vx)||0,-3.2,3.2)*W/60;
    const gestureVY = clamp(Number(msg.vy)||0,-3.2,3.2)*H/60;
    let vx = gestureVX*.72 + handV.x*.42 + propV.x*.34;
    let vy = gestureVY*.72 + handV.y*.42 + propV.y*.34;
    const speed = Math.hypot(vx,vy);
    const maxSpeed = 17;
    if(speed > maxSpeed){
      const k = maxSpeed/speed;
      vx *= k;
      vy *= k;
    }

    const spin = clamp((prop.body.angularVelocity||0)*.8 + (hb?.angularVelocity||0)*.55 + gestureVX*.018,-.34,.34);
    releasePropHolder(prop,false);
    Body.setVelocity(prop.body,{x:vx,y:vy});
    Body.setAngularVelocity(prop.body,spin);
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};
  }

  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop') return;
    let result = null;
    if(msg.action === 'tap') result = tapProp(slot,msg);
    else if(msg.action === 'throw') result = throwHeldProp(slot,msg);
    if(!result) return;
    send(conns.get(slot),{type:'prop-result',propId:msg.propId || result.propId,...result});
  }`;

    if(!source.includes(handlerNeedle)) throw new Error('Toy throw patch failed: prop handler');
    source = source.replace(handlerNeedle,handlerCode);

    const throwCode = `  const throwGestures = new Map();
  const THROW_SAMPLE_MS = 145;
  const THROW_MIN_SPEED = .62;
  function sampleThrowGesture(gesture,x,y,now){
    gesture.samples.push({x,y,t:now});
    const cutoff = now-THROW_SAMPLE_MS*1.8;
    while(gesture.samples.length > 2 && gesture.samples[0].t < cutoff) gesture.samples.shift();
    if(gesture.samples.length > 10) gesture.samples.splice(0,gesture.samples.length-10);
  }
  function releaseVector(gesture,x,y,now){
    sampleThrowGesture(gesture,x,y,now);
    const samples = gesture.samples;
    let start = samples[0];
    for(const s of samples){
      if(now-s.t <= THROW_SAMPLE_MS) { start = s; break; }
    }
    const dt = Math.max(.035,(now-start.t)/1000);
    return {vx:(x-start.x)/dt,vy:(y-start.y)/dt};
  }

  canvas.addEventListener('pointerdown',event=>{
    queueMicrotask(()=>{
      const grab = activePointers.get(event.pointerId);
      if(!grab || (grab.part !== 'leftHand' && grab.part !== 'rightHand')) return;
      const hand = grab.part === 'leftHand' ? 'left' : 'right';
      if(!heldProp(hand)) return;
      const now = performance.now();
      throwGestures.set(event.pointerId,{hand,samples:[{x:grab.x,y:grab.y,t:now}]});
    });
  });

  canvas.addEventListener('pointermove',event=>{
    const gesture = throwGestures.get(event.pointerId);
    if(!gesture) return;
    const p = pointerToWorld(event);
    sampleThrowGesture(gesture,p.x,p.y,performance.now());
  });

  function finishThrow(event){
    const gesture = throwGestures.get(event.pointerId);
    if(!gesture) return;
    throwGestures.delete(event.pointerId);
    if(!heldProp(gesture.hand) || !conn?.open || slot === null) return;
    const p = pointerToWorld(event);
    const v = releaseVector(gesture,p.x,p.y,performance.now());
    const speed = Math.hypot(v.vx,v.vy);
    if(speed < THROW_MIN_SPEED) return;
    send(conn,{type:'prop',action:'throw',hand:gesture.hand,vx:v.vx,vy:v.vy});
  }
  canvas.addEventListener('pointerup',finishThrow);
  canvas.addEventListener('pointercancel',event=>throwGestures.delete(event.pointerId));`;

    const poseNeedle = `  document.querySelector('#poses').addEventListener('click',event=>{`;
    if(!source.includes(poseNeedle)) throw new Error('Toy throw patch failed: controller insertion point');
    source = source.replace(poseNeedle,`${throwCode}\n\n${poseNeedle}`);

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
