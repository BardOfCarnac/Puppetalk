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

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

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
      recover:false,
      slot:null
    });
    return groupState.get(group);
  }

  function groupForSlot(slot){ return slotToGroup.get(slot); }

  function observeStageInput(conn,data){
    if(data?.type !== 'input' || !Number.isInteger(conn.__puppetalkSlot)) return;
    const group = groupForSlot(conn.__puppetalkSlot);
    if(!group) return;
    const state = stateForGroup(group);
    const input = data.input || {};
    const nextGrabs = new Set((Array.isArray(input.grabs)?input.grabs:[]).map(g=>g?.part).filter(Boolean));
    const now = performance.now();

    for(const part of state.lastGrabs){
      if(!nextGrabs.has(part) && ['head','leftHand','rightHand','leftFoot','rightFoot'].includes(part)){
        state.released.set(part,now);
      }
    }
    for(const part of nextGrabs) state.released.delete(part);

    if(state.input?.rag === true && input.rag === false) state.recover = true;
    state.lastGrabs = nextGrabs;
    state.input = {
      pose:input.pose || 'stand',
      poseVersion:Number.isInteger(input.poseVersion)?input.poseVersion:0,
      rag:!!input.rag,
      grabs:Array.isArray(input.grabs)?input.grabs.map(g=>({...g})):[]
    };
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

        if(conn.__puppetalkRelaxTimer && grabs.length){
          clearTimeout(conn.__puppetalkRelaxTimer);
          conn.__puppetalkRelaxTimer = null;
        }

        // Recover is an explicit reset request: clear stored manual pins immediately
        // by advancing poseVersion as ragdoll mode is switched off.
        if(previousRag === true && input.rag === false){
          input.poseVersion = (Number.isInteger(input.poseVersion)?input.poseVersion:0)+1;
        }

        // Manual placement gets a short memory, not an invisible permanent nail.
        // After release, let the hand/head/foot settle briefly and then hand control
        // back to the selected pose by clearing the stored pin.
        if(previousGrabCount > 0 && grabs.length === 0){
          if(conn.__puppetalkRelaxTimer) clearTimeout(conn.__puppetalkRelaxTimer);
          const inputRef = input;
          conn.__puppetalkRelaxTimer = setTimeout(()=>{
            conn.__puppetalkRelaxTimer = null;
            if((conn.__puppetalkGrabCount || 0) !== 0 || !conn.open) return;
            inputRef.poseVersion = (Number.isInteger(inputRef.poseVersion)?inputRef.poseVersion:0)+1;
            rawSend({type:'input',input:inputRef});
          },950);
        }

        conn.__puppetalkGrabCount = grabs.length;
        conn.__puppetalkRag = !!input.rag;
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
      const correction = Math.min(.07,excess*.055);
      Body.setAngularVelocity(b,b.angularVelocity-sign*correction);
      Body.setAngularVelocity(a,a.angularVelocity+sign*correction*.35);
      if(excess > .48){
        Body.setAngle(b,a.angle+sign*(limit+.16));
        Body.setAngularVelocity(b,b.angularVelocity*.35);
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

  function hardRecover(engine,bodies){
    const parts = bodiesByPart(bodies);
    const torso = parts.torso;
    if(!torso) return;
    const floor = floorTop(engine);
    const standingY = floor ? floor.y-145 : torso.position.y;
    const minX = floor ? floor.minX+70 : 70;
    const maxX = floor ? floor.maxX-70 : Math.max(minX+1,torso.position.x+300);
    const x = clamp(torso.position.x,minX,maxX);

    const layout = {
      torso:[x,standingY,0],
      head:[x,standingY-65,0],
      uaL:[x-37,standingY-17,.12],
      faL:[x-42,standingY+30,.05],
      uaR:[x+37,standingY-17,-.12],
      faR:[x+42,standingY+30,-.05],
      thL:[x-14,standingY+65,.04],
      shL:[x-14,standingY+118,.02],
      thR:[x+14,standingY+65,-.04],
      shR:[x+14,standingY+118,-.02]
    };

    for(const [part,[px,py,a]] of Object.entries(layout)){
      const body = parts[part];
      if(!body) continue;
      Body.setPosition(body,{x:px,y:py});
      Body.setAngle(body,a);
      Body.setVelocity(body,{x:0,y:0});
      Body.setAngularVelocity(body,0);
      body.force.x = body.force.y = 0;
      body.torque = 0;
    }
  }

  function preparePuppetControl(engine,group,bodies){
    const state = stateForGroup(group);
    const input = state.input;
    if(!input) return;

    if(state.recover){
      hardRecover(engine,bodies);
      state.recover = false;
      state.released.clear();
      return;
    }

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

    // Preset poses are muscles, not teleports. Amplify their servo torque when the
    // limb is free, but back it off while that limb is under a finger.
    const armFactor = 2.35;
    const leftArmHeld = active.has('leftHand') || active.has('leftShoulder');
    const rightArmHeld = active.has('rightHand') || active.has('rightShoulder');
    const leftLegHeld = active.has('leftFoot') || active.has('pelvis');
    const rightLegHeld = active.has('rightFoot') || active.has('pelvis');

    for(const [name,body] of Object.entries(parts)){
      let factor = 1;
      if(name === 'uaL' || name === 'faL') factor = leftArmHeld ? .62 : armFactor;
      else if(name === 'uaR' || name === 'faR') factor = rightArmHeld ? .62 : armFactor;
      else if(name === 'thL' || name === 'shL') factor = leftLegHeld ? .78 : 1.35;
      else if(name === 'thR' || name === 'shR') factor = rightLegHeld ? .78 : 1.35;
      else if(name === 'head') factor = active.has('head') ? .72 : 1.25;
      else if(name === 'torso') factor = (active.has('torso') || active.has('pelvis')) ? .82 : 1.18;
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

  window.PuppetalkStability = {version:22};
})();
