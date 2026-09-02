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
  const response = await fetch('./app.js?v=19',{cache:'no-store'});
  if(!response.ok) throw new Error(`Could not load app.js (${response.status})`);
  let source = await response.text();

  source = source.replace(
    "const room = clean(qs.get('room'));",
    "const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);"
  );

  source = source.replace(
    "const head = Bodies.circle(x,y-65,26,{...opt,density:.0018});",
    "const head = Bodies.circle(x,y-65,26,{...opt,density:.00068,frictionAir:.06});"
  );

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
      wasGrabbing:false,
      session:null,
      lastPose:p.pose,
      pins:{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null}
    };
    return p._rig;
  }

  function drivePuppet(p){
    const t = p.torso;
    const rig = ensureRig(p);
    const floorY = H-31;
    const crouched = p.pose === 'crouch';
    const standingY = floorY-(crouched ? 112 : 145);

    if(rig.lastPose !== p.pose){
      rig.lastPose = p.pose;
      rig.pins = {head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null};
    }

    const desired = {
      x:clamp(p.grabTarget.x*W,20,W-20),
      y:clamp(p.grabTarget.y*H,30,H-24)
    };

    if(p.grabbing && !rig.wasGrabbing){
      rig.session = {
        part:p.grabPart,
        startDesired:{x:desired.x,y:desired.y},
        startRootX:p.target.x*W,
        startPoint:grabWorldPoint(p,p.grabPart)
      };
    }

    if(p.grabbing && rig.session && rig.session.part === p.grabPart){
      const dx = desired.x-rig.session.startDesired.x;
      const dy = desired.y-rig.session.startDesired.y;
      const follow = p.grabPart === 'torso' ? 1 : p.grabPart === 'head' ? .72 : p.grabPart.includes('Hand') ? .42 : .3;
      const rootX = clamp(rig.session.startRootX+dx*follow,70,W-70);
      p.target.x = rootX/W;

      if(p.grabPart !== 'torso'){
        rig.pins[p.grabPart] = {x:desired.x-rootX,y:desired.y-standingY};
      }
    }

    const anchorX = clamp(p.target.x*W,70,W-70);
    const torsoGrab = p.grabbing && p.grabPart === 'torso';
    const limbGrab = p.grabbing && p.grabPart !== 'torso';

    if(p.grabbing){
      const body = grabBody(p,p.grabPart);
      const point = grabWorldPoint(p,p.grabPart);
      const strength = p.rag ? .00016 : p.grabPart === 'head' ? .00022 : p.grabPart === 'torso' ? .00018 : .00019;
      springPull(body,point,desired,strength,.0025);

      if(p.grabPart !== 'torso'){
        const followY = p.grabPart === 'head' ? .7 : p.grabPart.includes('Hand') ? .38 : .28;
        const bodyTargetY = standingY+(desired.y-rig.session.startDesired.y)*followY;
        springPull(t,t.position,{x:anchorX,y:bodyTargetY},.00009,.0042);
      }
    }

    rig.wasGrabbing = p.grabbing;
    if(!p.grabbing) rig.session = null;

    if(p.rag) return;

    if(!torsoGrab){
      springPull(t,t.position,{x:anchorX,y:standingY},limbGrab ? .000105 : .000145,.0048);
    }

    const legSpread = crouched ? 22 : 16;
    const thighY = standingY+(crouched ? 48 : 61);
    const shinY = standingY+(crouched ? 88 : 112);
    const footY = floorY-2;

    if(!(p.grabbing && p.grabPart === 'leftFoot') && !rig.pins.leftFoot){
      springPull(p.thL,p.thL.position,{x:anchorX-13,y:thighY},.000072,.0054);
      springPull(p.shL,p.shL.position,{x:anchorX-legSpread,y:shinY},.000092,.0056);
      springPull(p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00016,.0058);
    }
    if(!(p.grabbing && p.grabPart === 'rightFoot') && !rig.pins.rightFoot){
      springPull(p.thR,p.thR.position,{x:anchorX+13,y:thighY},.000072,.0054);
      springPull(p.shR,p.shR.position,{x:anchorX+legSpread,y:shinY},.000092,.0056);
      springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00016,.0058);
    }

    for(const part of ['head','leftHand','rightHand','leftFoot','rightFoot']){
      const pin = rig.pins[part];
      if(!pin || (p.grabbing && p.grabPart === part)) continue;
      const body = grabBody(p,part);
      const point = grabWorldPoint(p,part);
      const strength = part === 'head' ? .00016 : part.includes('Foot') ? .00014 : .000125;
      springPull(body,point,{x:anchorX+pin.x,y:standingY+pin.y},strength,.0043);
    }

    if(!rig.pins.head && !(p.grabbing && p.grabPart === 'head')){
      springPull(p.head,p.head.position,{x:anchorX,y:standingY-65},.00009,.0045);
    }

    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');
    const q = POSES[p.pose] || POSES.stand;
    const base = q[8];
    const midFootX = (leftFoot.x+rightFoot.x)*.5;
    const balanceLean = clamp((midFootX-t.position.x)*.0045-t.velocity.x*.014,-.24,.24);
    const muscle = limbGrab ? .88 : 1;

    servo(t,base+balanceLean,.018*muscle);
    servo(p.head,base*.2,.011*muscle);
    [p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].forEach((body,i)=>{
      const strength = i < 4 ? (i%2 ? .0062 : .0072) : (i%2 ? .014 : .0155);
      servo(body,base+q[i],strength*muscle);
    });
  }`;

  if(!drivePattern.test(source)) throw new Error('Could not apply Puppetalk rig build 19.');
  source = source.replace(drivePattern,`${tunedDrive}\n\n  function norm(point)`);

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