const app = document.querySelector('#app');
const qs = new URLSearchParams(location.search);
const mode = qs.get('mode') === 'controller' ? 'controller' : 'stage';
const room = clean(qs.get('room'));

const COLORS = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8'];
const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];
const POSES = {
  stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
};
const GRAB_PARTS = new Set(['torso','head','leftHand','rightHand','leftFoot','rightFoot']);

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const peerId = r => `puppetalk-${r.toLowerCase()}`;
const send = (conn,msg) => { if(conn?.open) conn.send(msg); };

function roomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}
function angleDelta(target,current){
  let d = target-current;
  while(d > Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return d;
}

if(mode === 'controller') startController(room);
else startStage(room || roomCode());

function startStage(room){
  if(!window.Matter || !window.Peer){
    app.textContent = 'Puppetalk libraries failed to load.';
    return;
  }

  const stageUrl = new URL(location.href);
  stageUrl.search = '';
  stageUrl.searchParams.set('room',room);
  history.replaceState(null,'',stageUrl);

  const joinUrl = new URL(location.href);
  joinUrl.search = '';
  joinUrl.searchParams.set('mode','controller');
  joinUrl.searchParams.set('room',room);

  app.innerHTML = `
    <section class="stage-shell">
      <div class="stage-topbar">
        <div class="brand">
          <strong>Puppetalk</strong>
          <div class="small muted" id="stage-status">opening stage…</div>
        </div>
        <div class="join-card">
          <div class="small muted">JOIN ROOM</div>
          <div class="room-code">${room}</div>
          <div class="small muted join-link">${joinUrl.href}</div>
        </div>
      </div>
      <canvas id="stage-canvas" aria-label="Puppetalk ensemble stage"></canvas>
    </section>`;

  const canvas = document.querySelector('#stage-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#stage-status');
  const {Engine,Bodies,Body,Composite,Constraint,Vector} = Matter;
  const engine = Engine.create({enableSleeping:false});
  engine.gravity.y = 1.05;
  engine.gravity.scale = .001;

  let W = 1;
  let H = 1;
  let last = performance.now();
  let lastSceneSent = 0;
  let bounds = [];
  const puppets = new Map();
  const conns = new Map();

  function resize(){
    W = Math.max(innerWidth,320);
    H = Math.max(innerHeight,360);
    const dpr = Math.min(devicePixelRatio || 1,2);
    canvas.width = Math.round(W*dpr);
    canvas.height = Math.round(H*dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    bounds.forEach(body=>Composite.remove(engine.world,body));
    bounds = [
      Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];
    Composite.add(engine.world,bounds);
  }

  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

  function makePuppet(slot){
    if(puppets.has(slot)) return puppets.get(slot);
    const x = W*(.16+slot*.135);
    const y = Math.min(H-170,H*.62);
    const group = Body.nextGroup(true);
    const opt = {collisionFilter:{group},frictionAir:.04,restitution:.08,friction:.8};
    const torso = Bodies.rectangle(x,y,48,78,{...opt,chamfer:{radius:13},density:.0022});
    const head = Bodies.circle(x,y-65,26,{...opt,density:.0018});
    const uaL = Bodies.rectangle(x-37,y-17,16,52,opt);
    const faL = Bodies.rectangle(x-42,y+30,15,49,opt);
    const uaR = Bodies.rectangle(x+37,y-17,16,52,opt);
    const faR = Bodies.rectangle(x+42,y+30,15,49,opt);
    const thL = Bodies.rectangle(x-14,y+65,19,58,opt);
    const shL = Bodies.rectangle(x-14,y+118,17,54,opt);
    const thR = Bodies.rectangle(x+14,y+65,19,58,opt);
    const shR = Bodies.rectangle(x+14,y+118,17,54,opt);
    const constraints = [
      joint(torso,{x:0,y:-39},head,{x:0,y:24}),
      joint(torso,{x:-24,y:-27},uaL,{x:0,y:-25}),
      joint(uaL,{x:0,y:25},faL,{x:0,y:-23}),
      joint(torso,{x:24,y:-27},uaR,{x:0,y:-25}),
      joint(uaR,{x:0,y:25},faR,{x:0,y:-23}),
      joint(torso,{x:-14,y:38},thL,{x:0,y:-27}),
      joint(thL,{x:0,y:27},shL,{x:0,y:-25}),
      joint(torso,{x:14,y:38},thR,{x:0,y:-27}),
      joint(thR,{x:0,y:27},shR,{x:0,y:-25})
    ];
    const puppet = {
      slot,
      name:NAMES[slot] || `Puppet ${slot+1}`,
      color:COLORS[slot] || '#aaa',
      torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,
      bodies:[torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR],
      constraints,
      target:{x:x/W,y:y/H},
      grabTarget:{x:x/W,y:y/H},
      grabPart:'torso',
      grabbing:false,
      pose:'stand',
      rag:false,
      mouth:0
    };
    Composite.add(engine.world,[...puppet.bodies,...constraints]);
    puppets.set(slot,puppet);
    return puppet;
  }

  function removePuppet(slot){
    const p = puppets.get(slot);
    if(!p) return;
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));
    puppets.delete(slot);
  }

  function servo(body,target,strength=.006){
    body.torque += clamp(angleDelta(target,body.angle)*strength-body.angularVelocity*strength*.72,-.028,.028);
  }

  function worldPoint(body,local){
    const r = Vector.rotate(local,body.angle);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }

  function grabBody(p,part){
    if(part === 'head') return p.head;
    if(part === 'leftHand') return p.faL;
    if(part === 'rightHand') return p.faR;
    if(part === 'leftFoot') return p.shL;
    if(part === 'rightFoot') return p.shR;
    return p.torso;
  }

  function grabWorldPoint(p,part){
    if(part === 'leftHand') return worldPoint(p.faL,{x:0,y:23});
    if(part === 'rightHand') return worldPoint(p.faR,{x:0,y:23});
    if(part === 'leftFoot') return worldPoint(p.shL,{x:0,y:25});
    if(part === 'rightFoot') return worldPoint(p.shR,{x:0,y:25});
    return grabBody(p,part).position;
  }

  function drivePuppet(p){
    const t = p.torso;
    const limbGrab = p.grabbing && p.grabPart !== 'torso';
    const anchorPull = p.rag ? .000045 : limbGrab ? .000034 : .000075;
    const anchorX = clamp(p.target.x*W,70,W-70);
    const anchorY = clamp(p.target.y*H,110,H-82);
    Body.applyForce(t,t.position,{
      x:(anchorX-t.position.x)*anchorPull-t.velocity.x*.0022,
      y:(anchorY-t.position.y)*anchorPull-t.velocity.y*.0022
    });

    if(limbGrab){
      const body = grabBody(p,p.grabPart);
      const point = grabWorldPoint(p,p.grabPart);
      const gx = clamp(p.grabTarget.x*W,20,W-20);
      const gy = clamp(p.grabTarget.y*H,40,H-30);
      const handOrFoot = p.grabPart.includes('Hand') || p.grabPart.includes('Foot');
      const pull = p.rag ? .000026 : handOrFoot ? .000032 : .000041;
      Body.applyForce(body,point,{
        x:(gx-point.x)*pull-body.velocity.x*.0011,
        y:(gy-point.y)*pull-body.velocity.y*.0011
      });
    }

    if(p.rag) return;
    const q = POSES[p.pose] || POSES.stand;
    const base = q[8];
    const muscle = limbGrab ? .72 : 1;
    servo(t,base,.008*muscle);
    servo(p.head,base*.35,.0045*muscle);
    [p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].forEach((body,i)=>{
      servo(body,base+q[i],(i%2?.005:.006)*muscle);
    });
  }

  function norm(point){ return {x:point.x/W,y:point.y/H}; }
  function anatomy(p){
    const t = p.torso;
    return {
      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,
      torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},
      head:{x:p.head.position.x/W,y:p.head.position.y/H,a:p.head.angle},
      sl:norm(worldPoint(t,{x:-24,y:-27})),sr:norm(worldPoint(t,{x:24,y:-27})),
      el:norm(worldPoint(p.uaL,{x:0,y:25})),er:norm(worldPoint(p.uaR,{x:0,y:25})),
      wl:norm(worldPoint(p.faL,{x:0,y:23})),wr:norm(worldPoint(p.faR,{x:0,y:23})),
      hl:norm(worldPoint(t,{x:-14,y:38})),hr:norm(worldPoint(t,{x:14,y:38})),
      kl:norm(worldPoint(p.thL,{x:0,y:27})),kr:norm(worldPoint(p.thR,{x:0,y:27})),
      al:norm(worldPoint(p.shL,{x:0,y:25})),ar:norm(worldPoint(p.shR,{x:0,y:25}))
    };
  }

  function drawStage(){
    drawBackdrop(ctx,W,H);
    puppets.forEach(p=>drawAnatomy(ctx,anatomy(p),W,H,false));
  }

  function broadcastScene(now){
    if(now-lastSceneSent < 66 || !conns.size) return;
    lastSceneSent = now;
    const scene = {type:'scene',puppets:[...puppets.values()].map(anatomy)};
    conns.forEach(conn=>send(conn,scene));
  }

  function tick(now){
    const dt = clamp(now-last,8,25);
    last = now;
    puppets.forEach(drivePuppet);
    Engine.update(engine,dt);
    drawStage();
    broadcastScene(now);
    requestAnimationFrame(tick);
  }

  function updateStatus(extra=''){
    const n = conns.size;
    status.textContent = `${n} puppeteer${n===1?'':'s'} connected${extra ? ' — '+extra : ''}`;
  }
  function freeSlot(){
    for(let i=0;i<6;i++) if(!conns.has(i)) return i;
    return -1;
  }

  function applyInput(slot,msg){
    if(msg?.type !== 'input') return;
    const p = makePuppet(slot);
    const input = msg.input || {};
    if(GRAB_PARTS.has(input.grabPart)) p.grabPart = input.grabPart;
    if(Number.isFinite(input.x)) p.grabTarget.x = clamp(input.x,.02,.98);
    if(Number.isFinite(input.y)) p.grabTarget.y = clamp(input.y,.08,.94);
    if(typeof input.grabbing === 'boolean') p.grabbing = input.grabbing;
    if(p.grabbing && p.grabPart === 'torso'){
      if(Number.isFinite(input.x)) p.target.x = clamp(input.x,.04,.96);
      if(Number.isFinite(input.y)) p.target.y = clamp(input.y,.18,.9);
    }
    if(POSES[input.pose]) p.pose = input.pose;
    if(typeof input.rag === 'boolean') p.rag = input.rag;
    if(Number.isInteger(input.mouth)) p.mouth = clamp(input.mouth,0,2);
  }

  const peer = new Peer(peerId(room));
  peer.on('open',()=>status.textContent='stage live — waiting for puppeteers');
  peer.on('connection',conn=>{
    const slot = freeSlot();
    if(slot < 0){
      conn.on('open',()=>{send(conn,{type:'full'});setTimeout(()=>conn.close(),120);});
      return;
    }
    conns.set(slot,conn);
    makePuppet(slot);
    conn.on('open',()=>{
      send(conn,{type:'welcome',slot,name:NAMES[slot]});
      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy)});
      updateStatus();
    });
    conn.on('data',msg=>applyInput(slot,msg));
    const goodbye = ()=>{
      if(conns.get(slot) !== conn) return;
      conns.delete(slot);
      removePuppet(slot);
      updateStatus();
    };
    conn.on('close',goodbye);
    conn.on('error',goodbye);
  });
  peer.on('error',err=>{
    console.error(err);
    status.textContent = err.type === 'unavailable-id' ? 'table already in use — start another' : `network error: ${err.type || 'unknown'}`;
  });

  addEventListener('resize',resize,{passive:true});
  resize();
  requestAnimationFrame(tick);
}

function startController(room){
  if(!window.Peer){
    app.textContent = 'Puppetalk network library failed to load.';
    return;
  }
  if(!room){
    app.innerHTML = `<section class="join-form"><div class="join-panel card"><strong>Puppetalk</strong><div class="muted small">This invite is incomplete.</div></div></section>`;
    return;
  }

  app.innerHTML = `
    <section class="shell controller-shell personal-controller">
      <header class="controller-head">
        <div><strong>Puppetalk</strong><div class="small muted">room ${room}</div></div>
        <div class="small"><span class="status-dot" id="dot"></span><span id="controller-status">connecting</span></div>
      </header>

      <section class="personal-stage" id="personal-stage">
        <canvas id="personal-canvas" aria-label="Your Puppetalk scene"></canvas>
        <div class="personal-stage-hint" id="stage-hint">Connecting to the ensemble…</div>
        <div class="you-chip" id="you-chip" hidden>YOU</div>
      </section>

      <section class="card compact-controls">
        <div class="control-title"><span>Pose</span><span class="small muted">grab body, head, hands or feet</span></div>
        <div class="pose-strip" id="poses">
          ${Object.keys(POSES).map((pose,i)=>`<button data-pose="${pose}" class="${i?'':'active'}">${pose}</button>`).join('')}
          <button data-rag>Go limp</button>
        </div>
      </section>

      <section class="card voice-card compact-voice">
        <div class="control-title"><span>Voice mouth</span><span class="small muted">audio stays on this phone</span></div>
        <div class="voice-meter"><span id="level"></span></div>
        <div class="voice-actions">
          <button class="primary" id="mic">Enable microphone</button>
          <button id="talk">Hold to talk</button>
        </div>
      </section>

      <div class="controller-footer">
        <button id="centre">Centre me</button>
        <button id="retry">Reconnect</button>
      </div>
    </section>`;

  const canvas = document.querySelector('#personal-canvas');
  const ctx = canvas.getContext('2d');
  const stageBox = document.querySelector('#personal-stage');
  const hint = document.querySelector('#stage-hint');
  const youChip = document.querySelector('#you-chip');
  const dot = document.querySelector('#dot');
  const status = document.querySelector('#controller-status');
  const micButton = document.querySelector('#mic');
  const level = document.querySelector('#level');
  const talkButton = document.querySelector('#talk');

  let peer;
  let conn;
  let slot = null;
  let scene = [];
  let micStop = null;
  let manualTimer = null;
  let centreTimer = null;
  let cw = 1;
  let ch = 1;
  let dragging = false;
  let lastSent = '';
  const input = {x:.5,y:.55,pose:'stand',rag:false,mouth:0,grabPart:'torso',grabbing:false};

  function setStatus(text,state=''){
    status.textContent = text;
    dot.className = `status-dot ${state}`;
  }

  function resizeCanvas(){
    const rect = stageBox.getBoundingClientRect();
    cw = Math.max(280,rect.width);
    ch = Math.max(250,Math.min(cw*.8,430));
    const dpr = Math.min(devicePixelRatio || 1,2);
    canvas.width = Math.round(cw*dpr);
    canvas.height = Math.round(ch*dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    stageBox.style.minHeight = `${ch}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    renderPersonalScene();
  }

  function transmit(force=false){
    if(!conn?.open) return;
    const body = JSON.stringify(input);
    if(!force && body === lastSent) return;
    lastSent = body;
    send(conn,{type:'input',input});
  }

  function connect(){
    if(peer && !peer.destroyed) peer.destroy();
    setStatus('connecting');
    hint.textContent = 'Connecting to the ensemble…';
    peer = new Peer();
    peer.on('open',()=>{
      setStatus('joining…');
      conn = peer.connect(peerId(room),{serialization:'json'});
      conn.on('data',msg=>{
        if(msg?.type === 'welcome'){
          slot = msg.slot;
          setStatus(`you are ${NAMES[slot] || msg.name}`,'live');
          youChip.hidden = false;
          hint.textContent = 'Grab the body, head, hands or feet';
          setTimeout(()=>hint.classList.add('quiet'),3000);
          lastSent = '';
          transmit(true);
        }
        if(msg?.type === 'scene'){
          scene = Array.isArray(msg.puppets) ? msg.puppets : [];
          renderPersonalScene();
        }
        if(msg?.type === 'full'){
          setStatus('table is full','bad');
          hint.textContent = 'This table already has six puppeteers.';
        }
      });
      conn.on('close',()=>setStatus('table disconnected','bad'));
      conn.on('error',()=>setStatus('connection error','bad'));
    });
    peer.on('error',err=>{
      setStatus(err.type === 'peer-unavailable' ? 'table not found' : `network error: ${err.type || 'unknown'}`,'bad');
    });
  }

  function myPuppet(){ return scene.find(p=>p.slot === slot); }
  function grabSpots(p){
    if(!p) return [];
    return [
      {part:'head',label:'head',q:p.head,r:42},
      {part:'leftHand',label:'left hand',q:p.wl,r:34},
      {part:'rightHand',label:'right hand',q:p.wr,r:34},
      {part:'leftFoot',label:'left foot',q:p.al,r:34},
      {part:'rightFoot',label:'right foot',q:p.ar,r:34},
      {part:'torso',label:'body',q:p.torso,r:58}
    ];
  }

  function renderGrabHandles(p){
    if(!p) return;
    ctx.save();
    grabSpots(p).forEach(spot=>{
      const x = spot.q.x*cw;
      const y = spot.q.y*ch;
      const selected = dragging && input.grabPart === spot.part;
      ctx.beginPath();
      ctx.arc(x,y,selected ? 12 : 7,0,Math.PI*2);
      ctx.fillStyle = selected ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.07)';
      ctx.fill();
      ctx.strokeStyle = selected ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.27)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
    });
    ctx.restore();
  }

  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    if(!scene.length) return;
    scene.filter(p=>p.slot !== slot).forEach(p=>drawAnatomy(ctx,p,cw,ch,false,.48));
    const mine = myPuppet();
    if(mine){
      drawAnatomy(ctx,mine,cw,ch,true,1);
      renderGrabHandles(mine);
    }
  }

  function pointerToWorld(event){
    const rect = canvas.getBoundingClientRect();
    return {
      x:clamp((event.clientX-rect.left)/rect.width,.02,.98),
      y:clamp((event.clientY-rect.top)/rect.height,.08,.94)
    };
  }

  function pickGrab(event){
    const mine = myPuppet();
    if(!mine) return null;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX-rect.left;
    const py = event.clientY-rect.top;
    let best = null;
    for(const spot of grabSpots(mine)){
      const x = spot.q.x*rect.width;
      const y = spot.q.y*rect.height;
      const distance = Math.hypot(px-x,py-y);
      if(distance <= spot.r && (!best || distance < best.distance)) best = {...spot,distance};
    }
    return best;
  }

  canvas.addEventListener('pointerdown',event=>{
    const grab = pickGrab(event);
    if(!grab) return;
    if(centreTimer){ clearTimeout(centreTimer); centreTimer = null; }
    dragging = true;
    input.grabPart = grab.part;
    input.grabbing = true;
    canvas.setPointerCapture(event.pointerId);
    const p = pointerToWorld(event);
    input.x = p.x;
    input.y = p.y;
    hint.classList.remove('quiet');
    hint.textContent = `Pulling ${grab.label}`;
    renderPersonalScene();
    transmit(true);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!dragging) return;
    const p = pointerToWorld(event);
    input.x = p.x;
    input.y = p.y;
    transmit();
  });
  const stopDrag = ()=>{
    if(!dragging) return;
    dragging = false;
    input.grabbing = false;
    hint.textContent = 'Grab another part, or choose a pose';
    hint.classList.add('quiet');
    renderPersonalScene();
    transmit(true);
  };
  canvas.addEventListener('pointerup',stopDrag);
  canvas.addEventListener('pointercancel',stopDrag);

  document.querySelector('#poses').addEventListener('click',event=>{
    const button = event.target.closest('button');
    if(!button) return;
    if(button.dataset.pose){
      input.pose = button.dataset.pose;
      input.rag = false;
      document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b===button));
      const rag = document.querySelector('[data-rag]');
      rag.classList.remove('active');
      rag.textContent = 'Go limp';
      transmit(true);
      return;
    }
    if(button.hasAttribute('data-rag')){
      input.rag = !input.rag;
      button.classList.toggle('active',input.rag);
      button.textContent = input.rag ? 'Recover' : 'Go limp';
      transmit(true);
    }
  });

  document.querySelector('#centre').addEventListener('click',()=>{
    input.grabPart = 'torso';
    input.grabbing = true;
    input.x = .5;
    input.y = .55;
    transmit(true);
    if(centreTimer) clearTimeout(centreTimer);
    centreTimer = setTimeout(()=>{
      input.grabbing = false;
      transmit(true);
      centreTimer = null;
    },120);
  });
  document.querySelector('#retry').addEventListener('click',connect);

  async function enableMic(){
    if(micStop){
      micStop();
      micStop = null;
      micButton.textContent = 'Enable microphone';
      input.mouth = 0;
      level.style.width = '0%';
      transmit(true);
      return;
    }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const audio = new AudioContext();
      const source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = .45;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let lastMouth = -1;
      let lastUpdate = 0;
      const sample = now=>{
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for(const value of data){
          const n = (value-128)/128;
          sum += n*n;
        }
        const rms = Math.sqrt(sum/data.length);
        level.style.width = `${clamp(rms*540,0,100)}%`;
        let mouth = 0;
        if(rms > .028) mouth = rms > .105 ? 2 : 1;
        if(mouth !== lastMouth && now-lastUpdate > 45){
          input.mouth = mouth;
          lastMouth = mouth;
          lastUpdate = now;
          transmit(true);
        }
        raf = requestAnimationFrame(sample);
      };
      raf = requestAnimationFrame(sample);
      micStop = ()=>{
        cancelAnimationFrame(raf);
        stream.getTracks().forEach(track=>track.stop());
        audio.close();
      };
      micButton.textContent = 'Disable microphone';
    }catch(err){
      console.error(err);
      setStatus('microphone unavailable','bad');
    }
  }
  micButton.addEventListener('click',enableMic);

  function startManualTalk(event){
    event.preventDefault();
    if(manualTimer) return;
    let phase = 0;
    const chatter = ()=>{
      phase = (phase+1)%3;
      input.mouth = phase === 0 ? 1 : phase === 1 ? 2 : 1;
      transmit(true);
    };
    chatter();
    manualTimer = setInterval(chatter,95);
    talkButton.classList.add('active');
  }
  function stopManualTalk(){
    if(manualTimer){ clearInterval(manualTimer); manualTimer = null; }
    input.mouth = 0;
    talkButton.classList.remove('active');
    transmit(true);
  }
  talkButton.addEventListener('pointerdown',startManualTalk);
  talkButton.addEventListener('pointerup',stopManualTalk);
  talkButton.addEventListener('pointercancel',stopManualTalk);
  talkButton.addEventListener('pointerleave',event=>{ if(event.buttons) stopManualTalk(); });

  addEventListener('resize',resizeCanvas,{passive:true});
  resizeCanvas();
  connect();
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

function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){
  if(!p?.torso || !p?.head) return;
  const scale = Math.min(w/900,h/650);
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
