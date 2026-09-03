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

  function pullPoint(body,point,target,stiffness=.00018,damping=.0095,cap=.020){
    if(!body) return;
    const mass=Math.max(.2,body.mass||1);
    let fx=((target.x-point.x)*stiffness-body.velocity.x*damping)*mass;
    let fy=((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;
    const mag=Math.hypot(fx,fy);
    if(mag>cap){fx*=cap/mag;fy*=cap/mag;}
    Body.applyForce(body,point,{x:fx,y:fy});
  }

  function footHeld(input,side){
    return normalizedGrabs(input).some(g=>g.part===`${side}Foot`);
  }

  function beginStep(state,side,endX,floorY,now){
    if(!state.feet||state.step||now<state.stepCooldownUntil) return;
    const anchor=state.feet[side];
    state.step={
      side,
      startedAt:now,
      duration:420,
      fromX:anchor.x,
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
    if(torsoGrab) state.walkUntil=now+180;
    const locomoting=!!torsoGrab||!!state.step||now<state.walkUntil;
    if(!locomoting){
      state.feet=null;
      return;
    }

    const metrics=stageMetrics(engine);
    const leftPoint=endPoint(parts.shL,25);
    const rightPoint=endPoint(parts.shR,25);

    if(!state.feet){
      state.feet={
        left:{x:leftPoint.x,y:leftPoint.y},
        right:{x:rightPoint.x,y:rightPoint.y}
      };
      state.nextFoot=leftPoint.x<=rightPoint.x?'left':'right';
    }

    if(torsoGrab&&Number.isFinite(torsoGrab.x)){
      const desiredX=torsoGrab.x*metrics.width;
      const deltaX=desiredX-torso.position.x;
      const dir=Math.abs(deltaX)>14?Math.sign(deltaX):0;

      if(!state.step&&dir&&now>=state.stepCooldownUntil){
        const leftBehind=(torso.position.x-state.feet.left.x)*dir;
        const rightBehind=(torso.position.x-state.feet.right.x)*dir;
        const trailing=leftBehind>rightBehind?'left':'right';
        const stretch=Math.max(leftBehind,rightBehind);
        if(stretch>58&&!footHeld(input,trailing)){
          beginStep(state,trailing,torso.position.x+dir*27,metrics.floorY-2,now);
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
        y:state.step.floorY-Math.sin(Math.PI*t)*16
      };
      if(t>=1){
        state.feet[steppingSide]={x:state.step.toX,y:state.step.floorY};
        state.step=null;
        state.stepCooldownUntil=now+190;
        steppingSide=null;
        stepTarget=null;
      }
    }

    const leftHeld=footHeld(input,'left');
    const rightHeld=footHeld(input,'right');

    if(!leftHeld){
      const target=steppingSide==='left'&&stepTarget?stepTarget:state.feet.left;
      pullPoint(parts.shL,endPoint(parts.shL,25),target,steppingSide==='left'?.00024:.00017,.0105,steppingSide==='left'?.021:.017);
    }
    if(!rightHeld){
      const target=steppingSide==='right'&&stepTarget?stepTarget:state.feet.right;
      pullPoint(parts.shR,endPoint(parts.shR,25),target,steppingSide==='right'?.00024:.00017,.0105,steppingSide==='right'?.021:.017);
    }
  }

  Engine.update=function(engine,delta=1000/60,correction){
    const now=performance.now();
    for(const [group,bodies] of groupsIn(engine)) driveWalking(engine,group,bodies,now);
    return rawEngineUpdate(engine,delta,correction);
  };

  window.PuppetalkLocomotion={version:32};
})();
