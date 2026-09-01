const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const mode = params.get('mode');
const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

function makeTableId(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>chars[b % chars.length]).join('');
}

function tableUrl(id){
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('room',id);
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
          <p class="home-copy">A shared puppet stage. Start a table here, then invite everyone else with a link or QR code.</p>
        </div>
        <div class="home-actions">
          <button class="primary" id="start-table" type="button">Start a table</button>
        </div>
        <div class="home-note">Players do not need to create an account for this prototype. They join directly from the invite you send them.</div>
      </div>
    </section>`;
  document.querySelector('#start-table').addEventListener('click',()=>{
    location.href = tableUrl(makeTableId());
  });
}

function renderBadInvite(){
  app.innerHTML = `
    <section class="home-shell">
      <div class="home-panel">
        <div class="home-brand">Puppetalk</div>
        <p class="home-copy">This invite is incomplete. Ask the table host to send you their Puppetalk invite link again.</p>
        <div class="home-actions"><button id="go-home" type="button">Puppetalk home</button></div>
      </div>
    </section>`;
  document.querySelector('#go-home').addEventListener('click',()=>{ location.href=homeUrl(); });
}

function renderStartupError(detail='The stage could not start.'){
  console.error('Puppetalk startup error:',detail);
  app.innerHTML = `
    <section class="home-shell">
      <div class="home-panel">
        <div class="home-brand">Puppetalk</div>
        <p class="home-copy"><strong>Stage startup failed.</strong><br>${String(detail).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p>
        <div class="home-actions"><button class="primary" id="retry-stage" type="button">Try again</button><button id="error-home" type="button">Puppetalk home</button></div>
        <div class="home-note">This error is being shown instead of leaving you on a blank screen.</div>
      </div>
    </section>`;
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

function enhanceStage(id){
  const card = document.querySelector('.join-card');
  if(!card) return;
  const invite = joinUrl(id).href;
  card.classList.add('invite-card');
  card.innerHTML = `
    <div class="invite-label">Invite players</div>
    <div class="invite-qr" id="invite-qr" aria-label="QR code for joining this table"></div>
    <div class="invite-copy">
      <div class="invite-title">Scan or share to join</div>
      <div class="invite-url">${invite}</div>
      <div class="invite-actions">
        <button id="share-invite" type="button">Share invite</button>
        <button id="copy-invite" type="button">Copy link</button>
      </div>
      <div class="invite-feedback" id="invite-feedback"></div>
    </div>`;

  const qr = document.querySelector('#invite-qr');
  if(window.QRCode && qr){
    new QRCode(qr,{text:invite,width:80,height:80,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  }

  const feedback = document.querySelector('#invite-feedback');
  document.querySelector('#copy-invite').addEventListener('click',async()=>{
    try { await copyText(invite); feedback.textContent='Invite copied.'; }
    catch { feedback.textContent='Could not copy — use Share invite.'; }
  });
  document.querySelector('#share-invite').addEventListener('click',async()=>{
    try{
      if(navigator.share) await navigator.share({title:'Join my Puppetalk table',text:'Join my Puppetalk table',url:invite});
      else { await copyText(invite); feedback.textContent='Invite copied.'; }
    }catch(err){
      if(err?.name !== 'AbortError') feedback.textContent='Sharing unavailable — copy the link instead.';
    }
  });
}

function tidyController(){
  const sub = document.querySelector('.controller-head .muted');
  if(sub) sub.textContent = 'Live table';
}

async function bootApp(){
  let source;
  try{
    const response = await fetch('./app.js',{cache:'no-store'});
    if(!response.ok) throw new Error(`Could not load app.js (${response.status})`);
    source = await response.text();
  }catch(err){
    renderStartupError(err?.message || 'Could not load the stage code.');
    return;
  }

  // app.js historically read the room through clean() before that const existed.
  // Rewrite only that startup line here so old deployed/cached copies cannot black-screen.
  source = source.replace(
    "const room = clean(qs.get('room'));",
    "const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);"
  );

  let startupFailed = false;
  const onError = event=>{
    if(startupFailed) return;
    startupFailed = true;
    renderStartupError(event?.error?.message || event?.message || 'The stage code crashed while starting.');
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
    if(!startupFailed) renderStartupError('The stage script could not be executed.');
  };
  document.body.appendChild(script);
}

if(mode === 'controller' && !room) renderBadInvite();
else if(!room) renderHome();
else bootApp();
