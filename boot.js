const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const mode = params.get('mode');
const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const isHostPlayer = mode === 'controller' && params.get('host') === '1';

function makeTableId(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>chars[b % chars.length]).join('');
}

function tableUrl(id){
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('mode','controller');
  url.searchParams.set('room',id);
  url.searchParams.set('host','1');
  return url;
}

function stageUrl(id){
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('mode','stage');
  url.searchParams.set('room',id);
  url.searchParams.set('embedded','1');
  return url;
}

function joinUrl(id){
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('mode','controller');
  url.searchParams.set('room',id);
  return url;
}

function homeUrl(){
  const url = new URL(location.href);
  url.search = '';
  return url;
}

function renderHome(){
  document.title = 'Puppetalk';
  app.innerHTML = `
    <section class="home-shell">
      <div class="home-panel">
        <div>
          <div class="home-brand">Puppetalk</div>
          <p class="home-copy">A shared puppet scene. Everyone sees the whole ensemble on their own phone while controlling their own character.</p>
        </div>
        <div class="home-actions"><button class="primary" id="start-table" type="button">Start a table</button></div>
        <div class="home-note">Starting a table makes this phone Player 1 and hosts the shared physics. Invite everyone else with a link or QR code.</div>
      </div>
    </section>`;
  document.querySelector('#start-table').addEventListener('click',()=>{ location.href = tableUrl(makeTableId()); });
}

function renderBadInvite(){
  app.innerHTML = `
    <section class="home-shell"><div class="home-panel">
      <div class="home-brand">Puppetalk</div>
      <p class="home-copy">This invite is incomplete. Ask the host to send you their Puppetalk invite link again.</p>
      <div class="home-actions"><button id="go-home" type="button">Puppetalk home</button></div>
    </div></section>`;
  document.querySelector('#go-home').addEventListener('click',()=>{ location.href=homeUrl(); });
}

function renderStartupError(detail='The shared scene could not start.'){
  console.error('Puppetalk startup error:',detail);
  app.innerHTML = `
    <section class="home-shell"><div class="home-panel">
      <div class="home-brand">Puppetalk</div>
      <p class="home-copy"><strong>Scene startup failed.</strong><br>${String(detail).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p>
      <div class="home-actions"><button class="primary" id="retry-stage" type="button">Try again</button><button id="error-home" type="button">Puppetalk home</button></div>
      <div class="home-note">This error is being shown instead of leaving you on a blank screen.</div>
    </div></section>`;
  document.querySelector('#retry-stage').addEventListener('click',()=>location.reload());
  document.querySelector('#error-home').addEventListener('click',()=>{ location.href=homeUrl(); });
}

function copyText(text){
  if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly','');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}

function renderQr(target,invite){
  if(window.QRCode && target){
    new QRCode(target,{text:invite,width:80,height:80,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  }
}

function wireInviteButtons(prefix,invite){
  const feedback = document.querySelector(`#${prefix}-feedback`);
  document.querySelector(`#${prefix}-copy`)?.addEventListener('click',async()=>{
    try { await copyText(invite); feedback.textContent='Invite copied.'; }
    catch { feedback.textContent='Could not copy the invite.'; }
  });
  document.querySelector(`#${prefix}-share`)?.addEventListener('click',async()=>{
    try{
      if(navigator.share) await navigator.share({title:'Join my Puppetalk table',text:'Join my Puppetalk table',url:invite});
      else { await copyText(invite); feedback.textContent='Invite copied.'; }
    }catch(err){ if(err?.name !== 'AbortError') feedback.textContent='Sharing unavailable — copy the link instead.'; }
  });
}

function enhanceStage(id){
  const card = document.querySelector('.join-card');
  if(!card) return;
  const invite = joinUrl(id).href;
  card.classList.add('invite-card');
  card.innerHTML = `
    <div class="invite-label">Invite players</div>
    <div class="invite-qr" id="stage-invite-qr" aria-label="QR code for joining this table"></div>
    <div class="invite-copy">
      <div class="invite-title">Scan or share to join</div>
      <div class="invite-url">${invite}</div>
      <div class="invite-actions"><button id="stage-invite-share" type="button">Share invite</button><button id="stage-invite-copy" type="button">Copy link</button></div>
      <div class="invite-feedback" id="stage-invite-feedback"></div>
    </div>`;
  renderQr(document.querySelector('#stage-invite-qr'),invite);
  wireInviteButtons('stage-invite',invite);
}

function openHostInvite(){
  if(document.querySelector('#host-invite-overlay')) return;
  const invite = joinUrl(room).href;
  const overlay = document.createElement('section');
  overlay.id = 'host-invite-overlay';
  overlay.className = 'home-shell';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'1000',background:'rgba(5,6,8,.88)',backdropFilter:'blur(10px)'});
  overlay.innerHTML = `
    <div class="home-panel" role="dialog" aria-modal="true" aria-label="Invite players">
      <div><div class="home-brand" style="font-size:28px">Invite players</div><p class="home-copy">Everyone who joins sees this same full scene and controls their own puppet.</p></div>
      <div style="display:grid;place-items:center"><div class="invite-qr" id="host-invite-qr"></div></div>
      <div class="invite-url" style="font-size:12px">${invite}</div>
      <div class="home-actions"><button class="primary" id="host-invite-share" type="button">Share invite</button><button id="host-invite-copy" type="button">Copy link</button><button id="host-invite-close" type="button">Back to scene</button></div>
      <div class="invite-feedback" id="host-invite-feedback"></div>
    </div>`;
  document.body.appendChild(overlay);
  renderQr(document.querySelector('#host-invite-qr'),invite);
  wireInviteButtons('host-invite',invite);
  document.querySelector('#host-invite-close').addEventListener('click',()=>overlay.remove());
}

function addHostInviteControl(){
  if(!isHostPlayer || document.querySelector('#host-invite')) return;
  const footer = document.querySelector('.controller-footer');
  if(!footer) return;
  const button = document.createElement('button');
  button.id = 'host-invite';
  button.className = 'primary';
  button.type = 'button';
  button.textContent = 'Invite players';
  button.style.gridColumn = '1 / -1';
  button.addEventListener('click',openHostInvite);
  footer.prepend(button);
}

function tidyController(){
  const sub = document.querySelector('.controller-head .muted');
  if(sub) sub.textContent = isHostPlayer ? 'Hosting · full scene' : 'Live table · full scene';
  addHostInviteControl();
}

async function loadAppSource(){
  const response = await fetch('./app.js?v=20',{cache:'no-store'});
  if(!response.ok) throw new Error(`Could not load app.js (${response.status})`);
  let source = await response.text();

  source = source.replace(
    "const room = clean(qs.get('room'));",
    "const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);"
  );
  source = source.replace(
    "const GRAB_PARTS = new Set(['torso','head','leftHand','rightHand','leftFoot','rightFoot']);",
    "const GRAB_PARTS = new Set(['torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot']);"
  );
  source = source.replace(
    "const head = Bodies.circle(x,y-65,26,{...opt,density:.0018});",
    "const head = Bodies.circle(x,y-65,26,{...opt,density:.00068,frictionAir:.06});"
  );
  source = source.replace(
    "  function grabWorldPoint(p,part){\n    if(part === 'leftHand')",
    "  function grabWorldPoint(p,part){\n    if(part === 'pelvis') return worldPoint(p.torso,{x:0,y:34});\n    if(part === 'leftShoulder') return worldPoint(p.torso,{x:-24,y:-27});\n    if(part === 'rightShoulder') return worldPoint(p.torso,{x:24,y:-27});\n    if(part === 'leftHand')"
  );

  const applyInputPattern = /  function applyInput\(slot,msg\)\{[\s\S]*?\n  \}\n\n  const peer =/;
  const multiInput = `  function applyInput(slot,msg){
    if(msg?.type !== 'input') return;
    const p = makePuppet(slot);
    const input = msg.input || {};
    let grabs = Array.isArray(input.grabs) ? input.grabs : [];
    if(!grabs.length && input.grabbing && GRAB_PARTS.has(input.grabPart)){
      grabs = [{part:input.grabPart,x:input.x,y:input.y}];
    }
    p.grabs = grabs.slice(0,2).filter(g=>GRAB_PARTS.has(g?.part)).map(g=>({
      part:g.part,
      x:clamp(Number.isFinite(g.x)?g.x:.5,.02,.98),
      y:clamp(Number.isFinite(g.y)?g.y:.55,.06,.96)
    }));
    p.grabbing = p.grabs.length > 0;
    if(p.grabbing){
      p.grabPart = p.grabs[0].part;
      p.grabTarget.x = p.grabs[0].x;
      p.grabTarget.y = p.grabs[0].y;
    }
    if(POSES[input.pose]) p.pose = input.pose;
    if(Number.isInteger(input.poseVersion)) p.poseVersion = input.poseVersion;
    if(typeof input.rag === 'boolean') p.rag = input.rag;
    if(Number.isInteger(input.mouth)) p.mouth = clamp(input.mouth,0,2);
  }

  const peer =`;
  if(!applyInputPattern.test(source)) throw new Error('Could not install multi-touch network input.');
  source = source.replace(applyInputPattern,multiInput);

  const drivePattern = /  function drivePuppet\(p\)\{[\s\S]*?\n  \}\n\n  function norm\(point\)/;
  const tunedDrive = `  function springPull(body,point,target,stiffness,damping=.003){
    const mass = Math.max(.2,body.mass || 1);
    Body.applyForce(body,point,{
      x:((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,
      y:((target.y-point.y)*stiffness-body.velocity.y*damping)*mass
    });
  }

  function ensureRig(p){
    if(p._rig) return p._rig;
    p._rig = {
      sessions:{},
      lastPose:p.pose,
      lastPoseVersion:p.poseVersion || 0,
      pins:{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null}
    };
    return p._rig;
  }

  function antiTangleTarget(p,part,desired,age){
    if(!(part.includes('Hand') || part.includes('Foot'))) return desired;
    const t = p.torso.position;
    let clear = desired;
    if(part === 'leftHand') clear = {x:t.x-54,y:t.y+4};
    if(part === 'rightHand') clear = {x:t.x+54,y:t.y+4};
    if(part === 'leftFoot') clear = {x:t.x-23,y:t.y+132};
    if(part === 'rightFoot') clear = {x:t.x+23,y:t.y+132};
    const fade = 1-clamp(age/190,0,1);
    const amount = .3*fade;
    return {x:desired.x+(clear.x-desired.x)*amount,y:desired.y+(clear.y-desired.y)*amount};
  }

  function rootFollow(part){
    if(part === 'torso') return 1;
    if(part === 'pelvis') return .92;
    if(part.includes('Shoulder')) return .82;
    if(part === 'head') return .72;
    if(part.includes('Hand')) return .42;
    return .3;
  }

  function drivePuppet(p){
    const t = p.torso;
    const rig = ensureRig(p);
    const floorY = H-31;
    const crouched = p.pose === 'crouch';
    const standingY = floorY-(crouched ? 112 : 145);
    const poseVersion = p.poseVersion || 0;

    if(rig.lastPose !== p.pose || rig.lastPoseVersion !== poseVersion){
      rig.lastPose = p.pose;
      rig.lastPoseVersion = poseVersion;
      rig.pins = {head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null};
    }

    const grabs = Array.isArray(p.grabs) ? p.grabs.slice(0,2) : [];
    const activeParts = new Set(grabs.map(g=>g.part));
    for(const part of Object.keys(rig.sessions)) if(!activeParts.has(part)) delete rig.sessions[part];

    const now = performance.now();
    const prepared = [];
    let rootSum = 0;
    let rootWeight = 0;
    let torsoDesired = null;

    for(const grab of grabs){
      const desired = {x:clamp(grab.x*W,20,W-20),y:clamp(grab.y*H,30,H-24)};
      let session = rig.sessions[grab.part];
      if(!session){
        session = rig.sessions[grab.part] = {
          startDesired:{x:desired.x,y:desired.y},
          startRootX:p.target.x*W,
          startTorsoY:t.position.y,
          startedAt:now
        };
      }
      const age = now-session.startedAt;
      const guided = antiTangleTarget(p,grab.part,desired,age);
      const follow = rootFollow(grab.part);
      const rootX = grab.part === 'torso' || grab.part === 'pelvis'
        ? desired.x
        : session.startRootX+(desired.x-session.startDesired.x)*follow;
      const weight = grab.part === 'torso' ? 2 : grab.part === 'pelvis' ? 1.7 : follow;
      rootSum += clamp(rootX,70,W-70)*weight;
      rootWeight += weight;
      if(grab.part === 'torso' || grab.part === 'pelvis') torsoDesired = desired;
      prepared.push({grab,desired,guided,session});
    }

    if(rootWeight) p.target.x = clamp(rootSum/rootWeight,70,W-70)/W;
    const anchorX = clamp(p.target.x*W,70,W-70);
    const coreGrab = grabs.some(g=>g.part==='torso'||g.part==='pelvis'||g.part.includes('Shoulder'));
    const limbGrab = grabs.some(g=>!['torso','pelvis','leftShoulder','rightShoulder'].includes(g.part));

    for(const item of prepared){
      const part = item.grab.part;
      const body = grabBody(p,part);
      const point = grabWorldPoint(p,part);
      const twoFingerScale = grabs.length > 1 ? .86 : 1;
      const strength = (p.rag ? .00017 : part === 'head' ? .00022 : part === 'torso' || part === 'pelvis' ? .00019 : part.includes('Shoulder') ? .0002 : .00019)*twoFingerScale;
      springPull(body,point,item.guided,strength,.0026);

      if(!['torso','pelvis'].includes(part)){
        const followY = part.includes('Shoulder') ? .68 : part === 'head' ? .7 : part.includes('Hand') ? .38 : .28;
        const bodyTargetY = item.session.startTorsoY+(item.desired.y-item.session.startDesired.y)*followY;
        springPull(t,t.position,{x:anchorX,y:bodyTargetY},.000088/grabs.length,.0043);
      }

      if(['head','leftHand','rightHand','leftFoot','rightFoot'].includes(part)){
        rig.pins[part] = {x:item.desired.x-anchorX,y:item.desired.y-standingY};
      }
    }

    if(p.rag) return;

    if(!coreGrab){
      springPull(t,t.position,{x:anchorX,y:standingY},limbGrab ? .00011 : .00015,.0049);
    }else if(torsoDesired){
      springPull(t,t.position,torsoDesired,.000075,.0042);
    }

    const legSpread = crouched ? 22 : 16;
    const thighY = standingY+(crouched ? 48 : 61);
    const shinY = standingY+(crouched ? 88 : 112);
    const footY = floorY-2;

    if(!activeParts.has('leftFoot') && !rig.pins.leftFoot){
      springPull(p.thL,p.thL.position,{x:anchorX-13,y:thighY},.000078,.0055);
      springPull(p.shL,p.shL.position,{x:anchorX-legSpread,y:shinY},.0001,.0057);
      springPull(p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00017,.0059);
    }
    if(!activeParts.has('rightFoot') && !rig.pins.rightFoot){
      springPull(p.thR,p.thR.position,{x:anchorX+13,y:thighY},.000078,.0055);
      springPull(p.shR,p.shR.position,{x:anchorX+legSpread,y:shinY},.0001,.0057);
      springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);
    }

    for(const part of ['head','leftHand','rightHand','leftFoot','rightFoot']){
      const pin = rig.pins[part];
      if(!pin || activeParts.has(part)) continue;
      const body = grabBody(p,part);
      const point = grabWorldPoint(p,part);
      const strength = part === 'head' ? .00017 : part.includes('Foot') ? .000145 : .00013;
      springPull(body,point,{x:anchorX+pin.x,y:standingY+pin.y},strength,.0044);
    }

    if(!rig.pins.head && !activeParts.has('head')){
      springPull(p.head,p.head.position,{x:anchorX,y:standingY-65},.000095,.0046);
    }

    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');
    const q = POSES[p.pose] || POSES.stand;
    const base = q[8];
    const midFootX = (leftFoot.x+rightFoot.x)*.5;
    const balanceLean = clamp((midFootX-t.position.x)*.0045-t.velocity.x*.014,-.24,.24);
    const muscle = limbGrab ? .86 : coreGrab ? .9 : 1;

    servo(t,base+balanceLean,.018*muscle);
    servo(p.head,base*.2,.011*muscle);
    [p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].forEach((body,i)=>{
      const strength = i < 4 ? (i%2 ? .0062 : .0072) : (i%2 ? .014 : .0155);
      servo(body,base+q[i],strength*muscle);
    });
  }`;
  if(!drivePattern.test(source)) throw new Error('Could not apply Puppetalk rig build 20.');
  source = source.replace(drivePattern,`${tunedDrive}\n\n  function norm(point)`);

  const grabSpotsPattern = /  function grabSpots\(p\)\{[\s\S]*?\n  \}\n\n  function renderGrabHandles/;
  const grabSpotsCode = `  function grabSpots(p){
    if(!p) return [];
    const pelvis = {x:(p.hl.x+p.hr.x)*.5,y:(p.hl.y+p.hr.y)*.5};
    return [
      {part:'head',label:'head',q:p.head,r:40},
      {part:'leftShoulder',label:'left shoulder',q:p.sl,r:31},
      {part:'rightShoulder',label:'right shoulder',q:p.sr,r:31},
      {part:'leftHand',label:'left hand',q:p.wl,r:32},
      {part:'rightHand',label:'right hand',q:p.wr,r:32},
      {part:'leftFoot',label:'left foot',q:p.al,r:32},
      {part:'rightFoot',label:'right foot',q:p.ar,r:32},
      {part:'pelvis',label:'pelvis',q:pelvis,r:42},
      {part:'torso',label:'body',q:p.torso,r:50}
    ];
  }

  function renderGrabHandles`;
  if(!grabSpotsPattern.test(source)) throw new Error('Could not add Puppetalk body anchors.');
  source = source.replace(grabSpotsPattern,grabSpotsCode);

  source = source.replace(
    "  let dragging = false;\n  let lastSent = '';\n  const input = {x:.5,y:.55,pose:'stand',rag:false,mouth:0,grabPart:'torso',grabbing:false};",
    "  let lastSent = '';\n  const activePointers = new Map();\n  let reconnectTimer = null;\n  let connectGeneration = 0;\n  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};\n  function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y})); }"
  );

  const handlesPattern = /  function renderGrabHandles\(p\)\{[\s\S]*?\n  \}\n\n  function renderPersonalScene/;
  const handlesCode = `  function renderGrabHandles(p){
    if(!p) return;
    const active = new Set([...activePointers.values()].map(g=>g.part));
    ctx.save();
    grabSpots(p).forEach(spot=>{
      const x = spot.q.x*cw;
      const y = spot.q.y*ch;
      const selected = active.has(spot.part);
      ctx.beginPath();
      ctx.arc(x,y,selected ? 12 : 6.5,0,Math.PI*2);
      ctx.fillStyle = selected ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.065)';
      ctx.fill();
      ctx.strokeStyle = selected ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.25)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
    });
    ctx.restore();
  }

  function renderPersonalScene`;
  if(!handlesPattern.test(source)) throw new Error('Could not install multi-touch grab handles.');
  source = source.replace(handlesPattern,handlesCode);

  source = source.replace(
    "    for(const spot of grabSpots(mine)){\n      const x = spot.q.x*rect.width;",
    "    const occupied = new Set([...activePointers.values()].map(g=>g.part));\n    for(const spot of grabSpots(mine)){\n      if(occupied.has(spot.part)) continue;\n      const x = spot.q.x*rect.width;"
  );

  const pointerPattern = /  canvas\.addEventListener\('pointerdown',[\s\S]*?  canvas\.addEventListener\('pointercancel',stopDrag\);\n/;
  const pointerCode = `  function describeActiveGrabs(){
    const labels = [...activePointers.values()].map(g=>g.label);
    if(!labels.length) return 'Grab another part, or choose a pose';
    return 'Holding '+labels.join(' + ');
  }

  canvas.addEventListener('pointerdown',event=>{
    if(activePointers.size >= 2) return;
    const grab = pickGrab(event);
    if(!grab) return;
    if(centreTimer){ clearTimeout(centreTimer); centreTimer = null; }
    event.preventDefault();
    const p = pointerToWorld(event);
    activePointers.set(event.pointerId,{part:grab.part,label:grab.label,x:p.x,y:p.y});
    syncGrabs();
    canvas.setPointerCapture(event.pointerId);
    hint.classList.remove('quiet');
    hint.textContent = describeActiveGrabs();
    renderPersonalScene();
    transmit(true);
  });
  canvas.addEventListener('pointermove',event=>{
    const grab = activePointers.get(event.pointerId);
    if(!grab) return;
    event.preventDefault();
    const p = pointerToWorld(event);
    grab.x = p.x;
    grab.y = p.y;
    syncGrabs();
    transmit();
  });
  const stopPointer = event=>{
    if(!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
    syncGrabs();
    hint.textContent = describeActiveGrabs();
    if(!activePointers.size) hint.classList.add('quiet');
    renderPersonalScene();
    transmit(true);
  };
  canvas.addEventListener('pointerup',stopPointer);
  canvas.addEventListener('pointercancel',stopPointer);
`;
  if(!pointerPattern.test(source)) throw new Error('Could not install two-finger puppetry.');
  source = source.replace(pointerPattern,pointerCode);

  source = source.replace(
    "      input.pose = button.dataset.pose;\n      input.rag = false;",
    "      input.pose = button.dataset.pose;\n      input.poseVersion = (input.poseVersion || 0)+1;\n      input.rag = false;"
  );

  const centrePattern = /  document\.querySelector\('#centre'\)\.addEventListener\('click',\(\)=>\{[\s\S]*?\n  \}\);\n  document\.querySelector\('#retry'\)/;
  const centreCode = `  document.querySelector('#centre').addEventListener('click',()=>{
    if(activePointers.size) return;
    input.grabs = [{part:'torso',x:.5,y:.55}];
    transmit(true);
    if(centreTimer) clearTimeout(centreTimer);
    centreTimer = setTimeout(()=>{
      input.grabs = [];
      transmit(true);
      centreTimer = null;
    },150);
  });
  document.querySelector('#retry')`;
  if(!centrePattern.test(source)) throw new Error('Could not update Centre me for multi-touch.');
  source = source.replace(centrePattern,centreCode);

  source = source.replace(
    "  function connect(){\n    if(peer && !peer.destroyed) peer.destroy();",
    "  function connect(){\n    const generation = ++connectGeneration;\n    if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }\n    if(peer && !peer.destroyed) peer.destroy();"
  );
  source = source.replace(
    "      conn.on('close',()=>setStatus('table disconnected','bad'));\n      conn.on('error',()=>setStatus('connection error','bad'));",
    "      const autoReconnect = ()=>{\n        if(generation !== connectGeneration || reconnectTimer) return;\n        setStatus('reconnecting…','bad');\n        reconnectTimer = setTimeout(()=>{ reconnectTimer=null; connect(); },1200);\n      };\n      conn.on('close',autoReconnect);\n      conn.on('error',autoReconnect);"
  );

  source = source.replace('grab body, head, hands or feet','one or two finger grabs');
  source = source.replace('Grab the body, head, hands or feet','Use one or two fingers on any grab point');

  source = `(function(){\n${source}\n})();`;
  return source;
}

async function bootApp(){
  let source;
  try{ source = await loadAppSource(); }
  catch(err){ renderStartupError(err?.message || 'Could not load the scene code.'); return; }

  let startupFailed = false;
  const onError = event=>{
    if(startupFailed) return;
    startupFailed = true;
    renderStartupError(event?.error?.message || event?.message || 'The scene code crashed while starting.');
  };
  window.addEventListener('error',onError,{once:true});

  const blob = new Blob([source],{type:'text/javascript'});
  const blobUrl = URL.createObjectURL(blob);
  const script = document.createElement('script');
  script.src = blobUrl;
  script.onload = ()=>{
    URL.revokeObjectURL(blobUrl);
    if(startupFailed) return;
    window.removeEventListener('error',onError);
    if(mode === 'controller') tidyController();
    else enhanceStage(room);
  };
  script.onerror = ()=>{
    URL.revokeObjectURL(blobUrl);
    window.removeEventListener('error',onError);
    if(!startupFailed) renderStartupError('The scene script could not be executed.');
  };
  document.body.appendChild(script);
}

function bootHostPlayer(){
  app.innerHTML = `
    <section class="home-shell"><div class="home-panel">
      <div class="home-brand">Puppetalk</div>
      <p class="home-copy">Starting the shared scene…</p>
      <div class="home-note">This phone will be Player 1 and will also host the session physics.</div>
    </div></section>`;

  const iframe = document.createElement('iframe');
  iframe.src = stageUrl(room).href;
  iframe.title = 'Puppetalk session host';
  iframe.setAttribute('aria-hidden','true');
  Object.assign(iframe.style,{position:'fixed',left:'0',top:'0',width:'320px',height:'360px',border:'0',opacity:'0',pointerEvents:'none',zIndex:'-1'});
  document.body.appendChild(iframe);

  let started = false;
  let polls = 0;
  const startVisiblePlayer = ()=>{
    if(started) return;
    started = true;
    clearInterval(poll);
    bootApp();
  };
  const poll = setInterval(()=>{
    polls += 1;
    try{
      const doc = iframe.contentDocument;
      const status = doc?.querySelector('#stage-status')?.textContent || '';
      if(status.includes('stage live') || status.includes('puppeteer')){ startVisiblePlayer(); return; }
      const hostError = doc?.querySelector('.home-copy')?.textContent || '';
      if(hostError.includes('startup failed') || hostError.includes('could not')){
        clearInterval(poll);
        renderStartupError(`The session host could not start. ${hostError}`);
        return;
      }
    }catch(err){ console.debug('Waiting for host scene',err); }
    if(polls > 80){ clearInterval(poll); renderStartupError('The session host did not become ready.'); }
  },125);
}

if(mode === 'controller' && !room) renderBadInvite();
else if(!room) renderHome();
else if(isHostPlayer) bootHostPlayer();
else bootApp();
