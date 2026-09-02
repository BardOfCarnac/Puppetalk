(()=>{
  const M = window.Matter;
  if(!M) return;

  const {Body,Bodies,Engine,Constraint} = M;
  const originalCreate = Engine.create.bind(Engine);
  const originalUpdate = Engine.update.bind(Engine);
  const originalConstraintCreate = Constraint.create.bind(Constraint);
  const originalNextGroup = Body.nextGroup.bind(Body);
  const originalRectangle = Bodies.rectangle.bind(Bodies);
  const originalCircle = Bodies.circle.bind(Bodies);

  const PART_ORDER = ['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR'];
  const partIndex = new Map();
  const pendingGroups = [];
  const slotToGroup = new Map();
  const groupState = new Map();
  let recoverIntentUntil = 0;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const smoothstep = t=>{
    t = clamp(t,0,1);
    return t*t*(3-2*t);
  };

  function angleDelta(a,b){
    let d = a-b;
    while(d > Math.PI) d -= Math.PI*2;
    while(d < -Math.PI) d += Math.PI*2;
    return d;
  }

  function scaleVelocity(body,factor){
    Body.setVelocity(body,{x:body.velocity.x*factor,y:body.velocity.y*factor});
    Body.setAngularVelocity(body,body.angularVelocity*factor);
  }

  function tagPuppetBody(body){
    const group = body?.collisionFilter?.group || 0;
    if(group >= 0 || !partIndex.has(group)) return body;
    const i = partIndex.get(group);
    body.plugin = body.plugin || {};
    body.plugin.puppetalkPart = PART_ORDER[i] || `part${i}`;
    partIndex.set(group,i+1);
    return body;
  }

  Body.nextGroup = function(nonColliding){
    const group = originalNextGroup(nonColliding);
    if(nonColliding && group < 0){
      partIndex.set(group,0);
      pendingGroups.push(group);
    }
    return group;
  };

  Bodies.rectangle = function(...args){ return tagPuppetBody(originalRectangle(...args)); };
  Bodies.circle = function(...args){ return tagPuppetBody(originalCircle(...args)); };

  function stateForGroup(group){
    if(!groupState.has(group)) groupState.set(group,{
      input:null,
      lastGrabs:new Set(),
      released:new Map(),
      recover:null,
      recoverVersion:0,
      poseRampStartedAt:0,
      slot:null
    });
    return groupState.get(group);
  }

  function groupForSlot(slot){ return slotToGroup.get(slot); }

  // Recover is intentionally distinguished from merely leaving ragdoll mode.
  // Clicking a pose while limp should let the tangled body try that pose as-is.
  document.addEventListener('click',event=>{
    const button = event.target?.closest?.('[data-rag]');
    if(!button) return;
    if(button.classList.contains('active') || /recover/i.test(button.textContent || '')){
      recoverIntentUntil = performance.now()+350;
    }
  },true);

  function observeStageInput(conn,data){
    if(data?.type !== 'input' || !Number.isInteger(conn.__puppetalkSlot)) return;
    const group = groupForSlot(conn.__puppetalkSlot);
    if(!group) return;
    const state = stateForGroup(group);
    const input = data.input || {};
    const nextGrabs = new Set((Array.isArray(input.grabs)?input.grabs:[]).map(g=>g?.part).filter(Boolean));
    const now = performance.now();
    const previous = state.input;

    for(const part of state.lastGrabs){
      if(!nextGrabs.has(part) && ['head','leftHand','rightHand','leftFoot','rightFoot'].includes(part)){
        state.released.set(part,now);
      }
    }
    for(const part of nextGrabs) state.released.delete(part);

    const incomingRecoverVersion = Number.isInteger(input.recoverVersion) ? input.recoverVersion : state.recoverVersion;
    if(previous && incomingRecoverVersion !== state.recoverVersion){
      state.recover = {startedAt:now,x:null,standingY:null};
      state.released.clear();
    }

    const poseChanged = !!previous && (input.pose || 'stand') !== previous.pose;
    const ordinaryStandUp = !!previous && previous.rag === true && input.rag === false && incomingRecoverVersion === state.recoverVersion;
    if(poseChanged || ordinaryStandUp) state.poseRampStartedAt = now;

    state.recoverVersion = incomingRecoverVersion;
    state.lastGrabs = nextGrabs;
    state.input = {
      pose:input.pose || 'stand',
      poseVersion:Number.isInteger(input.poseVersion)?input.poseVersion:0,
      recoverVersion:incomingRecoverVersion,
      rag:!!input.rag,
      grabs:Array.isArray(input.grabs)?input.grabs.map(g=>({...g})):[]
    };
  }

  function markStandSelected(){
    queueMicrotask(()=>{
      document.querySelectorAll('[data-pose]').forEach(button=>{
        button.classList.toggle('active',button.dataset.pose === 'stand');
      });
    });
  }

  function patchConnection(conn,side){
    if(!conn || conn.__puppetalkPatched) return conn;
    conn.__puppetalkPatched = true;
    conn.__puppetalkSide = side;

    const rawOn = conn.on.bind(conn);
    const rawSend = conn.send.bind(conn);
    conn.__puppetalkRawSend = rawSend;

    conn.on = function(event,handler){
      if(event === 'data' && typeof handler === 'function'){
        return rawOn(event,data=>{
          if(side === 'controller' && data?.type === 'welcome' && Number.isInteger(data.slot)){
            conn.__puppetalkSlot = data.slot;
          }
          if(side === 'stage') observeStageInput(conn,data);
          return handler(data);
        });
      }
      return rawOn(event,handler);
    };

    conn.send = function(data){
      if(side === 'stage' && data?.type === 'welcome' && Number.isInteger(data.slot)){
        conn.__puppetalkSlot = data.slot;
        const group = pendingGroups.shift();
        if(group){
          slotToGroup.set(data.slot,group);
          const state = stateForGroup(group);
          state.slot = data.slot;
        }
      }

      if(side === 'controller' && data?.type === 'input' && data.input){
        const input = data.input;
        const grabs = Array.isArray(input.grabs) ? input.grabs : [];
        const previousGrabCount = conn.__puppetalkGrabCount || 0;
        const previousRag = conn.__puppetalkRag;
        const explicitRecover = previousRag === true && input.rag === false && performance.now() <= recoverIntentUntil;

        if(conn.__puppetalkRelaxTimer && grabs.length){
          clearTimeout(conn.__puppetalkRelaxTimer);
          conn.__puppetalkRelaxTimer = null;
        }

        if(conn.__puppetalkPoseVersion == null){
          conn.__puppetalkPoseVersion = Number.isInteger(input.poseVersion) ? input.poseVersion : 0;
        }
        if(conn.__puppetalkRecoverVersion == null){
          conn.__puppetalkRecoverVersion = Number.isInteger(input.recoverVersion) ? input.recoverVersion : 0;
        }

        // The old controller increments poseVersion whenever any pose button is
        // pressed. Suppress that: pose buttons should never secretly untangle.
        // The only ordinary poseVersion increment left is our delayed manual-pin release.
        if(!explicitRecover && Number.isInteger(input.poseVersion) && input.poseVersion !== conn.__puppetalkPoseVersion){
          input.poseVersion = conn.__puppetalkPoseVersion;
        }

        if(explicitRecover){
          recoverIntentUntil = 0;
          input.pose = 'stand';
          input.poseVersion = conn.__puppetalkPoseVersion+1;
          input.recoverVersion = conn.__puppetalkRecoverVersion+1;
          conn.__puppetalkPoseVersion = input.poseVersion;
          conn.__puppetalkRecoverVersion = input.recoverVersion;
          markStandSelected();
        }else{
          input.recoverVersion = conn.__puppetalkRecoverVersion;
        }

        // Manual placement gets a short memory, not an invisible permanent nail.
        if(previousGrabCount > 0 && grabs.length === 0){
          if(conn.__puppetalkRelaxTimer) clearTimeout(conn.__puppetalkRelaxTimer);
          const inputRef = input;
          conn.__puppetalkRelaxTimer = setTimeout(()=>{
            conn.__puppetalkRelaxTimer = null;
            if((conn.__puppetalkGrabCount || 0) !== 0 || !conn.open) return;
            inputRef.poseVersion = conn.__puppetalkPoseVersion+1;
            conn.__puppetalkPoseVersion = inputRef.poseVersion;
            rawSend({type:'input',input:inputRef});
          },950);
        }

        conn.__puppetalkGrabCount = grabs.length;
        conn.__puppetalkRag = !!input.rag;
        conn.__puppetalkPose = input.pose || 'stand';
      }
      return rawSend(data);
    };

    return conn;
  }

  function patchPeerWhenReady(){
    const Peer = window.Peer;
    if(!Peer?.prototype || Peer.prototype.__puppetalkStabilityPatched) return false;
    Peer.prototype.__puppetalkStabilityPatched = true;

    const rawConnect = Peer.prototype.connect;
    const rawPeerOn = Peer.prototype.on;

    Peer.prototype.connect = function(...args){
      return patchConnection(rawConnect.apply(this,args),'controller');
    };

    Peer.prototype.on = function(event,handler,...rest){
      if(event === 'connection' && typeof handler === 'function'){
        return rawPeerOn.call(this,event,conn=>handler(patchConnection(conn,'stage')),...rest);
      }
      return rawPeerOn.call(this,event,handler,...rest);
    };
    return true;
  }

  if(!patchPeerWhenReady()){
    const peerTimer = setInterval(()=>{ if(patchPeerWhenReady()) clearInterval(peerTimer); },20);
    setTimeout(()=>clearInterval(peerTimer),5000);
  }

  function jointLimit(constraint){
    const a = constraint.bodyA;
    const b = constraint.bodyB;
    if(!a || !b || a.isStatic || b.isStatic) return null;
    if(a.circleRadius || b.circleRadius) return 1.0;
    const p = constraint.pointA || {x:0,y:0};
    if(Math.abs(p.x) > 20 && p.y < -15) return 2.35;
    if(Math.abs(p.x) > 9 && p.y > 28) return 1.75;
    return 2.25;
  }

  function enforceJointLimits(engine){
    for(const c of engine.world.constraints){
      const limit = jointLimit(c);
      if(!limit) continue;
      const a = c.bodyA;
      const b = c.bodyB;
      const rel = angleDelta(b.angle,a.angle);
      const excess = Math.abs(rel)-limit;
      if(excess <= 0) continue;
      const sign = Math.sign(rel) || 1;
      const correction = Math.min(.075,excess*.06);
      Body.setAngularVelocity(b,b.angularVelocity-sign*correction);
      Body.setAngularVelocity(a,a.angularVelocity+sign*correction*.35);

      // Never teleport the angle. Deeply folded joints get a stronger damped push
      // back toward range, preserving visible motion while preventing flip loops.
      if(excess > .48){
        const extra = Math.min(.11,(excess-.48)*.11+.035);
        Body.setAngularVelocity(b,(b.angularVelocity-sign*extra)*.62);
        Body.setAngularVelocity(a,(a.angularVelocity+sign*extra*.24)*.78);
      }
    }
  }

  function bodiesByPart(bodies){
    const map = {};
    for(const body of bodies){
      const part = body.plugin?.puppetalkPart;
      if(part) map[part] = body;
    }
    return map;
  }

  function floorTop(engine){
    let best = null;
    for(const body of engine.world.bodies){
      if(!body.isStatic) continue;
      const width = body.bounds.max.x-body.bounds.min.x;
      const height = body.bounds.max.y-body.bounds.min.y;
      if(width < height*2.5) continue;
      if(!best || width > best.width) best = {width,y:body.bounds.min.y,minX:body.bounds.min.x,maxX:body.bounds.max.x};
    }
    return best;
  }

  function recoveryLayout(engine,parts,state){
    const torso = parts.torso;
    if(!torso) return null;
    const floor = floorTop(engine);
    if(state.recover.x == null){
      const minX = floor ? floor.minX+70 : 70;
      const maxX = floor ? floor.maxX-70 : Math.max(minX+1,torso.position.x+300);
      state.recover.x = clamp(torso.position.x,minX,maxX);
      state.recover.standingY = floor ? floor.y-145 : torso.position.y;
    }
    const x = state.recover.x;
    const y = state.recover.standingY;
    return {
      torso:[x,y,0],
      head:[x,y-65,0],
      uaL:[x-37,y-17,.12],
      faL:[x-42,y+30,.05],
      uaR:[x+37,y-17,-.12],
      faR:[x+42,y+30,-.05],
      thL:[x-14,y+65,.04],
      shL:[x-14,y+118,.02],
      thR:[x+14,y+65,-.04],
      shR:[x+14,y+118,-.02]
    };
  }

  function guidedRecover(engine,bodies,state,now){
    const parts = bodiesByPart(bodies);
    const layout = recoveryLayout(engine,parts,state);
    if(!layout) return false;

    const age = now-state.recover.startedAt;
    const engage = smoothstep(age/280);
    const finish = smoothstep(age/1250);
    let maxError = 0;

    for(const [part,[tx,ty,ta]] of Object.entries(layout)){
      const body = parts[part];
      if(!body) continue;
      const dx = tx-body.position.x;
      const dy = ty-body.position.y;
      maxError = Math.max(maxError,Math.hypot(dx,dy));
      const mass = Math.max(.2,body.mass || 1);
      const stiffness = (.00007+.00012*engage) * (part === 'torso' ? 1.15 : 1);
      const damping = .0045+.0032*engage;
      let fx = (dx*stiffness-body.velocity.x*damping)*mass;
      let fy = (dy*stiffness-body.velocity.y*damping)*mass;
      const mag = Math.hypot(fx,fy);
      const maxForce = .032;
      if(mag > maxForce){ fx *= maxForce/mag; fy *= maxForce/mag; }
      Body.applyForce(body,body.position,{x:fx,y:fy});

      const turn = angleDelta(ta,body.angle);
      body.torque += clamp(turn*(.006+.010*engage)-body.angularVelocity*(.016+.012*engage),-.032,.032);

      // Bleed chaos rapidly at first, but never zero motion or position.
      if(age < 360) scaleVelocity(body,.90+.07*finish);
    }

    if((age > 1250 && maxError < 24) || age > 1850){
      state.recover = null;
      state.poseRampStartedAt = now;
      return false;
    }
    return true;
  }

  function preparePuppetControl(engine,group,bodies){
    const state = stateForGroup(group);
    const input = state.input;
    if(!input) return;

    const parts = bodiesByPart(bodies);
    const active = new Set((input.grabs || []).map(g=>g?.part).filter(Boolean));
    const now = performance.now();

    // Released manual anchors fade rather than staying rigid. The controller clears
    // the actual stored pin after 950ms; this continuously weakens it until then.
    for(const [part,releasedAt] of [...state.released]){
      const age = now-releasedAt;
      if(age >= 1000){ state.released.delete(part); continue; }
      const bodyName = part === 'head' ? 'head' : part === 'leftHand' ? 'faL' : part === 'rightHand' ? 'faR' : part === 'leftFoot' ? 'shL' : 'shR';
      const body = parts[bodyName];
      if(!body) continue;
      const t = clamp(age/1000,0,1);
      const memory = .62-(.49*t);
      body.force.x *= memory;
      body.force.y *= memory;
    }

    if(input.rag) return;

    // A normal pose change, including Stand from a collapsed ragdoll, eases its
    // muscles on rather than suddenly applying full standing force in one frame.
    if(state.poseRampStartedAt){
      const ramp = smoothstep((now-state.poseRampStartedAt)/520);
      const forceBlend = .30+.70*ramp;
      for(const body of bodies){
        body.force.x *= forceBlend;
        body.force.y *= forceBlend;
        body.torque *= .38+.62*ramp;
      }
      if(ramp >= .999) state.poseRampStartedAt = 0;
    }

    // Recover alone deliberately untangles, but does so by guided springs and
    // damping over time. There are no position or angle teleports.
    const recovering = state.recover ? guidedRecover(engine,bodies,state,now) : false;

    // Preset poses are muscles, not teleports. Amplify their servo torque when the
    // limb is free, but back it off while that limb is under a finger.
    const armFactor = recovering ? 1.55 : 2.35;
    const leftArmHeld = active.has('leftHand') || active.has('leftShoulder');
    const rightArmHeld = active.has('rightHand') || active.has('rightShoulder');
    const leftLegHeld = active.has('leftFoot') || active.has('pelvis');
    const rightLegHeld = active.has('rightFoot') || active.has('pelvis');

    for(const [name,body] of Object.entries(parts)){
      let factor = 1;
      if(name === 'uaL' || name === 'faL') factor = leftArmHeld ? .62 : armFactor;
      else if(name === 'uaR' || name === 'faR') factor = rightArmHeld ? .62 : armFactor;
      else if(name === 'thL' || name === 'shL') factor = leftLegHeld ? .78 : (recovering ? 1.08 : 1.35);
      else if(name === 'thR' || name === 'shR') factor = rightLegHeld ? .78 : (recovering ? 1.08 : 1.35);
      else if(name === 'head') factor = active.has('head') ? .72 : (recovering ? 1.05 : 1.25);
      else if(name === 'torso') factor = (active.has('torso') || active.has('pelvis')) ? .82 : (recovering ? 1.04 : 1.18);
      body.torque *= factor;
    }
  }

  function stabilizeGroups(engine){
    const groups = new Map();
    for(const body of engine.world.bodies){
      if(body.isStatic) continue;
      const group = body.collisionFilter?.group || 0;
      if(group >= 0) continue;
      if(!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(body);
    }

    if(!engine._puppetalkHeat) engine._puppetalkHeat = new Map();

    for(const [group,bodies] of groups){
      let hottestSpeed = 0;
      let hottestAngular = 0;
      for(const body of bodies){
        hottestSpeed = Math.max(hottestSpeed,Math.hypot(body.velocity.x,body.velocity.y));
        hottestAngular = Math.max(hottestAngular,Math.abs(body.angularVelocity));
      }
      const runaway = hottestSpeed > 9 || hottestAngular > .24;
      let heat = engine._puppetalkHeat.get(group) || 0;
      heat = runaway ? heat+1 : Math.max(0,heat-1);

      for(const body of bodies){
        const speed = Math.hypot(body.velocity.x,body.velocity.y);
        if(speed > 7.2){
          const f = 7.2/speed;
          Body.setVelocity(body,{x:body.velocity.x*f,y:body.velocity.y*f});
        }
        if(Math.abs(body.angularVelocity) > .18){
          Body.setAngularVelocity(body,Math.sign(body.angularVelocity)*.18);
        }
      }

      if(heat >= 3){
        bodies.forEach(body=>scaleVelocity(body,.22));
        heat = 0;
      }
      engine._puppetalkHeat.set(group,heat);
    }
  }

  function puppetGroups(engine){
    const groups = new Map();
    for(const body of engine.world.bodies){
      if(body.isStatic) continue;
      const group = body.collisionFilter?.group || 0;
      if(group >= 0) continue;
      if(!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(body);
    }
    return groups;
  }

  Engine.create = function(options={}){
    const engine = originalCreate(options);
    engine.positionIterations = Math.max(engine.positionIterations || 6,8);
    engine.velocityIterations = Math.max(engine.velocityIterations || 4,6);
    engine.constraintIterations = Math.max(engine.constraintIterations || 2,4);
    return engine;
  };

  Constraint.create = function(options={}){
    if(options.bodyA && options.bodyB){
      options = {...options,stiffness:Math.min(options.stiffness ?? 1,.90),damping:Math.max(options.damping ?? 0,.20)};
    }
    return originalConstraintCreate(options);
  };

  Engine.update = function(engine,delta=1000/60,correction){
    const groups = puppetGroups(engine);
    groups.forEach((bodies,group)=>preparePuppetControl(engine,group,bodies));
    const safeDelta = Math.min(delta,1000/60);
    const result = originalUpdate(engine,safeDelta,correction);
    enforceJointLimits(engine);
    stabilizeGroups(engine);
    return result;
  };

  window.PuppetalkStability = {version:23};
})();
