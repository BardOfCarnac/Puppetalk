(()=>{
  const M = window.Matter;
  const Peer = window.Peer;
  if(!M || !Peer) return;

  const {Body,Engine} = M;
  const rawNextGroup = Body.nextGroup.bind(Body);
  const rawPeerConnect = Peer.prototype.connect;
  const rawPeerOn = Peer.prototype.on;
  const rawEngineUpdate = Engine.update.bind(Engine);

  const pendingGroups = [];
  const slotToGroup = new Map();
  const states = new Map();
  const pageMode = new URLSearchParams(location.search).get('mode');

  let controllerScene = [];
  let controllerSlot = null;
  let controllerInput = {grabs:[]};
  let overlay = null;
  let overlayCtx = null;
  let overlayBox = null;
  let overlayW = 1;
  let overlayH = 1;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const smoothstep = t=>{
    t = clamp(t,0,1);
    return t*t*(3-2*t);
  };

  function stateFor(group){
    if(!states.has(group)) states.set(group,{
      slot:null,
      input:null,
      depth:0,
      depthTarget:0,
      torsoSession:null,
      feet:null,
      step:null,
      nextFoot:'left',
      strideDepth:0,
      lastDepth:0,
      walkUntil:0,
      rawTorso:{x:.5,y:.6}
    });
    return states.get(group);
  }

  function depthScale(depth){
    return clamp(1+depth*.62,.76,1.64);
  }

  Body.nextGroup = function(nonColliding){
    const group = rawNextGroup(nonColliding);
    if(nonColliding && group < 0) pendingGroups.push(group);
    return group;
  };

  function cloneInput(input){
    return {
      ...input,
      grabs:Array.isArray(input?.grabs) ? input.grabs.map(g=>({...g})) : []
    };
  }

  function normalizedGrabs(input){
    if(Array.isArray(input?.grabs)) return input.grabs.filter(g=>g && typeof g.part === 'string');
    if(input?.grabbing && input?.grabPart){
      return [{part:input.grabPart,x:input.x,y:input.y}];
    }
    return [];
  }

  function observeOriginalInput(group,input){
    const state = stateFor(group);
    const copy = cloneInput(input || {});
    copy.grabs = normalizedGrabs(copy).map(g=>({...g}));
    state.input = copy;

    const torsoGrab = copy.grabs.find(g=>g.part === 'torso');
    if(torsoGrab && Number.isFinite(torsoGrab.y)){
      if(!state.torsoSession){
        state.torsoSession = {
          startPointerY:torsoGrab.y,
          startDepth:state.depthTarget,
          holdPhysicsY:state.rawTorso?.y ?? torsoGrab.y
        };
      }
      const dy = torsoGrab.y-state.torsoSession.startPointerY;
      state.depthTarget = clamp(state.torsoSession.startDepth+dy*2.15,-.34,1.02);
      state.walkUntil = performance.now()+280;
    }else{
      state.torsoSession = null;
    }
  }

  function inverseProjectedGrab(state,grab){
    if(!grab || !Number.isFinite(grab.x) || !Number.isFinite(grab.y)) return {...grab};
    const center = state.rawTorso || {x:.5,y:.6};
    const s = depthScale(state.depth);
    const shiftY = state.depth*.035;
    return {
      ...grab,
      x:clamp(center.x+(grab.x-center.x)/s,.01,.99),
      y:clamp(center.y+(grab.y-shiftY-center.y)/s,.02,.98)
    };
  }

  function inputForPhysics(state,input){
    const copy = cloneInput(input || {});
    copy.grabs = normalizedGrabs(copy).map(grab=>{
      if(grab.part === 'torso'){
        const hold = state.torsoSession?.holdPhysicsY ?? state.rawTorso?.y ?? grab.y;
        return {...grab,y:clamp(hold,.04,.96)};
      }
      return inverseProjectedGrab(state,grab);
    });
    if(!Array.isArray(input?.grabs) && copy.grabs.length === 1){
      const g = copy.grabs[0];
      copy.grabPart = g.part;
      copy.x = g.x;
      copy.y = g.y;
      copy.grabbing = true;
    }
    return copy;
  }

  function projectPoint(point,center,s,shiftY){
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
    return {
      ...point,
      x:center.x+(point.x-center.x)*s,
      y:center.y+(point.y-center.y)*s+shiftY
    };
  }

  function projectPuppet(p){
    const group = slotToGroup.get(p.slot);
    if(!group) return p;
    const state = stateFor(group);
    const center = {x:p.torso?.x ?? .5,y:p.torso?.y ?? .6};
    state.rawTorso = center;
    const s = depthScale(state.depth);
    const shiftY = state.depth*.035;
    const out = {...p,depth:state.depth,visualScale:s};
    for(const key of ['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']){
      if(out[key]) out[key] = projectPoint(out[key],center,s,shiftY);
    }
    return out;
  }

  function projectedScene(data){
    if(!Array.isArray(data?.puppets)) return data;
    const puppets = data.puppets.map(projectPuppet).sort((a,b)=>(a.depth||0)-(b.depth||0));
    return {...data,puppets};
  }

  function patchConnection(conn,side){
    if(!conn || conn.__puppetalkLocomotionPatched) return conn;
    conn.__puppetalkLocomotionPatched = true;
    const previousOn = conn.on.bind(conn);
    const previousSend = conn.send.bind(conn);

    conn.on = function(event,handler){
      if(event === 'data' && typeof handler === 'function'){
        return previousOn(event,data=>{
          if(side === 'controller'){
            if(data?.type === 'welcome' && Number.isInteger(data.slot)) controllerSlot = data.slot;
            if(data?.type === 'scene' && Array.isArray(data.puppets)) controllerScene = data.puppets;
            return handler(data);
          }

          if(side === 'stage' && data?.type === 'input' && Number.isInteger(conn.__locomotionSlot)){
            const group = slotToGroup.get(conn.__locomotionSlot);
            if(group){
              observeOriginalInput(group,data.input || {});
              const adjusted = {...data,input:inputForPhysics(stateFor(group),data.input || {})};
              return handler(adjusted);
            }
          }
          return handler(data);
        });
      }
      return previousOn(event,handler);
    };

    conn.send = function(data){
      if(side === 'stage' && data?.type === 'welcome' && Number.isInteger(data.slot)){
        conn.__locomotionSlot = data.slot;
        const group = pendingGroups.shift();
        if(group){
          slotToGroup.set(data.slot,group);
          stateFor(group).slot = data.slot;
        }
      }

      if(side === 'stage' && data?.type === 'scene'){
        return previousSend(projectedScene(data));
      }

      if(side === 'controller' && data?.type === 'input' && data.input){
        controllerInput = cloneInput(data.input);
        controllerInput.grabs = normalizedGrabs(controllerInput);
      }
      return previousSend(data);
    };

    return conn;
  }

  Peer.prototype.connect = function(...args){
    return patchConnection(rawPeerConnect.apply(this,args),'controller');
  };

  Peer.prototype.on = function(event,handler,...rest){
    if(event === 'connection' && typeof handler === 'function'){
      return rawPeerOn.call(this,event,conn=>handler(patchConnection(conn,'stage')),...rest);
    }
    return rawPeerOn.call(this,event,handler,...rest);
  };

  function groupsIn(engine){
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
      const name = body.plugin?.puppetalkPart;
      if(name) parts[name] = body;
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
    let floor = null;
    for(const body of engine.world.bodies){
      if(!body.isStatic) continue;
      const width = body.bounds.max.x-body.bounds.min.x;
      const height = body.bounds.max.y-body.bounds.min.y;
      if(width < height*2.5) continue;
      if(!floor || width > floor.width) floor = {body,width,height};
    }
    if(!floor) return {width:360,floorY:330};
    return {
      width:Math.max(320,floor.width-160),
      floorY:floor.body.bounds.min.y
    };
  }

  function pullPoint(body,point,target,stiffness=.00030,damping=.0060){
    if(!body) return;
    const mass = Math.max(.2,body.mass || 1);
    let fx = ((target.x-point.x)*stiffness-body.velocity.x*damping)*mass;
    let fy = ((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;
    const mag = Math.hypot(fx,fy);
    const cap = .034;
    if(mag > cap){ fx *= cap/mag; fy *= cap/mag; }
    Body.applyForce(body,point,{x:fx,y:fy});
  }

  function footHeld(input,side){
    return normalizedGrabs(input).some(g=>g.part === `${side}Foot`);
  }

  function beginStep(state,side,endX,floorY,now){
    if(!state.feet || state.step) return;
    const anchor = state.feet[side];
    state.step = {
      side,
      startedAt:now,
      duration:285,
      fromX:anchor.x,
      toX:endX,
      floorY
    };
    state.nextFoot = side === 'left' ? 'right' : 'left';
  }

  function driveLocomotion(engine,group,bodies,now){
    const state = stateFor(group);
    const input = state.input;
    if(!input) return;

    const depthBefore = state.depth;
    state.depth += (state.depthTarget-state.depth)*.115;
    if(Math.abs(state.depthTarget-state.depth) < .0004) state.depth = state.depthTarget;
    const depthTravel = Math.abs(state.depth-depthBefore);

    const parts = partsOf(bodies);
    const torso = parts.torso;
    if(!torso) return;

    if(input.rag){
      state.feet = null;
      state.step = null;
      state.strideDepth = 0;
      state.lastDepth = state.depth;
      return;
    }

    const metrics = stageMetrics(engine);
    const leftPoint = endPoint(parts.shL,25);
    const rightPoint = endPoint(parts.shR,25);
    const torsoGrab = normalizedGrabs(input).find(g=>g.part === 'torso');
    const depthMoving = Math.abs(state.depthTarget-state.depth) > .004 || depthTravel > .0005;
    const locomoting = !!torsoGrab || depthMoving || now < state.walkUntil || !!state.step;

    if(!locomoting){
      state.feet = null;
      state.step = null;
      state.strideDepth = 0;
      state.lastDepth = state.depth;
      return;
    }

    if(!state.feet){
      state.feet = {
        left:{x:leftPoint.x,y:leftPoint.y},
        right:{x:rightPoint.x,y:rightPoint.y}
      };
      state.nextFoot = leftPoint.x <= rightPoint.x ? 'left' : 'right';
    }

    state.walkUntil = Math.max(state.walkUntil,now+120);
    const desiredX = torsoGrab && Number.isFinite(torsoGrab.x) ? torsoGrab.x*metrics.width : torso.position.x;
    const deltaX = desiredX-torso.position.x;
    const dir = Math.abs(deltaX) > 7 ? Math.sign(deltaX) : 0;

    if(!state.step && dir){
      const leftBehind = (torso.position.x-state.feet.left.x)*dir;
      const rightBehind = (torso.position.x-state.feet.right.x)*dir;
      const trailing = leftBehind > rightBehind ? 'left' : 'right';
      const stretch = Math.max(leftBehind,rightBehind);
      if(stretch > 43 && !footHeld(input,trailing)){
        beginStep(state,trailing,torso.position.x+dir*31,metrics.floorY-2,now);
      }
    }

    state.strideDepth += depthTravel*105;
    if(!state.step && !dir && state.strideDepth > 7.5){
      let side = state.nextFoot;
      if(footHeld(input,side)) side = side === 'left' ? 'right' : 'left';
      if(!footHeld(input,side)){
        const offset = side === 'left' ? -17 : 17;
        beginStep(state,side,torso.position.x+offset,metrics.floorY-2,now);
        state.strideDepth = 0;
      }
    }

    let steppingSide = null;
    let stepTarget = null;
    if(state.step){
      const t = clamp((now-state.step.startedAt)/state.step.duration,0,1);
      const eased = smoothstep(t);
      steppingSide = state.step.side;
      stepTarget = {
        x:lerp(state.step.fromX,state.step.toX,eased),
        y:state.step.floorY-Math.sin(Math.PI*t)*21
      };
      if(t >= 1){
        state.feet[steppingSide] = {x:state.step.toX,y:state.step.floorY};
        state.step = null;
        steppingSide = null;
        stepTarget = null;
      }
    }

    const leftHeld = footHeld(input,'left');
    const rightHeld = footHeld(input,'right');

    if(!leftHeld){
      const target = steppingSide === 'left' && stepTarget ? stepTarget : state.feet.left;
      pullPoint(parts.shL,endPoint(parts.shL,25),target,steppingSide === 'left' ? .00035 : .00031,.0062);
    }
    if(!rightHeld){
      const target = steppingSide === 'right' && stepTarget ? stepTarget : state.feet.right;
      pullPoint(parts.shR,endPoint(parts.shR,25),target,steppingSide === 'right' ? .00035 : .00031,.0062);
    }

    state.lastDepth = state.depth;
  }

  Engine.update = function(engine,delta=1000/60,correction){
    const now = performance.now();
    for(const [group,bodies] of groupsIn(engine)) driveLocomotion(engine,group,bodies,now);
    return rawEngineUpdate(engine,delta,correction);
  };

  function roundRect(ctx,x,y,w,h,r){
    if(ctx.roundRect){
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,r);
      return;
    }
    const rr = Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function drawBackdrop(ctx,w,h){
    ctx.clearRect(0,0,w,h);
    const g = ctx.createRadialGradient(w/2,h*.72,10,w/2,h*.72,Math.max(w,h)*.82);
    g.addColorStop(0,'#292b30');
    g.addColorStop(.48,'#17191c');
    g.addColorStop(1,'#0c0d0f');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(255,255,255,.075)';
    ctx.lineWidth = 1;
    for(let x=-w;x<w*2;x+=74){
      ctx.beginPath();
      ctx.moveTo(w/2+(x-w/2)*.22,h*.66);
      ctx.lineTo(x,h-20);
      ctx.stroke();
    }
    for(let y=h*.72;y<h-15;y+=34){
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
    }
  }

  function drawPuppet(ctx,p,w,h,highlight=false,alpha=1){
    if(!p?.torso || !p?.head) return;
    const visual = p.visualScale || 1;
    const scale = Math.min(w/900,h/650)*visual;
    const point = q=>({x:q.x*w,y:q.y*h});
    const chain = (items,color,width)=>{
      const pts = items.map(point);
      ctx.beginPath();
      ctx.moveTo(pts[0].x,pts[0].y);
      pts.slice(1).forEach(q=>ctx.lineTo(q.x,q.y));
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.strokeStyle = '#08090a';
      ctx.lineWidth = Math.max(5,(width+6)*scale);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3,width*scale);
      ctx.stroke();
    };

    ctx.save();
    ctx.globalAlpha = alpha;
    if(highlight){
      const tx = p.torso.x*w;
      const ty = p.torso.y*h;
      ctx.beginPath();
      ctx.arc(tx,ty,Math.max(38,58*scale),0,Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6,7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    chain([p.hl,p.kl,p.al],p.color,17);
    chain([p.hr,p.kr,p.ar],p.color,17);
    chain([p.sl,p.el,p.wl],p.color,15);
    chain([p.sr,p.er,p.wr],p.color,15);

    const tx = p.torso.x*w;
    const ty = p.torso.y*h;
    ctx.save();
    ctx.translate(tx,ty);
    ctx.rotate(p.torso.a || 0);
    const tw = Math.max(20,48*scale);
    const th = Math.max(34,78*scale);
    ctx.fillStyle = '#08090a';
    roundRect(ctx,-tw/2-3,-th/2-3,tw+6,th+6,Math.max(7,13*scale));
    ctx.fill();
    ctx.fillStyle = p.color;
    roundRect(ctx,-tw/2,-th/2,tw,th,Math.max(6,11*scale));
    ctx.fill();
    ctx.restore();

    const hx = p.head.x*w;
    const hy = p.head.y*h;
    const hr = Math.max(13,26*scale);
    ctx.save();
    ctx.translate(hx,hy);
    ctx.rotate(p.head.a || 0);
    ctx.fillStyle = '#08090a';
    ctx.beginPath();ctx.arc(0,0,hr+3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();ctx.arc(0,0,hr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#08090a';
    const eyeY = -hr*.18;
    ctx.beginPath();
    ctx.arc(-hr*.3,eyeY,Math.max(1.8,hr*.1),0,Math.PI*2);
    ctx.arc(hr*.3,eyeY,Math.max(1.8,hr*.1),0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    if(p.mouth === 0) roundRect(ctx,-hr*.27,hr*.34,hr*.54,Math.max(2,hr*.11),2);
    else if(p.mouth === 1) roundRect(ctx,-hr*.28,hr*.22,hr*.56,hr*.38,hr*.16);
    else ctx.ellipse(0,hr*.4,hr*.34,hr*.42,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.font = `${highlight?'700':'600'} ${Math.max(10,12*scale)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = highlight ? '#fff' : 'rgba(255,255,255,.78)';
    ctx.fillText(highlight ? `${p.name} · YOU` : p.name,hx,hy-hr-12);
    ctx.restore();
  }

  function grabSpots(p){
    if(!p) return [];
    const pelvis = {x:(p.hl.x+p.hr.x)*.5,y:(p.hl.y+p.hr.y)*.5};
    return [
      {part:'head',q:p.head},
      {part:'leftShoulder',q:p.sl},
      {part:'rightShoulder',q:p.sr},
      {part:'leftHand',q:p.wl},
      {part:'rightHand',q:p.wr},
      {part:'leftFoot',q:p.al},
      {part:'rightFoot',q:p.ar},
      {part:'pelvis',q:pelvis},
      {part:'torso',q:p.torso}
    ];
  }

  function drawHandles(ctx,p,w,h){
    const active = new Set(normalizedGrabs(controllerInput).map(g=>g.part));
    ctx.save();
    for(const spot of grabSpots(p)){
      const x = spot.q.x*w;
      const y = spot.q.y*h;
      const selected = active.has(spot.part);
      ctx.beginPath();
      ctx.arc(x,y,selected?12:6.5,0,Math.PI*2);
      ctx.fillStyle = selected?'rgba(255,255,255,.26)':'rgba(255,255,255,.065)';
      ctx.fill();
      ctx.strokeStyle = selected?'rgba(255,255,255,.96)':'rgba(255,255,255,.25)';
      ctx.lineWidth = selected?2:1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function ensureOverlay(){
    if(pageMode !== 'controller') return false;
    const original = document.querySelector('#personal-canvas');
    const box = document.querySelector('#personal-stage');
    if(!original || !box) return false;

    if(!overlay){
      overlay = document.createElement('canvas');
      overlay.id = 'locomotion-canvas';
      overlay.setAttribute('aria-hidden','true');
      Object.assign(overlay.style,{
        position:'absolute',
        inset:'0',
        width:'100%',
        height:'100%',
        pointerEvents:'none',
        zIndex:'1'
      });
      box.appendChild(overlay);
      overlayCtx = overlay.getContext('2d');
      original.style.opacity = '0';
      original.style.position = 'relative';
      original.style.zIndex = '0';
      const hint = document.querySelector('#stage-hint');
      const chip = document.querySelector('#you-chip');
      if(hint){ hint.style.position='absolute'; hint.style.zIndex='3'; }
      if(chip){ chip.style.zIndex='3'; }
    }

    overlayBox = box;
    const rect = box.getBoundingClientRect();
    const w = Math.max(280,rect.width);
    const h = Math.max(250,Math.min(w*.8,430));
    if(Math.abs(w-overlayW) > .5 || Math.abs(h-overlayH) > .5){
      overlayW = w;
      overlayH = h;
      const dpr = Math.min(devicePixelRatio || 1,2);
      overlay.width = Math.round(w*dpr);
      overlay.height = Math.round(h*dpr);
      overlay.style.height = `${h}px`;
      overlayCtx.setTransform(dpr,0,0,dpr,0,0);
    }
    return true;
  }

  function renderOverlay(){
    if(!ensureOverlay() || !overlayCtx){
      requestAnimationFrame(renderOverlay);
      return;
    }

    drawBackdrop(overlayCtx,overlayW,overlayH);
    const ordered = [...controllerScene].sort((a,b)=>(a.depth||0)-(b.depth||0));
    for(const p of ordered){
      const mine = p.slot === controllerSlot;
      drawPuppet(overlayCtx,p,overlayW,overlayH,mine,mine?1:.48);
    }
    const mine = controllerScene.find(p=>p.slot === controllerSlot);
    if(mine) drawHandles(overlayCtx,mine,overlayW,overlayH);
    requestAnimationFrame(renderOverlay);
  }

  if(pageMode === 'controller') requestAnimationFrame(renderOverlay);
  window.PuppetalkLocomotion = {version:25};
})();
