// Puppetalk laser frisbee pass.
// A throw can sever at most one joint, and only while the disc is fast, spinning, and actually sweeps a joint.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_SEVERABLE_JOINTS_V1') || source.includes('PUPPETALK_LASER_FRISBEE_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_SEVERABLE_JOINTS_V1',
      '  // PUPPETALK_SEVERABLE_JOINTS_V1\n  // PUPPETALK_LASER_FRISBEE_V1'
    );

    const bodyNeedle = `    }else if(type === 'balloon'){
      body = Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    const bodyCode = `    }else if(type === 'balloon'){
      body = Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
    }else if(type === 'frisbee'){
      body = Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004});
      gripPoint = {x:-15,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    if(!source.includes(bodyNeedle)) throw new Error('Laser frisbee patch failed: prop body');
    source = source.replace(bodyNeedle,bodyCode);

    const spawnNeedle = `    for(let i=0;i<6;i++) makeProp('dart',W*(.45+i*.045),y+18+(i%2)*20);`;
    const spawnCode = `    for(let i=0;i<6;i++) makeProp('dart',W*(.45+i*.045),y+18+(i%2)*20);
    makeProp('frisbee',W*.59,y-34);`;
    if(!source.includes(spawnNeedle)) throw new Error('Laser frisbee patch failed: test spawn');
    source = source.replace(spawnNeedle,spawnCode);

    const holdNeedle = `  function beginPropHold(prop,slot,hand){
    const grip = makePropGrip(prop,slot,hand,.88,'holder');
    if(!grip) return false;
    prop.heldBy = {slot,hand};`;
    const holdCode = `  function beginPropHold(prop,slot,hand){
    const grip = makePropGrip(prop,slot,hand,.88,'holder');
    if(!grip) return false;
    if(prop.type === 'frisbee'){
      prop._cutArmed = false;
      prop._thrownAt = 0;
      prop._frisbeePrev = null;
    }
    prop.heldBy = {slot,hand};`;
    if(!source.includes(holdNeedle)) throw new Error('Laser frisbee patch failed: pickup disarm');
    source = source.replace(holdNeedle,holdCode);

    const throwNeedle = `    releasePropHolder(prop,false);
    Body.setVelocity(prop.body,{x:vx,y:vy});
    Body.setAngularVelocity(prop.body,spin);
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};`;
    const throwCode = `    releasePropHolder(prop,false);
    Body.setVelocity(prop.body,{x:vx,y:vy});
    if(prop.type === 'frisbee'){
      const direction = Math.sign(vx || 1);
      Body.setAngularVelocity(prop.body,clamp(spin*1.45+direction*.18,-.58,.58));
      prop._cutArmed = true;
      prop._thrownAt = performance.now();
      prop._frisbeePrev = {x:prop.body.position.x,y:prop.body.position.y};
    }else{
      Body.setAngularVelocity(prop.body,spin);
    }
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};`;
    if(!source.includes(throwNeedle)) throw new Error('Laser frisbee patch failed: throw arming');
    source = source.replace(throwNeedle,throwCode);

    const helperNeedle = `  function driveProps(){`;
    const helpers = `  function pointSegmentDistance(point,a,b){
    const abx = b.x-a.x;
    const aby = b.y-a.y;
    const d = abx*abx+aby*aby;
    if(d < .0001) return Math.hypot(point.x-a.x,point.y-a.y);
    const t = clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
    return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
  }
  function driveLaserFrisbeeCuts(now){
    for(const prop of props.values()){
      if(prop.type !== 'frisbee') continue;
      const b = prop.body;
      const current = {x:b.position.x,y:b.position.y};
      const previous = prop._frisbeePrev || current;
      prop._frisbeePrev = current;

      if(!prop._cutArmed || prop.heldBy || prop.contest || prop.attachedTo) continue;
      const age = now-(prop._thrownAt||0);
      if(age < 120) continue; // leave the thrower's hand before a cut is possible

      const linear = Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
      const spin = Math.abs(b.angularVelocity||0);
      const edgeSpeed = linear+spin*23;
      if(linear < 5.6 || spin < .14 || edgeSpeed < 9.5){
        if(linear < 3.5 && age > 280) prop._cutArmed = false;
        continue;
      }

      let best = null;
      for(const p of puppets.values()){
        if(!p.joints || !p.severedJoints) continue;
        for(const [name,constraint] of Object.entries(p.joints)){
          if(p.severedJoints.has(name)) continue;
          const q = jointCutPoint(constraint);
          if(!q) continue;
          const distance = pointSegmentDistance(q,previous,current);
          // The physical disc is ~23px radius, but only the central 13px joint corridor
          // counts as a cutting line. Ordinary limb/torso collisions therefore just bounce.
          if(distance <= 13 && (!best || distance < best.distance)) best = {p,name,distance};
        }
      }
      if(!best) continue;

      if(severJoint(best.p,best.name)){
        // One cut per throw. It keeps flying, but it is no longer a buzzsaw until
        // somebody catches/retrieves and throws it again.
        prop._cutArmed = false;
        Body.setVelocity(b,{x:(b.velocity?.x||0)*.72,y:(b.velocity?.y||0)*.72});
        Body.setAngularVelocity(b,(b.angularVelocity||0)*.55);
      }
    }
  }

${helperNeedle}`;
    if(!source.includes(helperNeedle)) throw new Error('Laser frisbee patch failed: cut helpers');
    source = source.replace(helperNeedle,helpers);

    const tickNeedle = `    Engine.update(engine,dt);
    drawStage();`;
    const tickCode = `    Engine.update(engine,dt);
    driveLaserFrisbeeCuts(now);
    drawStage();`;
    if(!source.includes(tickNeedle)) throw new Error('Laser frisbee patch failed: swept cut tick');
    source = source.replace(tickNeedle,tickCode);

    const stateNeedle = `      type:prop.type,
      x:b.position.x/W,`;
    const stateCode = `      type:prop.type,
      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,
      x:b.position.x/W,`;
    if(!source.includes(stateNeedle)) throw new Error('Laser frisbee patch failed: armed scene state');
    source = source.replace(stateNeedle,stateCode);

    const drawNeedle = `  }else{
    ctx.strokeStyle = '#08090a';ctx.lineWidth = Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();`;
    const drawCode = `  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d7dce2';ctx.beginPath();ctx.arc(0,0,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111317';ctx.beginPath();ctx.arc(0,0,11*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.armed?'#ff4b5c':'rgba(255,255,255,.46)';
    ctx.lineWidth=Math.max(2,2.7*s);ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=p.armed?'#ff7b86':'rgba(20,20,20,.62)';ctx.lineWidth=Math.max(1,1.3*s);
    ctx.beginPath();ctx.moveTo(-15*s,0);ctx.lineTo(15*s,0);ctx.stroke();
  }else{
    ctx.strokeStyle = '#08090a';ctx.lineWidth = Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();`;
    if(!source.includes(drawNeedle)) throw new Error('Laser frisbee patch failed: renderer');
    source = source.replace(drawNeedle,drawCode);

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
