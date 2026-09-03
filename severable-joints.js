// Puppetalk severable joint pass.
// Names every puppet constraint, lets toys sever a joint cleanly, and only repairs on explicit Recover.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_DART_BALLOON_POP_V1') || source.includes('PUPPETALK_SEVERABLE_JOINTS_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_DART_BALLOON_POP_V1',
      '  // PUPPETALK_DART_BALLOON_POP_V1\n  // PUPPETALK_SEVERABLE_JOINTS_V1'
    );

    const constraintsNeedle = `    const constraints = [
      joint(torso,{x:0,y:-39},head,{x:0,y:24}),
      joint(torso,{x:-24,y:-27},uaL,{x:0,y:-25}),
      joint(uaL,{x:0,y:25},faL,{x:0,y:-23}),
      joint(torso,{x:24,y:-27},uaR,{x:0,y:-25}),
      joint(uaR,{x:0,y:25},faR,{x:0,y:-23}),
      joint(torso,{x:-14,y:38},thL,{x:0,y:-27}),
      joint(thL,{x:0,y:27},shL,{x:0,y:-25}),
      joint(torso,{x:14,y:38},thR,{x:0,y:-27}),
      joint(thR,{x:0,y:27},shR,{x:0,y:-25})
    ];`;
    const constraintsCode = `    const joints = {
      neck:joint(torso,{x:0,y:-39},head,{x:0,y:24}),
      leftShoulder:joint(torso,{x:-24,y:-27},uaL,{x:0,y:-25}),
      leftElbow:joint(uaL,{x:0,y:25},faL,{x:0,y:-23}),
      rightShoulder:joint(torso,{x:24,y:-27},uaR,{x:0,y:-25}),
      rightElbow:joint(uaR,{x:0,y:25},faR,{x:0,y:-23}),
      leftHip:joint(torso,{x:-14,y:38},thL,{x:0,y:-27}),
      leftKnee:joint(thL,{x:0,y:27},shL,{x:0,y:-25}),
      rightHip:joint(torso,{x:14,y:38},thR,{x:0,y:-27}),
      rightKnee:joint(thR,{x:0,y:27},shR,{x:0,y:-25})
    };
    const constraints = Object.values(joints);`;
    if(!source.includes(constraintsNeedle)) throw new Error('Severable joints patch failed: constraint naming');
    source = source.replace(constraintsNeedle,constraintsCode);

    const puppetNeedle = `      constraints,
      target:{x:x/W,y:y/H},`;
    const puppetCode = `      constraints,joints,
      severedJoints:new Set(),
      recoverVersion:0,
      repairRequested:false,
      target:{x:x/W,y:y/H},`;
    if(!source.includes(puppetNeedle)) throw new Error('Severable joints patch failed: puppet state');
    source = source.replace(puppetNeedle,puppetCode);

    const helperNeedle = `  function removePuppet(slot){`;
    const helpers = `  function jointWorldPoint(constraint,side){
    const body = side === 'A' ? constraint?.bodyA : constraint?.bodyB;
    const point = side === 'A' ? constraint?.pointA : constraint?.pointB;
    if(!body || !point) return null;
    const r = Vector.rotate(point,body.angle||0);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }
  function jointGap(constraint){
    const a = jointWorldPoint(constraint,'A');
    const b = jointWorldPoint(constraint,'B');
    return a && b ? Math.hypot(a.x-b.x,a.y-b.y) : Infinity;
  }
  function jointCutPoint(constraint){
    const a = jointWorldPoint(constraint,'A');
    const b = jointWorldPoint(constraint,'B');
    if(!a || !b) return null;
    return {x:(a.x+b.x)*.5,y:(a.y+b.y)*.5};
  }
  function severJoint(p,name){
    if(!p?.joints?.[name] || p.severedJoints?.has(name)) return false;
    const c = p.joints[name];
    Composite.remove(engine.world,c);
    p.severedJoints.add(name);
    p.repairRequested = false;
    return true;
  }
  function repairSeveredJoints(p){
    if(!p?.repairRequested || !p.severedJoints?.size) return;
    for(const name of [...p.severedJoints]){
      const c = p.joints?.[name];
      if(!c || jointGap(c) > 34) continue;
      Composite.add(engine.world,c);
      p.severedJoints.delete(name);
    }
    if(!p.severedJoints.size) p.repairRequested = false;
  }
  function handleJointRecovery(slot,msg){
    if(msg?.type !== 'input') return;
    const version = Number.isInteger(msg.input?.recoverVersion) ? msg.input.recoverVersion : null;
    if(version === null) return;
    const p = makePuppet(slot);
    if(version > (p.recoverVersion||0)){
      p.recoverVersion = version;
      p.repairRequested = true;
    }else if(version > p.recoverVersion){
      p.recoverVersion = version;
    }
  }

${helperNeedle}`;
    if(!source.includes(helperNeedle)) throw new Error('Severable joints patch failed: helpers');
    source = source.replace(helperNeedle,helpers);

    const anatomyNeedle = `      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,
      torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},`;
    const anatomyCode = `      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,severed:[...(p.severedJoints||[])],
      torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},`;
    if(!source.includes(anatomyNeedle)) throw new Error('Severable joints patch failed: scene severed state');
    source = source.replace(anatomyNeedle,anatomyCode);

    const anatomyEndNeedle = `      kl:norm(worldPoint(p.thL,{x:0,y:27})),kr:norm(worldPoint(p.thR,{x:0,y:27})),
      al:norm(worldPoint(p.shL,{x:0,y:25})),ar:norm(worldPoint(p.shR,{x:0,y:25}))`;
    const anatomyEndCode = `      kl:norm(worldPoint(p.thL,{x:0,y:27})),kr:norm(worldPoint(p.thR,{x:0,y:27})),
      al:norm(worldPoint(p.shL,{x:0,y:25})),ar:norm(worldPoint(p.shR,{x:0,y:25})),
      uaLt:norm(worldPoint(p.uaL,{x:0,y:-25})),faLt:norm(worldPoint(p.faL,{x:0,y:-23})),
      uaRt:norm(worldPoint(p.uaR,{x:0,y:-25})),faRt:norm(worldPoint(p.faR,{x:0,y:-23})),
      thLt:norm(worldPoint(p.thL,{x:0,y:-27})),shLt:norm(worldPoint(p.shL,{x:0,y:-25})),
      thRt:norm(worldPoint(p.thR,{x:0,y:-27})),shRt:norm(worldPoint(p.shR,{x:0,y:-25}))`;
    if(!source.includes(anatomyEndNeedle)) throw new Error('Severable joints patch failed: segment endpoints');
    source = source.replace(anatomyEndNeedle,anatomyEndCode);

    const tickNeedle = `    puppets.forEach(drivePuppet);
    driveProps();
    Engine.update(engine,dt);`;
    const tickCode = `    puppets.forEach(p=>{ drivePuppet(p); repairSeveredJoints(p); });
    driveProps();
    Engine.update(engine,dt);`;
    if(!source.includes(tickNeedle)) throw new Error('Severable joints patch failed: repair tick');
    source = source.replace(tickNeedle,tickCode);

    const listenerNeedle = `    conn.on('data',msg=>handlePropInput(slot,msg));`;
    const listenerCode = `    conn.on('data',msg=>handlePropInput(slot,msg));
    conn.on('data',msg=>handleJointRecovery(slot,msg));`;
    if(!source.includes(listenerNeedle)) throw new Error('Severable joints patch failed: recover input');
    source = source.replace(listenerNeedle,listenerCode);

    const renderNeedle = `  chain([p.hl,p.kl,p.al],p.color,17);
  chain([p.hr,p.kr,p.ar],p.color,17);
  chain([p.sl,p.el,p.wl],p.color,15);
  chain([p.sr,p.er,p.wr],p.color,15);`;
    const renderCode = `  const severed = new Set(Array.isArray(p.severed)?p.severed:[]);
  chain([severed.has('leftHip')?p.thLt:p.hl,p.kl],p.color,17);
  chain([severed.has('leftKnee')?p.shLt:p.kl,p.al],p.color,17);
  chain([severed.has('rightHip')?p.thRt:p.hr,p.kr],p.color,17);
  chain([severed.has('rightKnee')?p.shRt:p.kr,p.ar],p.color,17);
  chain([severed.has('leftShoulder')?p.uaLt:p.sl,p.el],p.color,15);
  chain([severed.has('leftElbow')?p.faLt:p.el,p.wl],p.color,15);
  chain([severed.has('rightShoulder')?p.uaRt:p.sr,p.er],p.color,15);
  chain([severed.has('rightElbow')?p.faRt:p.er,p.wr],p.color,15);`;
    if(!source.includes(renderNeedle)) throw new Error('Severable joints patch failed: detached rendering');
    source = source.replace(renderNeedle,renderCode);

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
