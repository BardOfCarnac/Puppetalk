(()=>{
  const M = window.Matter;
  const Peer = window.Peer;
  if(!M || !Peer) return;

  const {Body,Engine} = M;
  const previousNextGroup = Body.nextGroup.bind(Body);
  const previousSetAngularVelocity = Body.setAngularVelocity.bind(Body);
  const previousUpdate = Engine.update.bind(Engine);

  const pendingGroups = [];
  const slotToGroup = new Map();
  const inputs = new Map();

  Body.nextGroup = function(nonColliding){
    const group = previousNextGroup(nonColliding);
    if(nonColliding && group < 0) pendingGroups.push(group);
    return group;
  };

  function patchConnection(conn,side){
    if(!conn || conn.__puppetalkPoseTuned) return conn;
    conn.__puppetalkPoseTuned = true;

    const previousOn = conn.on.bind(conn);
    const previousSend = conn.send.bind(conn);

    conn.on = function(event,handler){
      if(event === 'data' && typeof handler === 'function'){
        return previousOn(event,data=>{
          if(side === 'stage' && data?.type === 'input' && Number.isInteger(conn.__poseTuneSlot)){
            const group = slotToGroup.get(conn.__poseTuneSlot);
            if(group){
              const input = data.input || {};
              inputs.set(group,{
                pose:input.pose || 'stand',
                rag:!!input.rag,
                grabs:Array.isArray(input.grabs) ? input.grabs.map(g=>({...g})) : []
              });
            }
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };

    conn.send = function(data){
      if(side === 'stage' && data?.type === 'welcome' && Number.isInteger(data.slot)){
        conn.__poseTuneSlot = data.slot;
        const group = pendingGroups.shift();
        if(group) slotToGroup.set(data.slot,group);
      }
      return previousSend(data);
    };

    return conn;
  }

  const previousConnect = Peer.prototype.connect;
  const previousPeerOn = Peer.prototype.on;

  Peer.prototype.connect = function(...args){
    return patchConnection(previousConnect.apply(this,args),'controller');
  };

  Peer.prototype.on = function(event,handler,...rest){
    if(event === 'connection' && typeof handler === 'function'){
      return previousPeerOn.call(this,event,conn=>handler(patchConnection(conn,'stage')),...rest);
    }
    return previousPeerOn.call(this,event,handler,...rest);
  };

  function groupedBodies(engine){
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

  function partsOf(bodies){
    const parts = {};
    for(const body of bodies){
      const part = body.plugin?.puppetalkPart;
      if(part) parts[part] = body;
    }
    return parts;
  }

  function endPoint(body,length=23){
    const a = body.angle;
    return {
      x:body.position.x-Math.sin(a)*length,
      y:body.position.y+Math.cos(a)*length
    };
  }

  function pullPoint(body,point,target,stiffness,damping=.0036){
    if(!body) return;
    const mass = Math.max(.2,body.mass || 1);
    let fx = ((target.x-point.x)*stiffness-body.velocity.x*damping)*mass;
    let fy = ((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;
    const magnitude = Math.hypot(fx,fy);
    const maxForce = .026;
    if(magnitude > maxForce){
      fx *= maxForce/magnitude;
      fy *= maxForce/magnitude;
    }
    Body.applyForce(body,point,{x:fx,y:fy});
  }

  function armHeld(input,side){
    const grabs = Array.isArray(input?.grabs) ? input.grabs : [];
    return grabs.some(g=>g?.part === `${side}Hand` || g?.part === `${side}Shoulder`);
  }

  function applyReadablePose(input,bodies){
    const parts = partsOf(bodies);
    const torso = parts.torso;
    if(!torso || input.rag) return;

    if(input.pose === 'point' && !armHeld(input,'left')){
      const hand = endPoint(parts.faL,23);
      // Almost full reach, dead level with the shoulder: unmistakably pointing.
      pullPoint(parts.faL,hand,{x:torso.position.x-112,y:torso.position.y-27},.000205,.0038);
    }

    if(input.pose === 'cheer'){
      if(!armHeld(input,'left')){
        const hand = endPoint(parts.faL,23);
        // Hands sit well above the head rather than merely out to the sides.
        pullPoint(parts.faL,hand,{x:torso.position.x-44,y:torso.position.y-124},.000225,.0039);
      }
      if(!armHeld(input,'right')){
        const hand = endPoint(parts.faR,23);
        pullPoint(parts.faR,hand,{x:torso.position.x+44,y:torso.position.y-124},.000225,.0039);
      }
    }
  }

  function markLimp(input,bodies){
    const limp = !!input?.rag;
    for(const body of bodies){
      body.plugin = body.plugin || {};
      body.plugin.puppetalkTrueLimp = limp;
    }
  }

  // Build 23 still uses Body.setAngularVelocity for anatomical-limit correction.
  // During true limp, suppress those gentle correction nudges so the puppet simply
  // keeps its current folded geometry and settles under gravity. Very large spins
  // are still allowed to be capped by the stability governor.
  Body.setAngularVelocity = function(body,value){
    if(body?.plugin?.puppetalkTrueLimp){
      const current = Math.abs(body.angularVelocity || 0);
      const requested = Math.abs(value || 0);
      if(current < .5 && requested < .5) return body;
    }
    return previousSetAngularVelocity(body,value);
  };

  Engine.update = function(engine,delta=1000/60,correction){
    const groups = groupedBodies(engine);
    for(const [group,bodies] of groups){
      const input = inputs.get(group);
      if(!input) continue;
      markLimp(input,bodies);
      applyReadablePose(input,bodies);
    }
    return previousUpdate(engine,delta,correction);
  };

  window.PuppetalkPoseTuning = {version:24};
})();
