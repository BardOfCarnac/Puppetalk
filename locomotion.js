(()=>{
  const M = window.Matter;
  const Peer = window.Peer;
  if(!M || !Peer) return;

  const {Body,Engine} = M;
  const rawNextGroup = Body.nextGroup.bind(Body);
  const rawPeerOn = Peer.prototype.on;
  const rawEngineUpdate = Engine.update.bind(Engine);

  const pendingGroups = [];
  const slotToGroup = new Map();
  const states = new Map();

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const smoothstep = t=>{
    t=clamp(t,0,1);
    return t*t*(3-2*t);
  };

  function stateFor(group){
    if(!states.has(group)) states.set(group,{
      slot:null,
      input:null,
      rawTorso:{x:.5,y:.6},
      feet:null,
      step:null,
      nextFoot:'left',
      walkUntil:0,
      stepCooldownUntil:0
    });
    return states.get(group);
  }

  Body.nextGroup = function(nonColliding){
    const group=rawNextGroup(nonColliding);
    if(nonColliding && group<0) pendingGroups.push(group);
    return group;
  };

  function cloneInput(input){
    return {
      ...input,
      grabs:Array.isArray(input?.grabs)?input.grabs.map(g=>({...g})):[]
    };
  }

  function normalizedGrabs(input){
    if(Array.isArray(input?.grabs)) return input.grabs.filter(g=>g&&typeof g.part==='string');
    if(input?.grabbing&&input?.grabPart) return [{part:input.grabPart,x:input.x,y:input.y}];
    return [];
  }

  function depthForSlot(slot){
    return window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0;
  }

  function depthScale(depth){
    return window.PuppetalkDepthState?.scaleForDepth?.(depth) || 1;
  }

  function depthShift(depth){
    return window.PuppetalkDepthState?.shiftForDepth?.(depth) || 0;
  }

  function inverseProjectedGrab(state,grab){
    if(!grab || !Number.isFinite(grab.x) || !Number.isFinite(grab.y)) return {...grab};
    const center=state.rawTorso || {x:.5,y:.6};
    const depth=depthForSlot(state.slot);
    const scale=Math.max(.1,depthScale(depth));
    const shift=depthShift(depth);
    return {
      ...grab,
      x:clamp(center.x+(grab.x-center.x)/scale,.01,.99),
      y:clamp(center.y+(grab.y-shift-center.y)/scale,.02,.98)
    };
  }

  function inputForPhysics(state,input){
    const copy=cloneInput(input||{});
    copy.grabs=normalizedGrabs(copy).map(grab=>{
      const mapped=inverseProjectedGrab(state,grab);
      if(grab.part==='torso'){
        return {...mapped,y:clamp(state.rawTorso?.y ?? mapped.y,.04,.96)};
      }
      return mapped;
    });
    if(!Array.isArray(input?.grabs)&&copy.grabs.length===1){
      const g=copy.grabs[0];
      copy.grabPart=g.part;
      copy.x=g.x;
      copy.y=g.y;
      copy.grabbing=true;
    }
    return copy;
  }

  function observeScene(data){
    if(!Array.isArray(data?.puppets)) return;
    for(const puppet of data.puppets){
      const group=slotToGroup.get(puppet.slot);
      if(!group || !puppet?.torso) continue;
      stateFor(group).rawTorso={x:puppet.torso.x,y:puppet.torso.y};
    }
  }

  function patchStageConnection(conn){
    if(!conn || conn.__puppetalkLocomotionPatched) return conn;
    conn.__puppetalkLocomotionPatched=true;
    const previousOn=conn.on.bind(conn);
    const previousSend=conn.send.bind(conn);

    conn.on=function(event,handler){
      if(event==='data'&&typeof handler==='function'){
        return previousOn(event,data=>{
          if(data?.type==='input'&&Number.isInteger(conn.__locomotionSlot)){
            const group=slotToGroup.get(conn.__locomotionSlot);
            if(group){
              const state=stateFor(group);
              const adjusted=inputForPhysics(state,data.input||{});
              state.input=cloneInput(adjusted);
              return handler({...data,input:adjusted});
            }
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };

    conn.send=function(data){
      if(data?.type==='welcome'&&Number.isInteger(data.slot)){
        conn.__locomotionSlot=data.slot;
        const group=pendingGroups.shift();
        if(group){
          slotToGroup.set(data.slot,group);
          const state=stateFor(group);
          state.slot=data.slot;
        }
      }
      if(data?.type==='scene') observeScene(data);
      return previousSend(data);
    };

    return conn;
  }

  Peer.prototype.on=function(event,handler,...rest){
    if(event==='connection'&&typeof handler==='function'){
      return rawPeerOn.call(this,event,conn=>handler(patchStageConnection(conn)),...rest);
    }
    return rawPeerOn.call(this,event,handler,...rest);
  };

  function groupsIn(engine){
    const groups=new Map();
    for(const body of engine.world.bodies){
      if(body.isStatic) continue;
      const group=body.collisionFilter?.group||0;
      if(group>=0) continue;
      if(!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(body);
    }
    return groups;
  }

  function partsOf(bodies){
    const parts={};
    for(const body of bodies){
      const name=body.plugin?.puppetalkPart;
      if(name) parts[name]=body;

      // Pre-segmented puppets keep the canonical control body on the proximal
      // half and mark the hidden lower half separately. Walking must act on the
      // real distal shin/foot, not a point projected beyond the proximal body.
      const segmentPart=body.plugin?.puppetalkSegmentPart;
      const segment=body.plugin?.puppetalkSegment;
      if(segmentPart && segment==='distal') parts[`${segmentPart}2`]=body;
    }
    return parts;
  }

  function endPoint(body,length=25){
    if(!body) return {x:0,y:0};
    return {
      x:body.position.x-Math.sin(body.angle)*length,
      y:body.position.y+Math.cos(body.angle)*length
    };
  }

  function footBody(parts,side){
    const key=side==='left'?'shL':'shR';
    return parts[`${key}2`] || parts[key] || null;
  }

  function footPoint(parts,side){
    const key=side==='left'?'shL':'shR';
    const body=footBody(parts,side);
    if(!body) return {x:0,y:0};
    return endPoint(body,parts[`${key}2`]===body?13.5:25);
  }

  function stageMetrics(engine){
    let floor=null;
    for(const body of engine.world.bodies){
      if(!body.isStatic) continue;
      const width=body.bounds.max.x-body.bounds.min.x;
      const height=body.bounds.max.y-body.bounds.min.y;
      if(width<height*2.5) continue;
      if(!floor||width>floor.width) floor={body,width};
    }
    if(!floor) return {width:360,floorY:330};
    return {
      width:Math.max(320,floor.width-160),
      floorY:floor.body.bounds.min.y
    };
  }

  function pullStep(body,point,target,stiffness=.00015,damping=.0095,cap=.013){
    if(!body) return;
    const mass=Math.max(.2,body.mass||1);
    let fx=((target.x-point.x)*stiffness-body.velocity.x*damping)*mass;
    let fy=((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;
    const mag=Math.hypot(fx,fy);
    if(mag>cap){fx*=cap/mag;fy*=cap/mag;}

    // Apply at the segment centre. Applying a strong lateral correction at the
    // foot point itself turns the lower leg into a lever and can catapult it.
    Body.applyForce(body,body.position,{x:fx,y:fy});
  }

  function footHeld(input,side){
    return normalizedGrabs(input).some(g=>g.part===`${side}Foot`);
  }

  function beginStep(state,side,fromX,endX,floorY,now){
    if(!state.feet||state.step||now<state.stepCooldownUntil) return;
    state.step={
      side,
      startedAt:now,
      duration:360,
      fromX,
      toX:endX,
      floorY
    };
    state.nextFoot=side==='left'?'right':'left';
  }

  function driveWalking(engine,group,bodies,now){
    const state=stateFor(group);
    const input=state.input;
    if(!input) return;

    const parts=partsOf(bodies);
    const torso=parts.torso;
    if(!torso) return;

    if(input.rag){
      state.feet=null;
      state.step=null;
      state.walkUntil=0;
      return;
    }

    const torsoGrab=normalizedGrabs(input).find(g=>g.part==='torso');
    if(torsoGrab) state.walkUntil=now+140;
    const locomoting=!!torsoGrab||!!state.step||now<state.walkUntil;
    if(!locomoting){
      state.feet=null;
      return;
    }

    const metrics=stageMetrics(engine);
    const floorY=metrics.floorY-2;
    const leftPoint=footPoint(parts,'left');
    const rightPoint=footPoint(parts,'right');

    if(!state.feet){
      state.feet={
        left:{x:leftPoint.x,y:floorY},
        right:{x:rightPoint.x,y:floorY}
      };
      state.nextFoot=leftPoint.x<=rightPoint.x?'left':'right';
    }

    // The non-stepping foot is not nailed to an old world coordinate. Record its
    // real ground position and let Matter friction/gravity provide the plant.
    // This avoids storing spring energy while the torso is dragged sideways.
    if(!state.step || state.step.side!=='left'){
      if(Math.abs(leftPoint.y-floorY)<24) state.feet.left={x:leftPoint.x,y:floorY};
    }
    if(!state.step || state.step.side!=='right'){
      if(Math.abs(rightPoint.y-floorY)<24) state.feet.right={x:rightPoint.x,y:floorY};
    }

    if(torsoGrab&&Number.isFinite(torsoGrab.x)){
      const desiredX=torsoGrab.x*metrics.width;
      const deltaX=desiredX-torso.position.x;
      const dir=Math.abs(deltaX)>12?Math.sign(deltaX):0;

      if(!state.step&&dir&&now>=state.stepCooldownUntil){
        const leftBehind=(torso.position.x-leftPoint.x)*dir;
        const rightBehind=(torso.position.x-rightPoint.x)*dir;
        const trailing=leftBehind>rightBehind?'left':'right';
        const stretch=Math.max(leftBehind,rightBehind);
        if(stretch>42&&!footHeld(input,trailing)){
          const from=trailing==='left'?leftPoint:rightPoint;
          beginStep(state,trailing,from.x,torso.position.x+dir*25,floorY,now);
        }
      }
    }

    let steppingSide=null;
    let stepTarget=null;
    if(state.step){
      const t=clamp((now-state.step.startedAt)/state.step.duration,0,1);
      const eased=smoothstep(t);
      steppingSide=state.step.side;
      stepTarget={
        x:lerp(state.step.fromX,state.step.toX,eased),
        y:state.step.floorY-Math.sin(Math.PI*t)*12
      };
      if(t>=1){
        state.feet[steppingSide]={x:state.step.toX,y:state.step.floorY};
        state.step=null;
        state.stepCooldownUntil=now+120;
        steppingSide=null;
        stepTarget=null;
      }
    }

    // Only the foot that is actually taking a step gets an active positional
    // assist. A planted foot receives no spring force at all: gravity + floor
    // collision hold it down, so there is nothing here that can launch a leg.
    if(steppingSide&&stepTarget&&!footHeld(input,steppingSide)){
      const body=footBody(parts,steppingSide);
      const point=footPoint(parts,steppingSide);
      pullStep(body,point,stepTarget,.00015,.0095,.013);
    }
  }

  Engine.update=function(engine,delta=1000/60,correction){
    const now=performance.now();
    for(const [group,bodies] of groupsIn(engine)) driveWalking(engine,group,bodies,now);
    return rawEngineUpdate(engine,delta,correction);
  };

  window.PuppetalkLocomotion={version:33};
})();
