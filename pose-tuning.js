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
  const POSES = {
    stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
    point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
    cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
    shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
    crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
  };

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

      const segmentPart = body.plugin?.puppetalkSegmentPart;
      const segment = body.plugin?.puppetalkSegment;
      if(!segmentPart) continue;
      if(segmentPart === 'head' && segment === 'top') parts.headTop = body;
      else if(segmentPart === 'torso') parts[`torso${segment === 'top' ? 'Top' : 'Bottom'}`] = body;
      else if(segment === 'distal') parts[`${segmentPart}2`] = body;
    }
    return parts;
  }

  function endPoint(body,length=23){
    if(!body) return null;
    const a = body.angle;
    return {
      x:body.position.x-Math.sin(a)*length,
      y:body.position.y+Math.cos(a)*length
    };
  }

  function pullPoint(body,point,target,stiffness,damping=.0036){
    if(!body || !point) return;
    const mass = Math.max(.2,body.mass || 1);
    let fx = ((target.x-point.x)*stiffness-body.velocity.x*damping)*mass;
    let fy = ((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;
    const magnitude = Math.hypot(fx,fy);
    const maxForce = .032;
    if(magnitude > maxForce){
      fx *= maxForce/magnitude;
      fy *= maxForce/magnitude;
    }
    Body.applyForce(body,point,{x:fx,y:fy});
  }

  function angleDelta(target,current){
    let d=target-current;
    while(d>Math.PI) d-=Math.PI*2;
    while(d< -Math.PI) d+=Math.PI*2;
    return d;
  }

  function driveAngle(body,target,strength=.012){
    if(!body) return;
    const correction=angleDelta(target,body.angle)*strength-(body.angularVelocity||0)*strength*.82;
    body.torque += Math.max(-.034,Math.min(.034,correction));
  }

  function linked(engine,a,b){
    if(!a || !b) return false;
    return (engine.world.constraints || []).some(c=>(c.bodyA===a && c.bodyB===b)||(c.bodyA===b && c.bodyB===a));
  }

  function held(input,...parts){
    const grabs = Array.isArray(input?.grabs) ? input.grabs : [];
    return grabs.some(g=>parts.includes(g?.part));
  }

  function armHeld(input,side){
    return held(input,`${side}Hand`,`${side}Shoulder`);
  }

  function applySegmentPose(input,bodies,engine){
    if(input.rag) return;
    const parts=partsOf(bodies);
    const q=POSES[input.pose] || POSES.stand;
    const base=q[8];

    const drives=[
      ['uaL','uaL2',0,held(input,'leftHand','leftShoulder')],
      ['faL','faL2',1,held(input,'leftHand','leftShoulder')],
      ['uaR','uaR2',2,held(input,'rightHand','rightShoulder')],
      ['faR','faR2',3,held(input,'rightHand','rightShoulder')],
      ['thL','thL2',4,held(input,'leftFoot','pelvis')],
      ['shL','shL2',5,held(input,'leftFoot','pelvis')],
      ['thR','thR2',6,held(input,'rightFoot','pelvis')],
      ['shR','shR2',7,held(input,'rightFoot','pelvis')]
    ];

    for(const [nearKey,farKey,index,isHeld] of drives){
      const near=parts[nearKey], far=parts[farKey];
      if(!far || !linked(engine,near,far) || isHeld) continue;
      // An intact destructible seam is not an extra joint. Give the distal half the
      // exact same pose target as the historic whole limb so the preset has its old authority.
      driveAngle(far,base+q[index],.016);
    }

    if(parts.headTop && linked(engine,parts.head,parts.headTop) && !held(input,'head')){
      driveAngle(parts.headTop,base*.2,.013);
    }
    if(parts.torsoTop && linked(engine,parts.torsoTop,parts.torso)) driveAngle(parts.torsoTop,base,.014);
    if(parts.torsoBottom && linked(engine,parts.torso,parts.torsoBottom)) driveAngle(parts.torsoBottom,base,.014);
  }

  function applyReadablePose(input,bodies){
    const parts = partsOf(bodies);
    const torso = parts.torso;
    if(!torso || input.rag) return;

    if(input.pose === 'point' && !armHeld(input,'left')){
      const forearm=parts.faL2 || parts.faL;
      const hand=endPoint(forearm,parts.faL2 ? 12 : 23);
      // Pull the actual hand, not the hidden mid-forearm seam.
      pullPoint(forearm,hand,{x:torso.position.x-112,y:torso.position.y-27},.00025,.0038);
    }

    if(input.pose === 'cheer'){
      if(!armHeld(input,'left')){
        const forearm=parts.faL2 || parts.faL;
        const hand=endPoint(forearm,parts.faL2 ? 12 : 23);
        pullPoint(forearm,hand,{x:torso.position.x-44,y:torso.position.y-124},.000265,.0039);
      }
      if(!armHeld(input,'right')){
        const forearm=parts.faR2 || parts.faR;
        const hand=endPoint(forearm,parts.faR2 ? 12 : 23);
        pullPoint(forearm,hand,{x:torso.position.x+44,y:torso.position.y-124},.000265,.0039);
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

  // During true limp, suppress gentle anatomical-limit correction so the puppet
  // simply keeps its current folded geometry and settles under gravity.
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
      applySegmentPose(input,bodies,engine);
      applyReadablePose(input,bodies);
    }
    return previousUpdate(engine,delta,correction);
  };

  window.PuppetalkPoseTuning = {version:25};
})();
