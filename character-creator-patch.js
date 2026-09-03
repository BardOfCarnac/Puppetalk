// Puppetalk character creator patch.
// Loaded before boot.js: decorates the app.js source returned to the boot-time tuner.
(() => {
  const nativeFetch = window.fetch.bind(window);

  const LOOKS = `
const LOOK_PALETTE = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'];
const LOOK_PARTS = {
  head:['round','long','wide','square','pear'],
  eyes:['dots','sleepy','wide','side','brows'],
  hair:['none','crop','cap','tuft','wave','mop'],
  extra:['none','glasses','moustache','freckles','eyepatch']
};
function defaultLook(slot=0){
  return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],head:'round',eyes:'dots',hair:'none',extra:'none'};
}
function cleanLook(value,slot=0){
  const base = defaultLook(slot); const look = value && typeof value==='object' ? value : {};
  return {
    color:/^#[0-9a-f]{6}$/i.test(look.color||'') ? look.color : base.color,
    head:LOOK_PARTS.head.includes(look.head)?look.head:base.head,
    eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
    hair:LOOK_PARTS.hair.includes(look.hair)?look.hair:base.hair,
    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
  };
}
function savedLook(){ try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();} }
function saveLook(look){ try{localStorage.setItem('puppetalk-look',JSON.stringify(cleanLook(look)));}catch{} }
`;

  function patch(source){
    if(!source.includes("const COLORS =") || !source.includes('function startController(room)')) return source;

    source = source.replace("const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];", "const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];\\n" + LOOKS);

    source = source.replace(
      "      color:COLORS[slot] || '#aaa',",
      "      color:COLORS[slot] || '#aaa',\\n      look:defaultLook(slot),"
    );

    source = source.replace(
      "      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,",
      "      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,look:cleanLook(p.look,p.slot),"
    );

    source = source.replace(
      "    conn.on('data',msg=>applyInput(slot,msg));",
      "    conn.on('data',msg=>applyInput(slot,msg));\\n    conn.on('data',msg=>{ if(msg?.type==='look'){ const p=makePuppet(slot); p.look=cleanLook(msg.look,slot); p.color=p.look.color; } });"
    );

    const creatorCard = `
      <section class="card character-card" id="character-card">
        <div class="control-title"><span>Character</span><span class="small muted">tap a feature to cycle it</span></div>
        <div class="character-preview" id="character-preview" aria-hidden="true"></div>
        <div class="character-grid">
          <button type="button" data-look="head"><span>Head</span><strong id="look-head">round</strong></button>
          <button type="button" data-look="eyes"><span>Eyes</span><strong id="look-eyes">dots</strong></button>
          <button type="button" data-look="hair"><span>Hair</span><strong id="look-hair">none</strong></button>
          <button type="button" data-look="extra"><span>Extra</span><strong id="look-extra">none</strong></button>
        </div>
        <div class="character-colors" id="character-colors"></div>
        <button type="button" class="character-random" id="character-random">Random character</button>
      </section>
`;
    source = source.replace("      <section class=\"card compact-controls\">", creatorCard + "\\n      <section class=\"card compact-controls\">");

    source = source.replace(
      "  const input = {x:.5,y:.55,pose:'stand',rag:false,mouth:0,grabPart:'torso',grabbing:false};",
      "  const input = {x:.5,y:.55,pose:'stand',rag:false,mouth:0,grabPart:'torso',grabbing:false};\\n  input.look = savedLook();"
    );

    source = source.replace(
      "          transmit(true);",
      "          transmit(true);\\n          send(conn,{type:'look',look:input.look});"
    );

    const creatorLogic = `
  function sendLook(){
    input.look = cleanLook(input.look,slot||0);
    saveLook(input.look);
    send(conn,{type:'look',look:input.look});
    renderCreator();
  }
  function cycleLook(key){
    const list=LOOK_PARTS[key]; if(!list)return;
    const i=list.indexOf(input.look[key]); input.look[key]=list[(i+1)%list.length]; sendLook();
  }
  function renderCreator(){
    if(!document.querySelector('#character-card')) return;
    for(const key of ['head','eyes','hair','extra']){ const el=document.querySelector('#look-'+key); if(el)el.textContent=input.look[key]; }
    const colors=document.querySelector('#character-colors');
    if(colors && !colors.childElementCount){
      LOOK_PALETTE.forEach(color=>{ const b=document.createElement('button'); b.type='button'; b.className='character-swatch'; b.dataset.color=color; b.style.setProperty('--swatch',color); b.title=color; b.addEventListener('click',()=>{input.look.color=color;sendLook();}); colors.appendChild(b); });
    }
    colors?.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===input.look.color));
    const preview=document.querySelector('#character-preview');
    if(preview){ preview.style.setProperty('--puppet-color',input.look.color); preview.dataset.head=input.look.head; preview.dataset.eyes=input.look.eyes; preview.dataset.hair=input.look.hair; preview.dataset.extra=input.look.extra; }
  }
  document.querySelector('#character-card')?.addEventListener('click',event=>{ const b=event.target.closest('[data-look]'); if(b)cycleLook(b.dataset.look); });
  document.querySelector('#character-random')?.addEventListener('click',()=>{
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    input.look={color:pick(LOOK_PALETTE),head:pick(LOOK_PARTS.head),eyes:pick(LOOK_PARTS.eyes),hair:pick(LOOK_PARTS.hair),extra:pick(LOOK_PARTS.extra)}; sendLook();
  });
  renderCreator();
`;
    source = source.replace("  document.querySelector('#poses').addEventListener('click',event=>{", creatorLogic + "\\n  document.querySelector('#poses').addEventListener('click',event=>{");

    const oldHead = `  const hx = p.head.x*w;
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
  ctx.restore();`;

    const newHead = `  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(13,26*scale);
  const look = cleanLook(p.look,p.slot||0);
  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a || 0);
  const headPath=(pad=0)=>{
    ctx.beginPath();
    if(look.head==='long') ctx.ellipse(0,1*scale,hr*.82+pad,hr*1.16+pad,0,0,Math.PI*2);
    else if(look.head==='wide') ctx.ellipse(0,0,hr*1.13+pad,hr*.88+pad,0,0,Math.PI*2);
    else if(look.head==='square') roundRect(ctx,-hr-pad,-hr*.94-pad,(hr+pad)*2,(hr*.94+pad)*2,hr*.26);
    else if(look.head==='pear'){ ctx.moveTo(-hr*.72,-hr*.76); ctx.bezierCurveTo(-hr*1.08,-hr*.15,-hr*.94,hr*.92,0,hr*1.02); ctx.bezierCurveTo(hr*.94,hr*.92,hr*1.08,-hr*.15,hr*.72,-hr*.76); ctx.quadraticCurveTo(0,-hr*1.13,-hr*.72,-hr*.76); ctx.closePath(); }
    else ctx.arc(0,0,hr+pad,0,Math.PI*2);
  };
  ctx.fillStyle='#08090a'; headPath(3); ctx.fill();
  ctx.fillStyle=look.color; headPath(0); ctx.fill();

  // hair: intentionally graphic silhouettes so features stay readable at table distance
  ctx.fillStyle='#08090a';
  if(look.hair==='crop'){ ctx.beginPath();ctx.arc(0,-hr*.18,hr*.91,Math.PI*1.08,Math.PI*1.92);ctx.lineTo(hr*.72,-hr*.25);ctx.lineTo(-hr*.72,-hr*.25);ctx.closePath();ctx.fill(); }
  if(look.hair==='cap'){ ctx.beginPath();ctx.arc(0,-hr*.18,hr*.98,Math.PI,Math.PI*2);ctx.lineTo(hr*.98,-hr*.08);ctx.lineTo(-hr*.98,-hr*.08);ctx.closePath();ctx.fill(); }
  if(look.hair==='tuft'){ for(const x of [-.46,-.15,.18,.48]){ctx.beginPath();ctx.arc(hr*x,-hr*.9,hr*.28,0,Math.PI*2);ctx.fill();} }
  if(look.hair==='wave'){ ctx.beginPath();ctx.moveTo(-hr*.88,-hr*.38);ctx.bezierCurveTo(-hr*.55,-hr*1.2,-hr*.1,-hr*.55,hr*.18,-hr*1.1);ctx.bezierCurveTo(hr*.45,-hr*.55,hr*.82,-hr*.95,hr*.9,-hr*.25);ctx.lineTo(hr*.72,-hr*.55);ctx.lineTo(-hr*.72,-hr*.55);ctx.closePath();ctx.fill(); }
  if(look.hair==='mop'){ for(let i=-3;i<=3;i++){ctx.beginPath();ctx.arc(i*hr*.27,-hr*(.72+Math.abs(i%2)*.12),hr*.31,0,Math.PI*2);ctx.fill();} }

  const eyeY=-hr*.18, ex=hr*.31;
  ctx.strokeStyle=ctx.fillStyle='#08090a'; ctx.lineWidth=Math.max(1.5,hr*.07); ctx.lineCap='round';
  if(look.eyes==='sleepy'){ for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*ex-hr*.1,eyeY);ctx.lineTo(s*ex+hr*.1,eyeY+hr*.04);ctx.stroke();} }
  else if(look.eyes==='wide'){ for(const s of [-1,1]){ctx.beginPath();ctx.arc(s*ex,eyeY,hr*.14,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(s*ex,eyeY,hr*.055,0,Math.PI*2);ctx.fill();} }
  else if(look.eyes==='side'){ for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(s*ex,eyeY,hr*.14,hr*.1,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(s*ex+hr*.045,eyeY,hr*.05,0,Math.PI*2);ctx.fill();} }
  else { ctx.beginPath();ctx.arc(-ex,eyeY,Math.max(1.8,hr*.09),0,Math.PI*2);ctx.arc(ex,eyeY,Math.max(1.8,hr*.09),0,Math.PI*2);ctx.fill(); if(look.eyes==='brows'){for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*ex-hr*.12,eyeY-hr*.19);ctx.lineTo(s*ex+hr*.12,eyeY-hr*.23);ctx.stroke();}} }

  if(look.extra==='glasses'){ ctx.lineWidth=Math.max(1.3,hr*.055); for(const s of [-1,1]){ctx.beginPath();ctx.arc(s*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke(); }
  if(look.extra==='eyepatch'){ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();}
  if(look.extra==='freckles'){for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.07+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}}

  ctx.beginPath();
  if(p.mouth===0) roundRect(ctx,-hr*.27,hr*.34,hr*.54,Math.max(2,hr*.11),2);
  else if(p.mouth===1) roundRect(ctx,-hr*.28,hr*.22,hr*.56,hr*.38,hr*.16);
  else ctx.ellipse(0,hr*.4,hr*.34,hr*.42,0,0,Math.PI*2);
  ctx.fill();
  if(look.extra==='moustache'){ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();`;
    if(source.includes(oldHead)) source=source.replace(oldHead,newHead);
    return source;
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text = await response.text();
    const body = patch(text);
    return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();