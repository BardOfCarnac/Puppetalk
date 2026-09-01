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
  document.querySelector('#go-home').addEventListener('click',()=>{
    const url = new URL(location.href); url.search=''; location.href=url;
  });
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

function bootApp(){
  const script = document.createElement('script');
  script.src = './app.js';
  script.onload = ()=>{
    if(mode === 'controller') tidyController();
    else enhanceStage(room);
  };
  script.onerror = ()=>{ app.textContent='Puppetalk failed to start.'; };
  document.body.appendChild(script);
}

if(mode === 'controller' && !room) renderBadInvite();
else if(!room) renderHome();
else bootApp();
