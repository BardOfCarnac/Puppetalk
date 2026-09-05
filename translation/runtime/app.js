(function(){
const app = document.querySelector('#app');
const qs = new URLSearchParams(location.search);
const mode = qs.get('mode') === 'controller' ? 'controller' : 'stage';
const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

const COLORS = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8'];
const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];

const LOOK_PALETTE = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'];
const LOOK_PARTS = {
  headStyle:['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'],
  eyes:['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight'],
  nose:['angular','bow','curve','hook','long','slant'],
  mouth:['frown','line','pleased','shy','smile','smirk','soft','wavy'],
  extra:['none','glasses','moustache','freckles','eyepatch']
};
function defaultLook(slot=0){
  return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'};
}
function cleanLook(value,slot=0){
  const base=defaultLook(slot),look=value&&typeof value==='object'?value:{};
  const migrated=LOOK_PARTS.headStyle.includes(look.headStyle)?look.headStyle:puppetalkLegacyHeadStyle(look.head,look.hair);
  return {
    color:/^#[0-9a-f]{6}$/i.test(look.color||'')?look.color:base.color,
    headStyle:LOOK_PARTS.headStyle.includes(migrated)?migrated:base.headStyle,
    eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
    nose:LOOK_PARTS.nose.includes(look.nose)?look.nose:base.nose,
    mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,
    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
  };
}


const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];
const LINE_FACE_EYES = {
  closed:[{d:'M6 5q6 5 13 0m24 0q7 5 13 0',w:4.2}],
  dots:[{d:'M12 6h.01M50 6h.01',w:7}],
  happy:[{d:'M6 7q6-6 13 0m24 0q7-6 13 0',w:4.2}],
  mismatch:[{d:'M6 5q6 5 13 0m24 1q7 1.5 13 0',w:4.2}],
  sleepy:[{d:'M6 6q7 1.5 13 0m24 0q7 1.5 13 0',w:4.2}],
  unevenDots:[{d:'M12 4.5h.01M50 7.5h.01',w:7}],
  wink:[{d:'M6 5q6 5 13 0',w:4.2},{d:'M50 6h.01',w:7}],
  winkRight:[{d:'M12 6h.01',w:7},{d:'M43 5q7 5 13 0',w:4.2}]
};
const LINE_FACE_NOSES = {
  angular:'M13 6 7 26l8 2.5',
  bow:'M13 5c-5.5 8-8 16-6 24',
  curve:'M12 6c-2.5 8-7 15-6 22q.5 5 6 4',
  hook:'M13 5 5.5 27q-1 6.5 5.5 5.5',
  long:'M15 3 4 30q-1.5 5.5 6 5',
  slant:'M13 5 6 29'
};
function legacyHeadStyle(head,hair){
  if(hair==='tuft') return 'tufts';
  if(hair==='wave') return 'swept';
  if(hair==='mop') return 'scallop';
  if(hair==='cap') return 'fringe';
  if(hair==='crop') return 'spikes';
  if(head==='long') return 'tallSpikes';
  if(head==='wide') return 'burst';
  return 'smooth';
}
function puppetHeadPath(ctx,style,r){
  const p=(x,y)=>[x*r,y*r];
  ctx.beginPath();
  if(style==='spikes'){
    ctx.moveTo(...p(-.82,.58));
    ctx.bezierCurveTo(...p(-1.02,.12),...p(-.96,-.32),...p(-.72,-.58));
    [[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(1.00,-.28),...p(1.02,.24),...p(.82,.58));
    ctx.bezierCurveTo(...p(.62,.96),...p(.28,1.05),...p(0,1.03));
    ctx.bezierCurveTo(...p(-.30,1.05),...p(-.62,.96),...p(-.82,.58));
  }else if(style==='tallSpikes'){
    ctx.moveTo(...p(-.78,.62));
    ctx.bezierCurveTo(...p(-1.0,.12),...p(-.93,-.28),...p(-.68,-.48));
    [[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.98,-.24),...p(1.0,.26),...p(.78,.62));
    ctx.bezierCurveTo(...p(.58,.98),...p(.25,1.06),...p(0,1.04));
    ctx.bezierCurveTo(...p(-.28,1.06),...p(-.58,.98),...p(-.78,.62));
  }else if(style==='burst'){
    ctx.moveTo(...p(-.76,.68));
    ctx.lineTo(...p(-1.05,.30));ctx.lineTo(...p(-.82,.05));ctx.lineTo(...p(-1.08,-.18));ctx.lineTo(...p(-.78,-.35));
    ctx.lineTo(...p(-.92,-.70));ctx.lineTo(...p(-.55,-.67));ctx.lineTo(...p(-.48,-1.03));ctx.lineTo(...p(-.18,-.78));
    ctx.lineTo(...p(.02,-1.12));ctx.lineTo(...p(.20,-.77));ctx.lineTo(...p(.52,-1.02));ctx.lineTo(...p(.56,-.65));
    ctx.lineTo(...p(.94,-.72));ctx.lineTo(...p(.80,-.35));ctx.lineTo(...p(1.08,-.16));ctx.lineTo(...p(.82,.05));ctx.lineTo(...p(1.04,.32));ctx.lineTo(...p(.76,.68));
    ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));
  }else if(style==='scallop'){
    ctx.moveTo(...p(-.84,.62));
    ctx.bezierCurveTo(...p(-1.0,.18),...p(-.98,-.24),...p(-.72,-.48));
    ctx.quadraticCurveTo(...p(-.62,-.88),...p(-.35,-.72));ctx.quadraticCurveTo(...p(-.22,-1.05),...p(.02,-.76));ctx.quadraticCurveTo(...p(.20,-1.05),...p(.39,-.72));ctx.quadraticCurveTo(...p(.63,-.93),...p(.76,-.48));
    ctx.bezierCurveTo(...p(1.0,-.22),...p(1.0,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.62));
  }else if(style==='tufts'){
    ctx.moveTo(...p(-.83,.62));ctx.bezierCurveTo(...p(-1.0,.18),...p(-.97,-.30),...p(-.67,-.55));
    ctx.quadraticCurveTo(...p(-.56,-1.03),...p(-.25,-.68));ctx.quadraticCurveTo(...p(-.05,-1.18),...p(.15,-.68));ctx.quadraticCurveTo(...p(.48,-1.08),...p(.68,-.52));
    ctx.bezierCurveTo(...p(.98,-.28),...p(1.0,.24),...p(.83,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.83,.62));
  }else if(style==='swept'){
    ctx.moveTo(...p(-.84,.60));ctx.bezierCurveTo(...p(-1.0,.12),...p(-.94,-.30),...p(-.64,-.55));
    ctx.bezierCurveTo(...p(-.36,-.90),...p(.03,-.72),...p(.25,-1.18));ctx.bezierCurveTo(...p(.32,-.82),...p(.69,-.98),...p(.68,-.55));
    ctx.bezierCurveTo(...p(.99,-.30),...p(1.01,.25),...p(.84,.60));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.60));
  }else if(style==='fringe'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1.0,.20),...p(-.98,-.24),...p(-.74,-.50));
    ctx.lineTo(...p(-.60,-.90));ctx.lineTo(...p(-.38,-.68));ctx.lineTo(...p(-.15,-.98));ctx.lineTo(...p(.08,-.70));ctx.lineTo(...p(.31,-.98));ctx.lineTo(...p(.50,-.68));ctx.lineTo(...p(.72,-.88));ctx.lineTo(...p(.75,-.50));
    ctx.bezierCurveTo(...p(1.0,-.25),...p(1.0,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.62));
  }else{
    ctx.arc(0,0,r,0,Math.PI*2);
  }
  ctx.closePath();
}
function drawLineFaceEyes(ctx,name,hr){
  const parts=LINE_FACE_EYES[name]||LINE_FACE_EYES.dots;
  const s=hr*2/100;
  ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineCap='round';ctx.lineJoin='round';
  for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}
  ctx.restore();
}
function drawLineFaceNose(ctx,name,hr){
  const d=LINE_FACE_NOSES[name]||LINE_FACE_NOSES.curve;
  const s=hr*2/100;
  ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(d));ctx.restore();
}

const LINE_FACE_MOUTHS = {
  frown:{d:'M7 11q15-6.5 29-1',open:11},
  line:{d:'m8 10 28-2',open:12},
  pleased:{d:'M4 9q16 7 30-1l7-5',open:13},
  shy:{d:'M15 9.5q8 4 16-1',open:9},
  smile:{d:'M3 9q19 10 38-3',open:14},
  smirk:{d:'M9 10q14 4 26-4',open:12},
  soft:{d:'M6 9q16 6 32-2',open:12},
  wavy:{d:'M6 10q7-4 14 0 8 4.5 18-2',open:12}
};
const LINE_FACE_MOUTH_NAMES = Object.keys(LINE_FACE_MOUTHS);
const LINE_FACE_MOUTH_CACHE = new Map();
function lineFaceMouthSamples(name){
  name = LINE_FACE_MOUTHS[name] ? name : 'line';
  if(LINE_FACE_MOUTH_CACHE.has(name)) return LINE_FACE_MOUTH_CACHE.get(name);
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',LINE_FACE_MOUTHS[name].d);
  const length = path.getTotalLength();
  const points = [];
  const count = 36;
  for(let i=0;i<=count;i++){
    const t=i/count;
    const p=path.getPointAtLength(length*t);
    points.push({x:p.x,y:p.y,t});
  }
  LINE_FACE_MOUTH_CACHE.set(name,points);
  return points;
}
function drawLineFaceMouth(ctx,name,state,hr){
  name = LINE_FACE_MOUTHS[name] ? name : 'line';
  const def = LINE_FACE_MOUTHS[name];
  const points = lineFaceMouthSamples(name);
  const scale = hr*2/100;
  const stateValue = Number.isFinite(state) ? Math.max(0,Math.min(2,state)) : 0;
  ctx.save();
  ctx.translate(-20*scale,13*scale);
  ctx.scale(scale,scale);
  ctx.lineCap='round';
  ctx.lineJoin='round';
  if(stateValue<=0){
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
    ctx.strokeStyle='#08090a';
    ctx.lineWidth=4.6;
    ctx.stroke();
  }else{
    const strength = stateValue===1 ? .38 : 1;
    const amount = def.open*strength;
    const upper=[];
    const lower=[];
    for(const p of points){
      const taper=Math.pow(Math.sin(Math.PI*p.t),.68);
      const spread=amount*taper;
      upper.push({x:p.x,y:p.y-spread*.30});
      lower.push({x:p.x,y:p.y+spread*.72});
    }
    ctx.beginPath();
    ctx.moveTo(upper[0].x,upper[0].y);
    for(let i=1;i<upper.length;i++)ctx.lineTo(upper[i].x,upper[i].y);
    for(let i=lower.length-1;i>=0;i--)ctx.lineTo(lower[i].x,lower[i].y);
    ctx.closePath();
    ctx.fillStyle='#08090a';
    ctx.fill();
  }
  ctx.restore();
}

function savedLook(){try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();}}
function saveLook(look){try{localStorage.setItem('puppetalk-look',JSON.stringify(cleanLook(look)));}catch{}}

const {
  POSES,GRAB_PARTS,ensureRig,resetPins,antiTangleTarget,rootFollow
} = window.PuppetalkCharacterRigCore || {};
if(!POSES || !GRAB_PARTS || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow){
  throw new Error('Puppetalk character rig core failed to load.');
}

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const peerId = r => `puppetalk-${r.toLowerCase()}`;
const send = (conn,msg) => { if(conn?.open) conn.send(msg); };
const cleanPlayerName = v => String(v || '').trim().replace(/\s+/g,' ').slice(0,24);
function savedPlayerName(){ try{return cleanPlayerName(localStorage.getItem('puppetalk-name'));}catch{return '';} }

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

  // PUPPETALK_TOY_SYSTEM_V1
  // PUPPETALK_TOY_TAP_V1
  // PUPPETALK_TOY_THROW_V1
  // PUPPETALK_DART_STICK_V1
  // PUPPETALK_DART_BALLOON_POP_V1
  // PUPPETALK_SEVERABLE_JOINTS_V1
  // PUPPETALK_LASER_FRISBEE_V1
  // PUPPETALK_ITEM_POLISH_V1
  // PUPPETALK_SEGMENTED_PUPPET_V1
  // PUPPETALK_SEAT_RENDER_V1
  // PUPPETALK_DEPTH_ASSIST_V1
  // PUPPETALK_VISUAL_THICKNESS_V1
  // PUPPETALK_SPECIAL_ITEMS_V1
  // PUPPETALK_BALLOON_TIE_V1
  // PUPPETALK_BALLOON_BUOYANCY_V1
  // PUPPETALK_PROP_EXTREMITIES_V1
  const props = new Map();
  const propGrips = new Map();
  let nextPropId = 1;
  const specialItems = new Map();
  const SPECIAL_ITEM_TYPES = ['frisbee','pump','ball','dart'];
  const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];

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
      Bodies.rectangle(W/2,-22,W+160,44,{isStatic:true,friction:.65}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];
    Composite.add(engine.world,bounds);
  }

  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

  function makeProp(type,x,y){
    const id = `prop-${nextPropId++}`;
    let body;
    let gripPoint = {x:0,y:0};
    if(type === 'ball'){
      body = Bodies.circle(x,y,16,{density:.0008,restitution:.9,friction:.24,frictionAir:.006});
    }else if(type === 'balloon'){
      body = Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
    }else if(type === 'frisbee'){
      body = Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004});
      gripPoint = {x:-15,y:0};
    }else if(type === 'pump'){
      body = Bodies.rectangle(x,y,44,60,{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});
      gripPoint = {x:0,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }
    body.label = `puppetalk-prop:${id}:${type}`;
    const prop = {id,type,body,gripPoint,heldBy:null,contest:null,attachedTo:null};
    props.set(id,prop);
    Composite.add(engine.world,body);
    return prop;
  }

  function ensureTestProps(){
    // A normal table begins empty; players introduce their own item deliberately.
  }
  function ensureLegacyTestProps(){
    if(props.size) return;
    const y = Math.max(82,Math.min(H*.38,H-180));
    makeProp('ball',W*.34,y);
    for(let i=0;i<6;i++) makeProp('dart',W*(.45+i*.045),y+18+(i%2)*20);
    makeProp('frisbee',W*.59,y-34);
    makeProp('pump',W*.73,H-68);
  }

  function updatePropContest(prop,now){
    const tug = prop.contest;
    if(!tug || !prop.heldBy) return;
    const holder = propGrips.get(gripKey(prop.heldBy.slot,prop.heldBy.hand));
    if(!holder){ cancelPropContest(prop); return; }
    const dt = Math.max(0,Math.min(.08,(now-tug.lastUpdateAt)/1000));
    tug.lastUpdateAt = now;
    if(now-tug.lastTapAt > 260) tug.score = Math.max(0,tug.score-dt*.12);
    tug.score = clamp(tug.score,0,1.05);
    holder.constraint.stiffness = .86-tug.score*.58;
    tug.constraint.stiffness = .14+tug.score*.72;
    if(tug.score >= 1){ promotePropContest(prop); return; }
    if(tug.score <= 0 && now-tug.lastTapAt > 700) cancelPropContest(prop);
  }

  function distancePointToSegment(point,a,b){
    const abx = b.x-a.x;
    const aby = b.y-a.y;
    const denom = abx*abx+aby*aby;
    if(denom <= .0001) return Math.hypot(point.x-a.x,point.y-a.y);
    const t = clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/denom,0,1);
    const x = a.x+abx*t;
    const y = a.y+aby*t;
    return Math.hypot(point.x-x,point.y-y);
  }
  function dartTouchesBalloon(dart,balloon){
    const db = dart?.body;
    const bb = balloon?.body;
    if(!db || !bb) return false;
    const half = 23;
    const left = Vector.rotate({x:-half,y:0},db.angle||0);
    const right = Vector.rotate({x:half,y:0},db.angle||0);
    const a = {x:db.position.x+left.x,y:db.position.y+left.y};
    const b = {x:db.position.x+right.x,y:db.position.y+right.y};
    return distancePointToSegment(bb.position,a,b) <= 20;
  }
  function popBalloon(balloon){
    if(!balloon || balloon.type !== 'balloon' || !props.has(balloon.id)) return false;
    if(balloon.contest) cancelPropContest(balloon);
    if(balloon.heldBy) releasePropHolder(balloon,false);
    balloon.attachedTo = null;
    Composite.remove(engine.world,balloon.body);
    props.delete(balloon.id);
    return true;
  }
  function driveDartBalloonPops(){
    const darts = [];
    const balloons = [];
    for(const prop of props.values()){
      if(prop.type === 'dart' && !prop.heldBy && !prop.contest && !prop.attachedTo) darts.push(prop);
      else if(prop.type === 'balloon') balloons.push(prop);
    }
    if(!darts.length || !balloons.length) return;

    for(const dart of darts){
      const velocity = dart.body?.velocity || {x:0,y:0};
      if(Math.hypot(velocity.x,velocity.y) < 1.15) continue;
      for(const balloon of [...balloons]){
        if(!props.has(balloon.id) || !dartTouchesBalloon(dart,balloon)) continue;
        if(popBalloon(balloon)){
          // Keep the dart travelling so a particularly good throw can puncture a cluster.
          Body.setVelocity(dart.body,{x:velocity.x*.90,y:velocity.y*.90});
        }
      }
    }
  }

  function pointSegmentDistance(point,a,b){
    const abx = b.x-a.x;
    const aby = b.y-a.y;
    const d = abx*abx+aby*aby;
    if(d < .0001) return Math.hypot(point.x-a.x,point.y-a.y);
    const t = clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
    return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
  }
  function driveLaserFrisbeeCuts(now){
    for(const prop of props.values()){
      if(prop.type !== 'frisbee') continue;
      const b = prop.body;
      const current = puppetalkAimProjectPropPoint(prop,prop._throwerSlot);
      const previous = prop._frisbeePrev || current;
      prop._frisbeePrev = current;

      if(!prop._cutArmed || prop.heldBy || prop.contest || prop.attachedTo) continue;
      const age = now-(prop._thrownAt||0);
      if(age < 120) continue; // leave the thrower's hand before a cut is possible

      const linear = Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
      const spin = Math.abs(b.angularVelocity||0);
      const edgeSpeed = linear+spin*23;
      const dangerous = linear >= 5.2 && spin >= .12 && edgeSpeed >= 8.8;
      b.isSensor = !!(prop._cutArmed && dangerous);
      if(!dangerous){
        if(linear < 3.5 && age > 280) prop._cutArmed = false;
        if(!prop._cutArmed) b.isSensor = false;
        continue;
      }

      let best = null;
      for(const p of puppets.values()){
        if(p.joints && p.severedJoints){
          for(const [name,constraint] of Object.entries(p.joints)){
            if(p.severedJoints.has(name)) continue;
            const qRaw = jointCutPoint(constraint);
            if(!qRaw) continue;
            const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
            const distance = pointSegmentDistance(q,previous,current);
            if(distance <= 13 && (!best || distance < best.distance)) best = {p,name,kind:'joint',distance};
          }
        }
        if(p.seams && p.brokenSeams){
          for(const [name,constraint] of Object.entries(p.seams)){
            if(p.brokenSeams.has(name)) continue;
            const qRaw = seamCutPoint(p,name);
            if(!qRaw) continue;
            const q = puppetalkAimProjectPoint(p,qRaw,prop._throwerSlot);
            const distance = pointSegmentDistance(q,previous,current);
            const radius = p.seamMeta?.[name]?.radius || 14;
            if(distance <= radius && (!best || distance < best.distance)) best = {p,name,kind:'seam',distance};
          }
        }
      }
      if(!best) continue;

      const cut = best.kind === 'seam' ? severSeam(best.p,best.name) : severJoint(best.p,best.name);
      if(cut){
        // One cut per throw. It keeps flying, but it is no longer a buzzsaw until
        // somebody catches/retrieves and throws it again.
        prop._cutArmed = false;
        b.isSensor = false;
        Body.setVelocity(b,{x:(b.velocity?.x||0)*.72,y:(b.velocity?.y||0)*.72});
        Body.setAngularVelocity(b,(b.angularVelocity||0)*.55);
      }
    }
  }

  function pumpNozzleOffset(scale){
    return {x:0,y:-34-18*Math.max(.34,scale||.34)};
  }
  function ensurePumpBalloon(pump){
    if(!pump || pump.type !== 'pump') return null;
    const existing = pump._balloonId ? props.get(pump._balloonId) : null;
    if(existing) return existing;

    const offset = pumpNozzleOffset(.34);
    const nozzle = worldOffset(pump.body,offset);
    const balloon = makeProp('balloon',nozzle.x,nozzle.y);
    balloon._inflation = 0;
    balloon._renderScale = 1;
    balloon._pumpId = pump.id;
    balloon.attachedTo = {
      mode:'pump',pumpId:pump.id,part:'pump',slot:null,
      body:pump.body,offset,angle:0
    };
    Body.setStatic(balloon.body,true);
    balloon.body.collisionFilter.mask = 0;
    pump._balloonId = balloon.id;
    syncAttachedProp(balloon);
    return balloon;
  }
  function inflatePumpBalloon(pump){
    const balloon = ensurePumpBalloon(pump);
    if(!balloon) return {ok:false,message:'The pump is jammed.'};
    balloon._inflation = (balloon._inflation||0)+1;
    const targetScale = .45+.28*Math.sqrt(balloon._inflation);
    const previousScale = Math.max(.05,balloon._renderScale||1);
    const ratio = targetScale/previousScale;
    Body.scale(balloon.body,ratio,ratio);
    balloon._renderScale = targetScale;
    if(balloon.attachedTo?.mode === 'pump') balloon.attachedTo.offset = pumpNozzleOffset(targetScale);
    syncAttachedProp(balloon);
    pump._lastPumpAt = performance.now();
    return {ok:true,message:'Pump '+balloon._inflation+' — balloon growing.'};
  }
  function releasePumpBalloon(balloon){
    if(!balloon || balloon.type !== 'balloon' || balloon.attachedTo?.mode !== 'pump') return false;
    const pump = props.get(balloon._pumpId || balloon.attachedTo?.pumpId);
    if(pump && pump._balloonId === balloon.id) pump._balloonId = null;
    balloon._pumpId = null;
    detachPropAttachment(balloon);
    Body.setVelocity(balloon.body,{x:(Math.random()-.5)*.35,y:-1.15});
    return true;
  }

  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;
  const PUPPETALK_ACTION_SCREEN_PAD = 15;
  const PUPPETALK_ACTION_DEPTH_X = .28;
  const PUPPETALK_ACTION_SEAT_ORDER = [0,3,1,4,2,5];

  function puppetalkActionSeatAngle(slot){
    const seat=PUPPETALK_ACTION_SEAT_ORDER[slot] ?? slot ?? 0;
    return seat*Math.PI/3;
  }
  function puppetalkActionHomeX(slot){ return .16+slot*.135; }
  function puppetalkActionDepth(slot){
    return Number.isInteger(slot) ? (window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0) : 0;
  }
  function puppetalkActionClampDepth(depth){
    const tuning=window.PuppetalkForegroundTuning;
    const lo=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
    const hi=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
    return clamp(depth,lo,hi);
  }
  function puppetalkActionProjectPuppetPoint(p,q,viewerSlot){
    if(!p?.torso || !q || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return null;
    const rawDepth=puppetalkActionDepth(p.slot);
    const rawCenter=p.torso.position;
    let delta=puppetalkActionSeatAngle(p.slot)-puppetalkActionSeatAngle(viewerSlot);
    while(delta>Math.PI) delta-=Math.PI*2;
    while(delta< -Math.PI) delta+=Math.PI*2;
    const c=Math.cos(delta),s=Math.sin(delta);
    const localSide=rawCenter.x/W-puppetalkActionHomeX(p.slot);
    const localForward=rawDepth*PUPPETALK_ACTION_DEPTH_X;
    const viewSide=localSide*c+localForward*s;
    const viewForward=localForward*c-localSide*s;
    const viewDepth=puppetalkActionClampDepth(viewForward/PUPPETALK_ACTION_DEPTH_X);
    const scale=window.PuppetalkDepthState?.scaleForDepth?.(viewDepth) || 1;
    const shift=(window.PuppetalkDepthState?.shiftForDepth?.(viewDepth) || 0)*H;
    const centerX=(puppetalkActionHomeX(p.slot)+viewSide)*W;
    return {
      x:centerX+(q.x-rawCenter.x)*scale,
      y:rawCenter.y+(q.y-rawCenter.y)*scale+shift,
      depth:viewDepth,
      scale
    };
  }
  function puppetalkAimProjectPoint(p,q,viewerSlot){
    return puppetalkActionProjectPuppetPoint(p,q,viewerSlot) || q;
  }
  function puppetalkAimProjectPropPoint(prop,viewerSlot){
    if(!prop?.body) return {x:0,y:0,depth:0};
    const owner=Number.isInteger(prop._throwerSlot)?prop._throwerSlot:viewerSlot;
    if(!Number.isInteger(owner) || !Number.isInteger(viewerSlot) || !Number.isFinite(prop._depth)){
      return {x:prop.body.position.x,y:prop.body.position.y,depth:0};
    }
    let delta=puppetalkActionSeatAngle(owner)-puppetalkActionSeatAngle(viewerSlot);
    while(delta>Math.PI) delta-=Math.PI*2;
    while(delta< -Math.PI) delta+=Math.PI*2;
    const c=Math.cos(delta),s=Math.sin(delta);
    const localSide=prop.body.position.x/W-puppetalkActionHomeX(owner);
    const localForward=prop._depth*PUPPETALK_ACTION_DEPTH_X;
    const viewSide=localSide*c+localForward*s;
    const viewForward=localForward*c-localSide*s;
    const viewDepth=puppetalkActionClampDepth(viewForward/PUPPETALK_ACTION_DEPTH_X);
    const shift=(window.PuppetalkDepthState?.shiftForDepth?.(viewDepth) || 0)*H;
    return {
      x:(puppetalkActionHomeX(owner)+viewSide)*W,
      y:prop.body.position.y+shift,
      depth:viewDepth
    };
  }
  function puppetalkAssistSegmentDistance(point,a,b){
    const abx=b.x-a.x,aby=b.y-a.y;
    const d=abx*abx+aby*aby;
    if(d<.0001) return Math.hypot(point.x-a.x,point.y-a.y);
    const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
    return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
  }
  function puppetalkAssistBodyRadius(body,scale=1){
    if(!body?.bounds) return 18;
    const w=Math.max(1,body.bounds.max.x-body.bounds.min.x);
    const h=Math.max(1,body.bounds.max.y-body.bounds.min.y);
    return clamp(Math.max(w,h)*.48*scale,12,34);
  }
  function puppetalkAssistBodies(p){
    return Array.isArray(p?.bodies) ? p.bodies.filter(Boolean) : [];
  }
  function driveDepthAssistedProps(now){
    for(const prop of props.values()){
      if(!Number.isInteger(prop._throwerSlot) || !Number.isFinite(prop._depth)) continue;
      if(prop.heldBy || prop.contest || prop.attachedTo) continue;
      const b=prop.body;
      const current=puppetalkAimProjectPropPoint(prop,prop._throwerSlot);
      const previous=prop._assistPrevScreen || current;
      prop._assistPrevScreen=current;
      if(now>(prop._depthAssistUntil||0)) continue;
      const speed=Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
      if(speed<2.2) continue;

      let best=null;
      for(const p of puppets.values()){
        if(p.slot===prop._throwerSlot) continue;
        for(const body of puppetalkAssistBodies(p)){
          const projected=puppetalkActionProjectPuppetPoint(p,body.position,prop._throwerSlot);
          if(!projected) continue;
          const depthGap=Math.abs(prop._depth-projected.depth);
          if(depthGap>PUPPETALK_ACTION_DEPTH_TOLERANCE) continue;
          const radius=puppetalkAssistBodyRadius(body,projected.scale)+PUPPETALK_ACTION_SCREEN_PAD;
          const distance=puppetalkAssistSegmentDistance(projected,previous,current);
          if(distance>radius) continue;
          const score=distance+depthGap*42;
          if(!best || score<best.score) best={p,body,projected,depthGap,distance,score};
        }
      }
      if(!best) continue;

      const depthDelta=best.projected.depth-prop._depth;
      prop._depth += clamp(depthDelta*.26,-.05,.05);

      // The frisbee's swept cut test consumes the same projected path directly. Other
      // thrown props get a small physical reconciliation so Matter can deliver the bounce,
      // stick, or knock that the player visibly aimed for.
      if(prop.type!=='frisbee'){
        const dx=best.body.position.x-best.projected.x;
        const dy=best.body.position.y-best.projected.y;
        const mismatch=Math.hypot(dx,dy);
        if(mismatch<115){
          Body.translate(b,{x:clamp(dx*.18,-6,6),y:clamp(dy*.18,-6,6)});
          Body.setVelocity(b,{
            x:(b.velocity?.x||0)+clamp(dx*.012,-1.05,1.05),
            y:(b.velocity?.y||0)+clamp(dy*.012,-1.05,1.05)
          });
        }
      }
    }
  }

  function driveProps(){
    const now = performance.now();
    props.forEach(prop=>{
      if(prop.type === 'balloon'){
        const b = prop.body;
        Body.applyForce(b,b.position,{x:0,y:-b.mass*engine.gravity.y*engine.gravity.scale*1.42});
      }
      updatePropContest(prop,now);
      driveAttachedBalloon(prop,now);
      syncAttachedProp(prop);
    });
    driveDartBalloonPops();
  }

  function propState(prop){
    const b = prop.body;
    return {
      id:prop.id,
      type:prop.type,
      depth:Number.isFinite(prop._depth) ? prop._depth : undefined,
      throwerSlot:Number.isInteger(prop._throwerSlot) ? prop._throwerSlot : undefined,
      armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,
      inflation:prop.type === 'balloon' ? (prop._inflation||0) : undefined,
      scale:prop.type === 'balloon' ? (prop._renderScale||1) : undefined,
      pumpBalloon:prop.type === 'pump' ? (prop._balloonId||null) : undefined,
      x:b.position.x/W,
      y:b.position.y/H,
      a:b.angle || 0,
      heldBy:prop.heldBy ? {slot:prop.heldBy.slot,hand:prop.heldBy.hand} : null,
      contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,
      tug:prop.contest ? clamp(prop.contest.score,0,1) : 0,
      attachedTo:balloonAttachmentState(prop)
    };
  }

  function handBody(p,hand){
    if(hand === 'left') return p.faL2 || p.faL;
    if(hand === 'right') return p.faR2 || p.faR;
    if(hand === 'leftFoot') return p.shL2 || p.shL;
    if(hand === 'rightFoot') return p.shR2 || p.shR;
    return null;
  }
  function handPoint(p,hand){
    if(hand === 'left') return grabWorldPoint(p,'leftHand');
    if(hand === 'right') return grabWorldPoint(p,'rightHand');
    if(hand === 'leftFoot') return grabWorldPoint(p,'leftFoot');
    if(hand === 'rightFoot') return grabWorldPoint(p,'rightFoot');
    return p?.torso?.position || {x:0,y:0};
  }
  function propGripLocalPoint(hand){
    return hand === 'leftFoot' || hand === 'rightFoot' ? {x:0,y:13.5} : {x:0,y:12};
  }
  function validPropEffector(hand){
    return hand === 'left' || hand === 'right' || hand === 'leftFoot' || hand === 'rightFoot';
  }
  const gripKey = (slot,hand)=>`${slot}:${hand}`;

  const ATTACHABLE_PARTS = ['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR'];
  function puppetPartForBody(body){
    if(!body) return null;
    if(Number.isInteger(body.plugin?.puppetalkSlot) && body.plugin?.puppetalkSegmentPart){
      return {slot:body.plugin.puppetalkSlot,part:body.plugin.puppetalkSegmentPart,body};
    }
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        if(p[part] === body) return {slot:p.slot,part,body};
      }
    }
    return null;
  }
  function propForBody(body){
    for(const prop of props.values()) if(prop.body === body) return prop;
    return null;
  }
  function closestPointOnBody(body,point){
    if(!body?.bounds) return {x:body.position.x,y:body.position.y};
    return {
      x:clamp(point.x,body.bounds.min.x,body.bounds.max.x),
      y:clamp(point.y,body.bounds.min.y,body.bounds.max.y)
    };
  }
  function nearestBalloonTarget(prop,slot,hand){
    const owner = puppets.get(slot);
    const heldBody = owner ? handBody(owner,hand) : null;
    let best = null;
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        const body = p[part];
        if(!body || body === heldBody) continue;
        const hit = closestPointOnBody(body,prop.body.position);
        const distance = Math.hypot(prop.body.position.x-hit.x,prop.body.position.y-hit.y);
        if(distance <= 46 && (!best || distance < best.distance)){
          best = {slot:p.slot,part,body,point:hit,distance};
        }
      }
    }
    return best;
  }
  function tieBalloonToBody(prop,target){
    if(!prop || prop.type !== 'balloon' || !target?.body || prop.attachedTo) return false;
    cancelPropContest(prop);
    if(prop.heldBy) releasePropHolder(prop,false);
    const numeric = Number(String(prop.id).replace(/D+/g,'')) || 1;
    prop.attachedTo = {
      slot:target.slot,
      part:target.part,
      body:target.body,
      offset:localOffset(target.body,target.point || target.body.position),
      angle:0,
      mode:'balloon',
      stringLength:58+(numeric%3)*6,
      phase:numeric*.83
    };
    Body.setStatic(prop.body,true);
    prop.body.collisionFilter.mask = 0;
    syncAttachedProp(prop);
    return true;
  }
  function driveAttachedBalloon(prop,now){
    const a = prop?.attachedTo;
    if(prop?.type !== 'balloon' || a?.mode !== 'balloon' || !a.body) return;
    const anchor = worldOffset(a.body,a.offset);

    let count = 0;
    for(const candidate of props.values()){
      if(candidate?.type === 'balloon' &&
         candidate.attachedTo?.mode === 'balloon' &&
         candidate.attachedTo?.slot === a.slot) count++;
    }

    // Four balloons are the intentional take-off threshold. One or two mostly tug;
    // three make the puppet conspicuously light; the fourth gives enough combined
    // buoyancy to beat gravity + standing support. Beyond that the curve rises hard
    // so eight balloons keep hauling until the puppet is pressed against the ceiling.
    let baseLift;
    if(count <= 1) baseLift = .0034;
    else if(count === 2) baseLift = .0045;
    else if(count === 3) baseLift = .0062;
    else if(count === 4) baseLift = .0115;
    else baseLift = .0115 + (count-4)*.0018;

    const puppet = puppets.get(a.slot);
    const upwardSpeed = Math.max(0,-(puppet?.torso?.velocity?.y || 0));
    // Retain some terminal-speed damping, but never fade lift enough for a large
    // balloon cluster to lose against the standing rig before it reaches the ceiling.
    const speedFade = clamp(1-upwardSpeed/13,.55,1);
    const balloonScale = Math.max(.35,prop._renderScale||1);
    const lift = baseLift * balloonScale*balloonScale * speedFade;
    const sway = Math.sin(now*.0016+(a.phase||0))*.00032;

    // Preserve visibly local limb pulling, while passing more force through the torso
    // once take-off begins so four balloons attached around the limbs raise the whole
    // articulated body rather than merely stretching it upward.
    const torso = puppet?.torso;
    const localShare = torso && torso !== a.body ? (count >= 4 ? .64 : .76) : 1;
    Body.applyForce(a.body,anchor,{x:sway,y:-lift*localShare});
    if(torso && torso !== a.body){
      Body.applyForce(torso,torso.position,{x:0,y:-lift*(1-localShare)});
    }
  }
  function balloonAttachmentState(prop){
    const a = prop?.attachedTo;
    if(!a) return null;
    const anchor = a.body ? worldOffset(a.body,a.offset) : null;
    return {
      slot:a.slot,
      part:a.part,
      mode:a.mode || 'embedded',
      anchor:anchor ? {x:anchor.x/W,y:anchor.y/H} : null
    };
  }
  function localOffset(body,world){
    return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);
  }
  function worldOffset(body,local){
    const r = Vector.rotate(local,body.angle);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }
  function attachPropToBody(prop,target){
    if(!prop || !target?.body || prop.attachedTo) return false;
    cancelPropContest(prop);
    if(prop.heldBy) releasePropHolder(prop,false);
    prop.attachedTo = {
      slot:target.slot,
      part:target.part,
      body:target.body,
      offset:localOffset(target.body,prop.body.position),
      angle:(prop.body.angle||0)-(target.body.angle||0)
    };
    Body.setStatic(prop.body,true);
    prop.body.collisionFilter.mask = 0;
    return true;
  }
  function detachPropAttachment(prop){
    const a = prop?.attachedTo;
    if(!a) return false;
    const inherited = a.body?.velocity ? {x:a.body.velocity.x,y:a.body.velocity.y} : {x:0,y:0};
    prop.attachedTo = null;
    prop.body.collisionFilter.mask = 0xFFFFFFFF;
    Body.setStatic(prop.body,false);
    Body.setVelocity(prop.body,inherited);
    return true;
  }
  function syncAttachedProp(prop){
    const a = prop?.attachedTo;
    if(!a?.body) return;
    if(a.mode === 'balloon'){
      const anchor = worldOffset(a.body,a.offset);
      const now = performance.now();
      const sway = Math.sin(now*.0016+(a.phase||0))*7;
      Body.setPosition(prop.body,{x:anchor.x+sway,y:anchor.y-(a.stringLength||62)});
      Body.setAngle(prop.body,Math.sin(now*.0013+(a.phase||0))*.06);
      return;
    }
    Body.setPosition(prop.body,worldOffset(a.body,a.offset));
    Body.setAngle(prop.body,(a.body.angle||0)+a.angle);
  }
  function installDartImpacts(){
    Matter.Events.on(engine,'collisionStart',event=>{
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'dart' || prop.heldBy || prop.contest || prop.attachedTo) continue;
        const target = puppetPartForBody(other);
        if(!target) continue;
        const rvx = (prop.body.velocity?.x||0)-(other.velocity?.x||0);
        const rvy = (prop.body.velocity?.y||0)-(other.velocity?.y||0);
        const relativeSpeed = Math.hypot(rvx,rvy);
        if(relativeSpeed < 2.15) continue;
        attachPropToBody(prop,target);
      }
    });
  }

  function gripRecord(slot,hand){ return propGrips.get(gripKey(slot,hand)); }
  function freePropHand(slot,hand,propId=null){
    const held = gripRecord(slot,hand);
    return !held || held.propId === propId;
  }
  function clearPropGrip(slot,hand){
    const key = gripKey(slot,hand);
    const grip = propGrips.get(key);
    if(!grip) return null;
    Composite.remove(engine.world,grip.constraint);
    propGrips.delete(key);
    return grip;
  }
  function makePropGrip(prop,slot,hand,stiffness,role){
    const p = puppets.get(slot);
    if(!p || !freePropHand(slot,hand,prop.id)) return null;
    const constraint = Constraint.create({
      bodyA:handBody(p,hand),pointA:propGripLocalPoint(hand),
      bodyB:prop.body,pointB:prop.gripPoint || {x:0,y:0},
      length:3,stiffness,damping:.19
    });
    Composite.add(engine.world,constraint);
    const grip = {propId:prop.id,constraint,role};
    propGrips.set(gripKey(slot,hand),grip);
    return grip;
  }
  function cancelPropContest(prop){
    const tug = prop?.contest;
    if(!tug) return;
    clearPropGrip(tug.slot,tug.hand);
    prop.contest = null;
    const holder = prop.heldBy && gripRecord(prop.heldBy.slot,prop.heldBy.hand);
    if(holder) holder.constraint.stiffness = .88;
  }
  function promotePropContest(prop){
    const tug = prop?.contest;
    if(!tug) return false;
    if(prop.heldBy) clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
    tug.constraint.stiffness = .88;
    const record = gripRecord(tug.slot,tug.hand);
    if(record) record.role = 'holder';
    prop.heldBy = {slot:tug.slot,hand:tug.hand};
    prop.contest = null;
    return true;
  }
  function releasePropHolder(prop,promote=false){
    if(!prop?.heldBy) return;
    clearPropGrip(prop.heldBy.slot,prop.heldBy.hand);
    prop.heldBy = null;
    if(promote && prop.contest) promotePropContest(prop);
    else cancelPropContest(prop);
  }
  function beginPropHold(prop,slot,hand){
    prop._throwerSlot = null;
    prop._depth = null;
    prop._depthAssistUntil = 0;
    prop._assistPrevScreen = null;
    const grip = makePropGrip(prop,slot,hand,.88,'holder');
    if(!grip) return false;
    if(prop.type === 'frisbee'){
      prop._cutArmed = false;
      prop._thrownAt = 0;
      prop._frisbeePrev = null;
      prop.body.isSensor = false;
    }
    prop.heldBy = {slot,hand};
    return true;
  }
  function beginPropContest(prop,slot,hand,now){
    const grip = makePropGrip(prop,slot,hand,.17,'contest');
    if(!grip) return false;
    prop.contest = {slot,hand,constraint:grip.constraint,score:.18,lastTapAt:now,lastUpdateAt:now};
    return true;
  }
  function propHandIsClose(slot,hand,prop){
    const p = puppets.get(slot);
    if(!p) return false;
    const hp = handPoint(p,hand);
    const speed = Math.hypot(prop?.body?.velocity?.x||0,prop?.body?.velocity?.y||0);
    const reach = prop?.type === 'frisbee' ? (speed < 3.8 ? 122 : 102) : 86;
    return Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y) <= reach;
  }
  function tapProp(slot,msg){
    const prop = props.get(msg?.propId);
    const hand = msg?.hand;
    if(!prop || !validPropEffector(hand)) return {ok:false,message:'Tap the object with a nearby hand or foot.'};
    if(!propHandIsClose(slot,hand,prop)) return {ok:false,message:'Move a hand a little closer first.'};
    const now = performance.now();

    if(prop.attachedTo){
      if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
      detachPropAttachment(prop);
      if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Pulled it free, but could not hold it.'};
      return {ok:true,message:'Pulled the '+prop.type+' free.'};
    }

    if(!prop.heldBy){
      if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
      if(!beginPropHold(prop,slot,hand)) return {ok:false,message:'Could not get hold of it.'};
      return {ok:true,message:'Picked up '+prop.type+'.'};
    }

    if(prop.heldBy.slot === slot){
      if(prop.type === 'balloon' && !prop.contest){
        const target = nearestBalloonTarget(prop,slot,hand);
        if(target && tieBalloonToBody(prop,target)){
          return {ok:true,message:'Tied balloon to '+target.part+'.'};
        }
      }
      // Once the prop is ours, touching it is reserved for controlling the holding hand.
      // Never interpret a self-held prop tap as an implicit drop.
      if(prop.contest){
        prop.contest.score = Math.max(0,prop.contest.score-.19);
        prop.contest.lastTapAt = now;
        prop.contest.lastUpdateAt = now;
        if(prop.contest.score <= .01) cancelPropContest(prop);
        return {ok:true,message:'Held your ground.'};
      }
      return {ok:true,message:'Still holding '+prop.type+'.'};
    }

    if(prop.contest){
      if(prop.contest.slot !== slot) return {ok:false,message:'Someone else is already tugging at it.'};
      if(prop.contest.hand !== hand) return {ok:false,message:'Keep using the same hand for this tug.'};
      prop.contest.score = Math.min(1.05,prop.contest.score+.19);
      prop.contest.lastTapAt = now;
      prop.contest.lastUpdateAt = now;
      if(prop.contest.score >= 1){
        promotePropContest(prop);
        return {ok:true,message:'Pulled the '+prop.type+' free.'};
      }
      return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
    }

    if(!freePropHand(slot,hand,prop.id)) return {ok:false,message:'That hand is already holding something.'};
    if(!beginPropContest(prop,slot,hand,now)) return {ok:false,message:'Could not get a grip on it.'};
    return {ok:true,message:'Tugging '+prop.type+' — keep tapping.'};
  }
  function releaseAllPropGrips(slot){
    props.forEach(prop=>{
      if(prop.contest?.slot === slot) cancelPropContest(prop);
      if(prop.heldBy?.slot === slot) releasePropHolder(prop,true);
    });
  }
  function throwHeldProp(slot,msg){
    const hand = msg?.hand;
    if(!validPropEffector(hand)) return {ok:false,message:'Choose a throwing hand or foot.'};
    const grip = gripRecord(slot,hand);
    if(!grip) return {ok:false,message:'That hand is not holding anything.'};
    const prop = props.get(grip.propId);
    if(!prop || prop.heldBy?.slot !== slot || prop.heldBy?.hand !== hand) return {ok:false,message:'That prop is no longer held.'};

    const p = puppets.get(slot);
    const hb = p ? handBody(p,hand) : null;
    const handV = hb?.velocity || {x:0,y:0};
    const propV = prop.body.velocity || {x:0,y:0};

    const gestureVX = clamp(Number(msg.vx)||0,-3.2,3.2)*W/60;
    const gestureVY = clamp(Number(msg.vy)||0,-3.2,3.2)*H/60;
    let vx = gestureVX*.72 + handV.x*.42 + propV.x*.34;
    let vy = gestureVY*.72 + handV.y*.42 + propV.y*.34;
    const speed = Math.hypot(vx,vy);
    const maxSpeed = 17;
    if(speed > maxSpeed){
      const k = maxSpeed/speed;
      vx *= k;
      vy *= k;
    }

    const spin = clamp((prop.body.angularVelocity||0)*.8 + (hb?.angularVelocity||0)*.55 + gestureVX*.018,-.34,.34);
    prop._throwerSlot = slot;
    prop._depth = window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0;
    prop._depthAssistUntil = performance.now()+1750;
    prop._assistPrevScreen = null;
    releasePropHolder(prop,false);
    Body.setVelocity(prop.body,{x:vx,y:vy});
    if(prop.type === 'frisbee'){
      const direction = Math.sign(vx || 1);
      Body.setAngularVelocity(prop.body,clamp(spin*1.45+direction*.18,-.58,.58));
      prop._cutArmed = true;
      prop._thrownAt = performance.now();
      prop._frisbeePrev = puppetalkAimProjectPropPoint(prop,slot);
      prop.body.isSensor = true;
    }else{
      Body.setAngularVelocity(prop.body,spin);
    }
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};
  }

  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop') return;
    if(msg.action === 'pump'){
      const pump = props.get(msg.propId);
      const result = pump?.type === 'pump' ? inflatePumpBalloon(pump) : {ok:false,message:'That is not a balloon pump.'};
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
      return;
    }
    if(msg.action === 'release-pump-balloon'){
      const balloon = props.get(msg.propId);
      const ok = releasePumpBalloon(balloon);
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,ok,message:ok?'Released balloon.':'That balloon is not on the pump.'});
      return;
    }
    let result = null;
    if(msg.action === 'tap') result = tapProp(slot,msg);
    else if(msg.action === 'throw') result = throwHeldProp(slot,msg);
    if(!result) return;
    send(conns.get(slot),{type:'prop-result',propId:msg.propId || result.propId,...result});
  }

  function specialItemLabel(type){
    if(type === 'frisbee') return 'Laser frisbee';
    if(type === 'pump') return 'Balloon pump';
    if(type === 'ball') return 'Ball';
    if(type === 'dart') return 'Sticky darts';
    return 'Item';
  }
  function specialItemType(slot,requested){
    if(SPECIAL_ITEM_TYPES.includes(requested)) return requested;
    return SPECIAL_ITEM_BY_SLOT[Math.max(0,Number(slot)||0)%SPECIAL_ITEM_BY_SLOT.length] || 'ball';
  }
  function specialItemStillOut(slot){
    const id = specialItems.get(slot);
    return !!(id && props.has(id));
  }
  function bringOutSpecialItem(slot,requested){
    const p = puppets.get(slot);
    if(!p) return {ok:false,message:'Your puppet is not ready yet.'};
    const type = specialItemType(slot,requested);
    if(specialItemStillOut(slot)) return {ok:false,alreadyOut:true,type,message:specialItemLabel(type)+' is already out.'};

    let x = p.torso.position.x + (slot%2 ? -72 : 72);
    let y = p.torso.position.y - 8;
    if(type === 'pump'){
      x = clamp(x,52,W-52);
      y = H-68;
    }else{
      const hand = grabWorldPoint(p,'rightHand');
      x = clamp(hand.x + (slot%2 ? -34 : 34),30,W-30);
      y = clamp(hand.y-8,46,H-54);
    }
    const prop = makeProp(type,x,y);
    prop.specialOwner = slot;
    specialItems.set(slot,prop.id);
    return {ok:true,type,propId:prop.id,message:'Brought out '+specialItemLabel(type)+'.'};
  }
  function handleSpecialItemInput(slot,msg){
    if(msg?.type !== 'special-item' || msg.action !== 'bring-out') return;
    const result = bringOutSpecialItem(slot,msg.item);
    send(conns.get(slot),{type:'special-item-result',...result});
  }

  function tagHiddenSegment(body,slot,part,segment){
    body.plugin = body.plugin || {};
    delete body.plugin.puppetalkPart;
    body.plugin.puppetalkSegmentPart = part;
    body.plugin.puppetalkSegment = segment;
    body.plugin.puppetalkSlot = slot;
    return body;
  }

  function makePuppet(slot){
    if(puppets.has(slot)) return puppets.get(slot);
    const x = W*(.16+slot*.135);
    const y = Math.min(H-170,H*.62);
    const group = Body.nextGroup(true);
    const opt = {collisionFilter:{group},frictionAir:.04,restitution:.08,friction:.8};
    // Keep these first ten bodies in the historic creation order. stability.js
    // therefore continues to tag the canonical control parts exactly as before.
    const torso = Bodies.rectangle(x,y,48,26,{...opt,chamfer:{radius:7},density:.0022});
    const head = Bodies.rectangle(x,y-53,44,24,{...opt,chamfer:{radius:11},density:.00068});
    const uaL = Bodies.rectangle(x-37,y-30,16,26,opt);
    const faL = Bodies.rectangle(x-42,y+18,15,25,opt);
    const uaR = Bodies.rectangle(x+37,y-30,16,26,opt);
    const faR = Bodies.rectangle(x+42,y+18,15,25,opt);
    const thL = Bodies.rectangle(x-14,y+50.5,19,29,opt);
    const shL = Bodies.rectangle(x-14,y+104.5,17,27,opt);
    const thR = Bodies.rectangle(x+14,y+50.5,19,29,opt);
    const shR = Bodies.rectangle(x+14,y+104.5,17,27,opt);

    const torsoTop = tagHiddenSegment(Bodies.rectangle(x,y-26,48,26,{...opt,chamfer:{radius:7},density:.0022}),slot,'torso','top');
    const torsoBottom = tagHiddenSegment(Bodies.rectangle(x,y+26,48,26,{...opt,chamfer:{radius:7},density:.0022}),slot,'torso','bottom');
    const headTop = tagHiddenSegment(Bodies.rectangle(x,y-77,44,24,{...opt,chamfer:{radius:11},density:.00068}),slot,'head','top');
    const uaL2 = tagHiddenSegment(Bodies.rectangle(x-37,y-4,16,26,opt),slot,'uaL','distal');
    const faL2 = tagHiddenSegment(Bodies.rectangle(x-42,y+42.5,15,24,opt),slot,'faL','distal');
    const uaR2 = tagHiddenSegment(Bodies.rectangle(x+37,y-4,16,26,opt),slot,'uaR','distal');
    const faR2 = tagHiddenSegment(Bodies.rectangle(x+42,y+42.5,15,24,opt),slot,'faR','distal');
    const thL2 = tagHiddenSegment(Bodies.rectangle(x-14,y+79.5,19,29,opt),slot,'thL','distal');
    const shL2 = tagHiddenSegment(Bodies.rectangle(x-14,y+131.5,17,27,opt),slot,'shL','distal');
    const thR2 = tagHiddenSegment(Bodies.rectangle(x+14,y+79.5,19,29,opt),slot,'thR','distal');
    const shR2 = tagHiddenSegment(Bodies.rectangle(x+14,y+131.5,17,27,opt),slot,'shR','distal');
    const seams = {
      torsoUpper:joint(torsoTop,{x:0,y:13},torso,{x:0,y:-13},.995),
      torsoLower:joint(torso,{x:0,y:13},torsoBottom,{x:0,y:-13},.995),
      headMiddle:joint(head,{x:0,y:-12},headTop,{x:0,y:12},.995),
      leftUpperArm:joint(uaL,{x:0,y:13},uaL2,{x:0,y:-13},.995),
      leftForearm:joint(faL,{x:0,y:12},faL2,{x:0,y:-12},.995),
      rightUpperArm:joint(uaR,{x:0,y:13},uaR2,{x:0,y:-13},.995),
      rightForearm:joint(faR,{x:0,y:12},faR2,{x:0,y:-12},.995),
      leftThigh:joint(thL,{x:0,y:14.5},thL2,{x:0,y:-14.5},.995),
      leftShin:joint(shL,{x:0,y:13.5},shL2,{x:0,y:-13.5},.995),
      rightThigh:joint(thR,{x:0,y:14.5},thR2,{x:0,y:-14.5},.995),
      rightShin:joint(shR,{x:0,y:13.5},shR2,{x:0,y:-13.5},.995)
    };
    const seamMeta = {
      torsoUpper:{radius:29,part:'torso'},torsoLower:{radius:29,part:'torso'},
      headMiddle:{radius:27,part:'head'},
      leftUpperArm:{radius:13,part:'uaL'},leftForearm:{radius:13,part:'faL'},
      rightUpperArm:{radius:13,part:'uaR'},rightForearm:{radius:13,part:'faR'},
      leftThigh:{radius:14,part:'thL'},leftShin:{radius:14,part:'shL'},
      rightThigh:{radius:14,part:'thR'},rightShin:{radius:14,part:'shR'}
    };
    const joints = {
      neck:joint(torsoTop,{x:0,y:-13},head,{x:0,y:12}),
      leftShoulder:joint(torsoTop,{x:-24,y:-1},uaL,{x:0,y:-13}),
      leftElbow:joint(uaL2,{x:0,y:13},faL,{x:0,y:-12}),
      rightShoulder:joint(torsoTop,{x:24,y:-1},uaR,{x:0,y:-13}),
      rightElbow:joint(uaR2,{x:0,y:13},faR,{x:0,y:-12}),
      leftHip:joint(torsoBottom,{x:-14,y:12},thL,{x:0,y:-14.5}),
      leftKnee:joint(thL2,{x:0,y:14.5},shL,{x:0,y:-13.5}),
      rightHip:joint(torsoBottom,{x:14,y:12},thR,{x:0,y:-14.5}),
      rightKnee:joint(thR2,{x:0,y:14.5},shR,{x:0,y:-13.5})
    };
    const constraints = [...Object.values(joints),...Object.values(seams)];
    const puppet = {
      slot,
      name:NAMES[slot] || `Puppet ${slot+1}`,
      color:COLORS[slot] || '#aaa',
      look:defaultLook(slot),
      torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,
      torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2,
      bodies:[torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2],
      constraints,joints,seams,seamMeta,
      brokenSeams:new Set(),
      severedJoints:new Set(),
      recoverVersion:0,
      repairRequested:false,
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

  function jointWorldPoint(constraint,side){
    const body = side === 'A' ? constraint?.bodyA : constraint?.bodyB;
    const point = side === 'A' ? constraint?.pointA : constraint?.pointB;
    if(!body || !point) return null;
    const r = Vector.rotate(point,body.angle||0);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }
  function jointGap(constraint){
    const a = jointWorldPoint(constraint,'A');
    const b = jointWorldPoint(constraint,'B');
    return a && b ? Math.hypot(a.x-b.x,a.y-b.y) : Infinity;
  }
  function jointCutPoint(constraint){
    const a = jointWorldPoint(constraint,'A');
    const b = jointWorldPoint(constraint,'B');
    if(!a || !b) return null;
    return {x:(a.x+b.x)*.5,y:(a.y+b.y)*.5};
  }
  function severJoint(p,name){
    if(!p?.joints?.[name] || p.severedJoints?.has(name)) return false;
    const c = p.joints[name];
    Composite.remove(engine.world,c);
    p.severedJoints.add(name);
    p.repairRequested = false;
    return true;
  }
  function repairSeveredJoints(p){
    if(!p?.repairRequested || !p.severedJoints?.size) return;
    for(const name of [...p.severedJoints]){
      const c = p.joints?.[name];
      if(!c || jointGap(c) > 34) continue;
      Composite.add(engine.world,c);
      p.severedJoints.delete(name);
    }
    if(!p.severedJoints.size) p.repairRequested = false;
  }
  function handleJointRecovery(slot,msg){
    if(msg?.type !== 'input') return;
    const version = Number.isInteger(msg.input?.recoverVersion) ? msg.input.recoverVersion : null;
    if(version === null) return;
    const p = makePuppet(slot);
    if(version > (p.recoverVersion||0)){
      p.recoverVersion = version;
      p.repairRequested = true;
    }
  }

  function severSeam(p,name){
    if(!p?.seams?.[name] || p.brokenSeams?.has(name)) return false;
    Composite.remove(engine.world,p.seams[name]);
    p.brokenSeams.add(name);
    p.repairRequested = false;
    return true;
  }
  function seamCutPoint(p,name){
    const c=p?.seams?.[name];
    return c ? jointCutPoint(c) : null;
  }
  function repairBrokenSeams(p){
    if(!p?.repairRequested || !p.brokenSeams?.size) return;
    for(const name of [...p.brokenSeams]){
      const c=p.seams?.[name];
      if(!c?.bodyA || !c?.bodyB) continue;
      const a=jointWorldPoint(c,'A');
      const b=jointWorldPoint(c,'B');
      if(!a || !b) continue;
      const dx=b.x-a.x,dy=b.y-a.y;
      const gap=Math.hypot(dx,dy);
      if(gap < 20){
        Composite.add(engine.world,c);
        p.brokenSeams.delete(name);
        continue;
      }
      const pull=Math.min(.00032,.00011+gap*.0000024);
      const ma=Math.max(.2,c.bodyA.mass||1),mb=Math.max(.2,c.bodyB.mass||1);
      Body.applyForce(c.bodyA,a,{x:dx*pull*ma,y:dy*pull*ma});
      Body.applyForce(c.bodyB,b,{x:-dx*pull*mb,y:-dy*pull*mb});
      const rel=angleDelta(c.bodyB.angle||0,c.bodyA.angle||0);
      c.bodyA.torque += clamp(rel*.0025,-.012,.012);
      c.bodyB.torque -= clamp(rel*.0025,-.012,.012);
    }
    if(!p.brokenSeams.size && !p.severedJoints?.size) p.repairRequested=false;
  }

  function removePuppet(slot){
    const p = puppets.get(slot);
    if(!p) return;
    releaseAllPropGrips(slot);
    props.forEach(prop=>{ if(prop.attachedTo?.slot === slot) detachPropAttachment(prop); });
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
    if(part === 'leftHand') return p.faL2 || p.faL;
    if(part === 'rightHand') return p.faR2 || p.faR;
    if(part === 'leftFoot') return p.shL2 || p.shL;
    if(part === 'rightFoot') return p.shR2 || p.shR;
    return p.torso;
  }

  function grabWorldPoint(p,part){
    if(part === 'pelvis') return worldPoint(p.torso,{x:0,y:34});
    if(part === 'leftShoulder') return worldPoint(p.torso,{x:-24,y:-27});
    if(part === 'rightShoulder') return worldPoint(p.torso,{x:24,y:-27});
    if(part === 'leftHand') return worldPoint(p.faL2 || p.faL,{x:0,y:12});
    if(part === 'rightHand') return worldPoint(p.faR2 || p.faR,{x:0,y:12});
    if(part === 'leftFoot') return worldPoint(p.shL2 || p.shL,{x:0,y:13.5});
    if(part === 'rightFoot') return worldPoint(p.shR2 || p.shR,{x:0,y:13.5});
    return grabBody(p,part).position;
  }

  function springPull(body,point,target,stiffness,damping=.003){
    const mass = Math.max(.2,body.mass || 1);
    Body.applyForce(body,point,{
      x:((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,
      y:((target.y-point.y)*stiffness-body.velocity.y*damping)*mass
    });
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
      resetPins(rig);
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
  }

  function norm(point){ return {x:point.x/W,y:point.y/H}; }
  function segmentState(body){ return {x:body.position.x/W,y:body.position.y/H,a:body.angle||0}; }
  function anatomy(p){
    const t = p.torso;
    return {
      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,severed:[...(p.severedJoints||[])],brokenSeams:[...(p.brokenSeams||[])],
      segTorsoTop:segmentState(p.torsoTop),segTorsoBottom:segmentState(p.torsoBottom),
      segHeadLower:segmentState(p.head),segHeadTop:segmentState(p.headTop),look:cleanLook(p.look,p.slot),
      torso:{x:t.position.x/W,y:t.position.y/H,a:t.angle},
      head:{x:(p.head.position.x+p.headTop.position.x)/(2*W),y:(p.head.position.y+p.headTop.position.y)/(2*H),a:((p.head.angle||0)+(p.headTop.angle||0))*.5},
      sl:norm(worldPoint(t,{x:-24,y:-27})),sr:norm(worldPoint(t,{x:24,y:-27})),
      el:norm(worldPoint(p.uaL2,{x:0,y:13})),er:norm(worldPoint(p.uaR2,{x:0,y:13})),
      wl:norm(worldPoint(p.faL2,{x:0,y:12})),wr:norm(worldPoint(p.faR2,{x:0,y:12})),
      hl:norm(worldPoint(t,{x:-14,y:38})),hr:norm(worldPoint(t,{x:14,y:38})),
      kl:norm(worldPoint(p.thL2,{x:0,y:14.5})),kr:norm(worldPoint(p.thR2,{x:0,y:14.5})),
      al:norm(worldPoint(p.shL2,{x:0,y:13.5})),ar:norm(worldPoint(p.shR2,{x:0,y:13.5})),
      uaLt:norm(worldPoint(p.uaL,{x:0,y:-13})),faLt:norm(worldPoint(p.faL,{x:0,y:-12})),
      uaRt:norm(worldPoint(p.uaR,{x:0,y:-13})),faRt:norm(worldPoint(p.faR,{x:0,y:-12})),
      thLt:norm(worldPoint(p.thL,{x:0,y:-14.5})),shLt:norm(worldPoint(p.shL,{x:0,y:-13.5})),
      thRt:norm(worldPoint(p.thR,{x:0,y:-14.5})),shRt:norm(worldPoint(p.shR,{x:0,y:-13.5})),
      uaLmA:norm(worldPoint(p.uaL,{x:0,y:13})),uaLmB:norm(worldPoint(p.uaL2,{x:0,y:-13})),
      faLmA:norm(worldPoint(p.faL,{x:0,y:12})),faLmB:norm(worldPoint(p.faL2,{x:0,y:-12})),
      uaRmA:norm(worldPoint(p.uaR,{x:0,y:13})),uaRmB:norm(worldPoint(p.uaR2,{x:0,y:-13})),
      faRmA:norm(worldPoint(p.faR,{x:0,y:12})),faRmB:norm(worldPoint(p.faR2,{x:0,y:-12})),
      thLmA:norm(worldPoint(p.thL,{x:0,y:14.5})),thLmB:norm(worldPoint(p.thL2,{x:0,y:-14.5})),
      shLmA:norm(worldPoint(p.shL,{x:0,y:13.5})),shLmB:norm(worldPoint(p.shL2,{x:0,y:-13.5})),
      thRmA:norm(worldPoint(p.thR,{x:0,y:14.5})),thRmB:norm(worldPoint(p.thR2,{x:0,y:-14.5})),
      shRmA:norm(worldPoint(p.shR,{x:0,y:13.5})),shRmB:norm(worldPoint(p.shR2,{x:0,y:-13.5}))
    };
  }

  function drawStage(){
    drawBackdrop(ctx,W,H);
    props.forEach(prop=>drawProp(ctx,propState(prop),W,H));
    puppets.forEach(p=>drawAnatomy(ctx,anatomy(p),W,H,false));
  }

  function broadcastScene(now){
    if(now-lastSceneSent < 66 || !conns.size) return;
    lastSceneSent = now;
    const scene = {type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)};
    conns.forEach(conn=>send(conn,scene));
  }

  function tick(now){
    const dt = clamp(now-last,8,25);
    last = now;
    puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); repairSeveredJoints(p); });
    driveProps();
    Engine.update(engine,dt);
    driveDepthAssistedProps(now);
    driveLaserFrisbeeCuts(now);
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
      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)});
      updateStatus();
    });
    conn.on('data',msg=>applyInput(slot,msg));
    conn.on('data',msg=>handlePropInput(slot,msg));
    conn.on('data',msg=>handleSpecialItemInput(slot,msg));
    conn.on('data',msg=>handleJointRecovery(slot,msg));
    conn.on('data',msg=>{ if(msg?.type==='look'){ const p=makePuppet(slot); p.look=cleanLook(msg.look,slot); p.color=p.look.color; const chosen=cleanPlayerName(msg.name); if(chosen) p.name=chosen; } });
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
  function installPropContactPhysics(){
    Matter.Events.on(engine,'collisionStart',event=>{
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'balloon' || prop.attachedTo || prop.contest) continue;
        const target = puppetPartForBody(other);
        if(!target) continue;

        // A balloon being carried should not glue itself straight back onto the
        // exact extremity carrying it, but contact with any other body part sticks.
        if(prop.heldBy){
          const holder = puppets.get(prop.heldBy.slot);
          const heldBody = holder ? handBody(holder,prop.heldBy.hand) : null;
          if(heldBody === target.body) continue;
        }
        const point = closestPointOnBody(target.body,prop.body.position);
        tieBalloonToBody(prop,{...target,point});
      }
    });

    Matter.Events.on(engine,'collisionActive',event=>{
      const now = performance.now();
      for(const pair of event.pairs || []){
        let prop = propForBody(pair.bodyA);
        let other = pair.bodyB;
        if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
        if(!prop || prop.type !== 'ball' || prop.heldBy || prop.attachedTo) continue;
        const target = puppetPartForBody(other);
        if(!target || (target.part !== 'shL' && target.part !== 'shR')) continue;
        if(now-(prop._lastKickAt||0) < 130) continue;

        const footLocal = {x:0,y:25};
        const r = Vector.rotate(footLocal,other.angle||0);
        const omega = other.angularVelocity || 0;
        const footV = {
          x:(other.velocity?.x||0)-omega*r.y,
          y:(other.velocity?.y||0)+omega*r.x
        };
        const footSpeed = Math.hypot(footV.x,footV.y);
        if(footSpeed < 1.15) continue;

        const current = prop.body.velocity || {x:0,y:0};
        let vx = current.x + footV.x*1.08;
        let vy = current.y + footV.y*1.08;
        const speed = Math.hypot(vx,vy);
        if(speed > 15){
          const k = 15/speed;
          vx *= k; vy *= k;
        }
        Body.setVelocity(prop.body,{x:vx,y:vy});
        Body.setAngularVelocity(prop.body,clamp((prop.body.angularVelocity||0)+omega*.48,-.32,.32));
        prop._lastKickAt = now;
      }
    });
  }

  resize();
  ensureTestProps();
  installDartImpacts();
  installPropContactPhysics();
  requestAnimationFrame(tick);
}

const PUPPETALK_SEAT_ORDER = [0,3,1,4,2,5];
const PUPPETALK_DEPTH_X = .28;
const PUPPETALK_FOREGROUND_TUNED_KEYS = new Set(['torso','head','sl','sr','el','er','wl','wr','hl','hr','kl','kr','al','ar']);
const puppetalkPropOwners = new Map();

function puppetalkSeatAngle(slot){
  const seat=PUPPETALK_SEAT_ORDER[slot] ?? slot ?? 0;
  return seat*Math.PI/3;
}
function puppetalkHomeX(slot){ return .16+slot*.135; }
function puppetalkRawPoint(point,center,scale,shift){
  if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
  const safe=Math.max(.0001,scale||1);
  return {...point,x:center.x+(point.x-center.x)/safe,y:center.y+(point.y-shift-center.y)/safe};
}
function puppetalkViewPoint(point,rawCenter,targetCenter,targetScale,targetShift){
  if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;
  return {...point,x:targetCenter.x+(point.x-rawCenter.x)*targetScale,y:rawCenter.y+(point.y-rawCenter.y)*targetScale+targetShift};
}
function puppetalkProjectPuppet(p,viewerSlot){
  if(!p?.torso || !Number.isInteger(p.slot) || !Number.isInteger(viewerSlot)) return {puppet:p,meta:null};
  const depthApi=window.PuppetalkDepthState;
  const tuning=window.PuppetalkForegroundTuning;
  const rawDepth=Number.isFinite(p.depth)?p.depth:0;
  const rawScale=Number.isFinite(p.visualScale)?p.visualScale:(depthApi?.scaleForDepth?.(rawDepth)||1);
  const rawShift=depthApi?.shiftForDepth?.(rawDepth)||0;
  const rawCenter={x:p.torso.x,y:p.torso.y-rawShift};
  let delta=puppetalkSeatAngle(p.slot)-puppetalkSeatAngle(viewerSlot);
  while(delta>Math.PI) delta-=Math.PI*2;
  while(delta< -Math.PI) delta+=Math.PI*2;
  const c=Math.cos(delta),s=Math.sin(delta);
  const localSide=rawCenter.x-puppetalkHomeX(p.slot);
  const localForward=rawDepth*PUPPETALK_DEPTH_X;
  const viewSide=localSide*c+localForward*s;
  const viewForward=localForward*c-localSide*s;
  const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
  const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
  const viewDepth=Math.max(minDepth,Math.min(maxDepth,viewForward/PUPPETALK_DEPTH_X));
  const targetScale=depthApi?.scaleForDepth?.(viewDepth)||1;
  const targetShift=depthApi?.shiftForDepth?.(viewDepth)||0;
  const targetCenter={x:puppetalkHomeX(p.slot)+viewSide,y:rawCenter.y};
  const out={...p,depth:viewDepth,visualScale:targetScale};
  for(const [key,value] of Object.entries(p)){
    if(!value || Array.isArray(value) || typeof value!=='object') continue;
    if(!Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
    // foreground-tuning v36 only projects the original visible points. New seam
    // endpoints/segment centres arrive raw, so do not "undo" a transform they never had.
    const raw=PUPPETALK_FOREGROUND_TUNED_KEYS.has(key)
      ? puppetalkRawPoint(value,rawCenter,rawScale,rawShift)
      : value;
    out[key]=puppetalkViewPoint(raw,rawCenter,targetCenter,targetScale,targetShift);
  }
  return {puppet:out,meta:{slot:p.slot,rawCenter,targetCenter,targetScale,targetShift}};
}
function puppetalkProjectProp(prop,metaBySlot,viewerSlot){
  if(!prop || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return prop;
  if(Number.isFinite(prop.depth) && Number.isInteger(prop.throwerSlot) && !prop.heldBy && !prop.attachedTo && Number.isInteger(viewerSlot)){
    const owner=prop.throwerSlot;
    let delta=puppetalkSeatAngle(owner)-puppetalkSeatAngle(viewerSlot);
    while(delta>Math.PI) delta-=Math.PI*2;
    while(delta< -Math.PI) delta+=Math.PI*2;
    const c=Math.cos(delta),s=Math.sin(delta);
    const localSide=prop.x-puppetalkHomeX(owner);
    const localForward=prop.depth*PUPPETALK_DEPTH_X;
    const viewSide=localSide*c+localForward*s;
    const viewForward=localForward*c-localSide*s;
    const tuning=window.PuppetalkForegroundTuning;
    const minDepth=Number.isFinite(tuning?.minDepth)?tuning.minDepth:-.48;
    const maxDepth=Number.isFinite(tuning?.maxDepth)?tuning.maxDepth:1;
    const viewDepth=Math.max(minDepth,Math.min(maxDepth,viewForward/PUPPETALK_DEPTH_X));
    const depthApi=window.PuppetalkDepthState;
    return {
      ...prop,
      x:puppetalkHomeX(owner)+viewSide,
      y:prop.y+(depthApi?.shiftForDepth?.(viewDepth)||0),
      viewDepth,
      viewScale:depthApi?.scaleForDepth?.(viewDepth)||1
    };
  }
  const explicit=Number.isInteger(prop?.heldBy?.slot)?prop.heldBy.slot:Number.isInteger(prop?.attachedTo?.slot)?prop.attachedTo.slot:null;
  if(Number.isInteger(explicit)) puppetalkPropOwners.set(prop.id,explicit);
  const owner=Number.isInteger(explicit)?explicit:puppetalkPropOwners.get(prop.id);
  const meta=metaBySlot.get(owner);
  if(!meta) return prop;
  const project=q=>puppetalkViewPoint(q,meta.rawCenter,meta.targetCenter,meta.targetScale,meta.targetShift);
  const out={...prop,...project(prop)};
  if(prop.attachedTo?.anchor && Number.isFinite(prop.attachedTo.anchor.x) && Number.isFinite(prop.attachedTo.anchor.y)){
    out.attachedTo={...prop.attachedTo,anchor:project(prop.attachedTo.anchor)};
  }
  return out;
}
function puppetalkSeatProjection(puppets,props,viewerSlot){
  if(!Number.isInteger(viewerSlot)) return {puppets,props};
  const metaBySlot=new Map();
  const projected=(puppets||[]).map(p=>{
    const r=puppetalkProjectPuppet(p,viewerSlot);
    if(r.meta) metaBySlot.set(r.meta.slot,r.meta);
    return r.puppet;
  }).sort((a,b)=>(a.depth||0)-(b.depth||0));
  return {puppets:projected,props:(props||[]).map(prop=>puppetalkProjectProp(prop,metaBySlot,viewerSlot))};
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


      <section class="card character-card" id="character-card">
        <div class="control-title"><span>Character</span><span class="small muted">tap a feature to cycle it</span></div>
        <div class="character-preview" id="character-preview" aria-hidden="true"></div>
        <div class="character-grid">
          <button type="button" data-look="headStyle"><span>Head</span><strong id="look-headStyle">spikes</strong></button>
          <button type="button" data-look="eyes"><span>Eyes</span><strong id="look-eyes">dots</strong></button>
          <button type="button" data-look="nose"><span>Nose</span><strong id="look-nose">curve</strong></button>
          <button type="button" data-look="mouth"><span>Mouth</span><strong id="look-mouth">line</strong></button>
          <button type="button" data-look="extra"><span>Extra</span><strong id="look-extra">none</strong></button>
        </div>
        <div class="character-colors" id="character-colors"></div>
        <button type="button" class="character-random" id="character-random">Random character</button>
      </section>

      <section class="card compact-controls">
        <div class="control-title"><span>Pose</span><span class="small muted">one or two finger grabs</span></div>
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
        <button id="special-item" class="primary" type="button">Special item</button>
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
  let propScene = [];
  let micStop = null;
  let manualTimer = null;
  let centreTimer = null;
  let cw = 1;
  let ch = 1;
  let lastSent = '';
  const activePointers = new Map();
  let reconnectTimer = null;
  let connectGeneration = 0;
  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};
  function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y})); }

  input.look = savedLook();

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

  function controllerSpecialType(){
    const valid = ['frisbee','pump','ball','dart'];
    try{
      const saved = localStorage.getItem('puppetalk-special-item');
      if(valid.includes(saved)) return saved;
    }catch{}
    if(slot === null) return null;
    const fallback = ['frisbee','pump','ball','dart','frisbee','pump'];
    return fallback[Math.max(0,slot)%fallback.length] || 'ball';
  }
  function controllerSpecialLabel(type){
    if(type === 'frisbee') return 'Laser frisbee';
    if(type === 'pump') return 'Balloon pump';
    if(type === 'ball') return 'Ball';
    if(type === 'dart') return 'Sticky darts';
    return 'Item';
  }
  function updateSpecialItemButton(isOut=false){
    const button = document.querySelector('#special-item');
    if(!button) return;
    const type = controllerSpecialType();
    if(!type){ button.textContent='Special item'; button.disabled=true; return; }
    const label = controllerSpecialLabel(type);
    button.disabled=!!isOut;
    button.textContent = isOut ? label+' is out' : 'Bring out '+label;
  }
  function bringOutMySpecialItem(){
    if(!conn?.open || slot === null) return;
    send(conn,{type:'special-item',action:'bring-out',item:controllerSpecialType()});
  }

  function transmit(force=false){
    if(!conn?.open) return;
    const body = JSON.stringify(input);
    if(!force && body === lastSent) return;
    lastSent = body;
    send(conn,{type:'input',input});
  }

  function heldProp(hand){ return propScene.find(prop=>prop?.heldBy?.slot === slot && prop?.heldBy?.hand === hand); }
  function updateGripButtons(){
    const left = document.querySelector('#grip-left');
    const right = document.querySelector('#grip-right');
    if(left) left.textContent = heldProp('left') ? 'Drop L' : 'Grip L';
    if(right) right.textContent = heldProp('right') ? 'Drop R' : 'Grip R';
  }
  function toggleGrip(hand){
    if(!conn?.open || slot === null) return;
    send(conn,{type:'prop',action:'toggleGrip',hand});
  }

  function connect(){
    const generation = ++connectGeneration;
    if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
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
          updateSpecialItemButton(false);
          setStatus(`you are ${savedPlayerName() || NAMES[slot] || msg.name}`,'live');
          youChip.hidden = false;
          hint.textContent = 'Use one or two fingers on any grab point';
          setTimeout(()=>hint.classList.add('quiet'),3000);
          lastSent = '';
          transmit(true);
          send(conn,{type:'look',look:input.look,name:savedPlayerName()});
        }
        if(msg?.type === 'scene'){
          scene = Array.isArray(msg.puppets) ? msg.puppets : [];
          propScene = Array.isArray(msg.props) ? msg.props : [];
          updateGripButtons();
          renderPersonalScene();
        }
        if(msg?.type === 'prop-result'){
          hint.classList.remove('quiet');
          hint.textContent = msg.message || (msg.ok ? 'Prop grip updated.' : 'Could not grip prop.');
          if(msg.ok) setTimeout(()=>hint.classList.add('quiet'),1500);
        }
        if(msg?.type === 'special-item-result'){
          hint.classList.remove('quiet');
          hint.textContent = msg.message || 'Special item updated.';
          if(msg.ok || msg.alreadyOut) updateSpecialItemButton(true);
          setTimeout(()=>hint.classList.add('quiet'),1700);
        }
        if(msg?.type === 'full'){
          setStatus('table is full','bad');
          hint.textContent = 'This table already has six puppeteers.';
        }
      });
      const autoReconnect = ()=>{
        if(generation !== connectGeneration || reconnectTimer) return;
        setStatus('reconnecting…','bad');
        reconnectTimer = setTimeout(()=>{ reconnectTimer=null; connect(); },1200);
      };
      conn.on('close',autoReconnect);
      conn.on('error',autoReconnect);
    });
    peer.on('error',err=>{
      setStatus(err.type === 'peer-unavailable' ? 'table not found' : `network error: ${err.type || 'unknown'}`,'bad');
    });
  }

  function myPuppet(){ return scene.find(p=>p.slot === slot); }
  function grabSpots(p){
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

  function renderGrabHandles(p){
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

  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    const view=puppetalkSeatProjection(scene,propScene,slot);
    view.props.forEach(prop=>drawProp(ctx,prop,cw,ch));
    if(!view.puppets.length) return;
    view.puppets.filter(p=>p.slot !== slot).forEach(p=>drawAnatomy(ctx,p,cw,ch,false,.48));
    const mine = view.puppets.find(p=>p.slot === slot);
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
    const occupied = new Set([...activePointers.values()].map(g=>g.part));
    for(const spot of grabSpots(mine)){
      if(occupied.has(spot.part)) continue;
      const x = spot.q.x*rect.width;
      const y = spot.q.y*rect.height;
      const distance = Math.hypot(px-x,py-y);
      if(distance <= spot.r && (!best || distance < best.distance)) best = {...spot,distance};
    }
    return best;
  }

  function describeActiveGrabs(){
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

  function propDisplayPoint(q){
    return typeof displayPoint === 'function' ? displayPoint(q,cw,ch) : {x:q.x*cw,y:q.y*ch};
  }
  function pickTappedProp(event){
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX-rect.left;
    const py = event.clientY-rect.top;
    let best = null;
    const viewProps=puppetalkSeatProjection(scene,propScene,slot).props;
    for(const prop of viewProps){
      const q = propDisplayPoint(prop);
      const radius = prop.type === 'frisbee' ? 48 : prop.type === 'pump' ? 44 : prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;
      const distance = Math.hypot(px-q.x,py-q.y);
      if(distance <= radius && (!best || distance < best.distance)) best = {prop,distance};
    }
    return best?.prop || null;
  }
  function nearestPropHand(prop){
    const mine = myPuppet();
    if(!mine) return null;
    const q = propDisplayPoint(prop);
    const candidates = [
      {hand:'left',point:mine.wl},
      {hand:'right',point:mine.wr},
      {hand:'leftFoot',point:mine.al},
      {hand:'rightFoot',point:mine.ar}
    ];
    let best = null;
    for(const candidate of candidates){
      if(!candidate.point) continue;
      const p = propDisplayPoint(candidate.point);
      const distance = Math.hypot(p.x-q.x,p.y-q.y);
      if(!best || distance < best.distance) best = {hand:candidate.hand,distance};
    }
    const reach = prop?.type === 'frisbee' ? 118 : 88;
    if(!best || best.distance > reach) return null;
    return best.hand;
  }
  canvas.addEventListener('pointerdown',event=>{
    const prop = pickTappedProp(event);
    if(!prop) return;

    // If this is already our prop, do not consume the pointer event. The normal
    // puppet hit-test underneath will pick the hand at the same location, allowing
    // the player to grab/swing by touching the object itself.
    if(prop.type === 'pump'){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'pump',propId:prop.id});
      return;
    }
    if(prop.type === 'balloon' && prop.attachedTo?.mode === 'pump'){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'release-pump-balloon',propId:prop.id});
      return;
    }
    if(prop.heldBy?.slot === slot) return;

    const hand = nearestPropHand(prop);
    if(!hand) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(conn?.open && slot !== null) send(conn,{type:'prop',action:'tap',propId:prop.id,hand});
  },true);


  function sendLook(){
    input.look=cleanLook(input.look,slot||0);
    saveLook(input.look);
    send(conn,{type:'look',look:input.look,name:savedPlayerName()});
    renderCreator();
  }
  function cycleLook(key){
    const list=LOOK_PARTS[key]; if(!list)return;
    const i=list.indexOf(input.look[key]); input.look[key]=list[(i+1)%list.length]; sendLook();
  }
  function renderCreator(){
    const card=document.querySelector('#character-card'); if(!card)return;
    for(const key of ['headStyle','eyes','nose','mouth','extra']){const el=document.querySelector('#look-'+key);if(el)el.textContent=input.look[key];}
    const colors=document.querySelector('#character-colors');
    if(colors&&!colors.childElementCount){
      LOOK_PALETTE.forEach(color=>{const b=document.createElement('button');b.type='button';b.className='character-swatch';b.dataset.color=color;b.style.setProperty('--swatch',color);b.title=color;b.addEventListener('click',()=>{input.look.color=color;sendLook();});colors.appendChild(b);});
    }
    colors?.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===input.look.color));
    const preview=document.querySelector('#character-preview');
    if(preview){preview.style.setProperty('--puppet-color',input.look.color);preview.dataset.head=input.look.head;preview.dataset.eyes=input.look.eyes;preview.dataset.hair=input.look.hair;preview.dataset.extra=input.look.extra;}
  }
  document.querySelector('#character-card')?.addEventListener('click',event=>{const b=event.target.closest('[data-look]');if(b)cycleLook(b.dataset.look);});
  document.querySelector('#character-random')?.addEventListener('click',()=>{
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    input.look={color:pick(LOOK_PALETTE),headStyle:pick(LOOK_PARTS.headStyle),eyes:pick(LOOK_PARTS.eyes),nose:pick(LOOK_PARTS.nose),mouth:pick(LOOK_PARTS.mouth),extra:pick(LOOK_PARTS.extra)};
    sendLook();
  });
  renderCreator();

  const throwGestures = new Map();
  const THROW_SAMPLE_MS = 145;
  const THROW_MIN_SPEED = .62;
  function sampleThrowGesture(gesture,x,y,now){
    gesture.samples.push({x,y,t:now});
    const cutoff = now-THROW_SAMPLE_MS*1.8;
    while(gesture.samples.length > 2 && gesture.samples[0].t < cutoff) gesture.samples.shift();
    if(gesture.samples.length > 10) gesture.samples.splice(0,gesture.samples.length-10);
  }
  function releaseVector(gesture,x,y,now){
    sampleThrowGesture(gesture,x,y,now);
    const samples = gesture.samples;
    let start = samples[0];
    for(const s of samples){
      if(now-s.t <= THROW_SAMPLE_MS) { start = s; break; }
    }
    const dt = Math.max(.035,(now-start.t)/1000);
    return {vx:(x-start.x)/dt,vy:(y-start.y)/dt};
  }

  canvas.addEventListener('pointerdown',event=>{
    queueMicrotask(()=>{
      const grab = activePointers.get(event.pointerId);
      if(!grab) return;
      const hand = grab.part === 'leftHand' ? 'left'
        : grab.part === 'rightHand' ? 'right'
        : grab.part === 'leftFoot' ? 'leftFoot'
        : grab.part === 'rightFoot' ? 'rightFoot'
        : null;
      if(!hand) return;
      if(!heldProp(hand)) return;
      const now = performance.now();
      throwGestures.set(event.pointerId,{hand,samples:[{x:grab.x,y:grab.y,t:now}]});
    });
  });

  canvas.addEventListener('pointermove',event=>{
    const gesture = throwGestures.get(event.pointerId);
    if(!gesture) return;
    const p = pointerToWorld(event);
    sampleThrowGesture(gesture,p.x,p.y,performance.now());
  });

  function finishThrow(event){
    const gesture = throwGestures.get(event.pointerId);
    if(!gesture) return;
    throwGestures.delete(event.pointerId);
    if(!heldProp(gesture.hand) || !conn?.open || slot === null) return;
    const p = pointerToWorld(event);
    const v = releaseVector(gesture,p.x,p.y,performance.now());
    const speed = Math.hypot(v.vx,v.vy);
    if(speed < THROW_MIN_SPEED) return;
    send(conn,{type:'prop',action:'throw',hand:gesture.hand,vx:v.vx,vy:v.vy});
  }
  canvas.addEventListener('pointerup',finishThrow);
  canvas.addEventListener('pointercancel',event=>throwGestures.delete(event.pointerId));

  document.querySelector('#poses').addEventListener('click',event=>{
    const button = event.target.closest('button');
    if(!button) return;
    if(button.dataset.pose){
      input.pose = button.dataset.pose;
      input.poseVersion = (input.poseVersion || 0)+1;
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
  document.querySelector('#retry').addEventListener('click',connect);
  document.querySelector('#special-item')?.addEventListener('click',bringOutMySpecialItem);
  updateSpecialItemButton(false);
  document.querySelector('#grip-left')?.addEventListener('click',()=>toggleGrip('left'));
  document.querySelector('#grip-right')?.addEventListener('click',()=>toggleGrip('right'));

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


const PUPPETALK_LIVE_HEAD_STYLES=['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];
const PUPPETALK_LIVE_EYES={
  closed:[{d:'M6 5q6 5 13 0m24 0q7 5 13 0',w:4.2}],
  dots:[{d:'M12 6h.01M50 6h.01',w:7}],
  happy:[{d:'M6 7q6-6 13 0m24 0q7-6 13 0',w:4.2}],
  mismatch:[{d:'M6 5q6 5 13 0m24 1q7 1.5 13 0',w:4.2}],
  sleepy:[{d:'M6 6q7 1.5 13 0m24 0q7 1.5 13 0',w:4.2}],
  unevenDots:[{d:'M12 4.5h.01M50 7.5h.01',w:7}],
  wink:[{d:'M6 5q6 5 13 0',w:4.2},{d:'M50 6h.01',w:7}],
  winkRight:[{d:'M12 6h.01',w:7},{d:'M43 5q7 5 13 0',w:4.2}]
};
const PUPPETALK_LIVE_NOSES={
  angular:'M13 6 7 26l8 2.5',bow:'M13 5c-5.5 8-8 16-6 24',
  curve:'M12 6c-2.5 8-7 15-6 22q.5 5 6 4',hook:'M13 5 5.5 27q-1 6.5 5.5 5.5',
  long:'M15 3 4 30q-1.5 5.5 6 5',slant:'M13 5 6 29'
};
const PUPPETALK_LIVE_MOUTHS={
  frown:{d:'M7 11q15-6.5 29-1',open:11},line:{d:'m8 10 28-2',open:12},
  pleased:{d:'M4 9q16 7 30-1l7-5',open:13},shy:{d:'M15 9.5q8 4 16-1',open:9},
  smile:{d:'M3 9q19 10 38-3',open:14},smirk:{d:'M9 10q14 4 26-4',open:12},
  soft:{d:'M6 9q16 6 32-2',open:12},wavy:{d:'M6 10q7-4 14 0 8 4.5 18-2',open:12}
};
const PUPPETALK_LIVE_EYE_NAMES=Object.keys(PUPPETALK_LIVE_EYES);
const PUPPETALK_LIVE_NOSE_NAMES=Object.keys(PUPPETALK_LIVE_NOSES);
const PUPPETALK_LIVE_MOUTH_NAMES=Object.keys(PUPPETALK_LIVE_MOUTHS);
const PUPPETALK_LIVE_EXTRAS=['none','glasses','moustache','freckles','eyepatch'];
const PUPPETALK_LIVE_MOUTH_CACHE=new Map();
function puppetalkLegacyHeadStyle(head,hair){
  if(hair==='tuft')return'tufts';if(hair==='wave')return'swept';if(hair==='mop')return'scallop';
  if(hair==='cap')return'fringe';if(hair==='crop')return'spikes';if(head==='long')return'tallSpikes';
  if(head==='wide')return'burst';return'smooth';
}
function puppetalkLiveHeadPath(ctx,style,r){
  const p=(x,y)=>[x*r,y*r];ctx.beginPath();
  if(style==='spikes'){
    ctx.moveTo(...p(-.82,.58));ctx.bezierCurveTo(...p(-1.02,.12),...p(-.96,-.32),...p(-.72,-.58));
    [[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(1,-.28),...p(1.02,.24),...p(.82,.58));ctx.bezierCurveTo(...p(.62,.96),...p(.28,1.05),...p(0,1.03));ctx.bezierCurveTo(...p(-.3,1.05),...p(-.62,.96),...p(-.82,.58));
  }else if(style==='tallSpikes'){
    ctx.moveTo(...p(-.78,.62));ctx.bezierCurveTo(...p(-1,.12),...p(-.93,-.28),...p(-.68,-.48));
    [[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.98,-.24),...p(1,.26),...p(.78,.62));ctx.bezierCurveTo(...p(.58,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.58,.98),...p(-.78,.62));
  }else if(style==='burst'){
    ctx.moveTo(...p(-.76,.68));[[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));
  }else if(style==='scallop'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1,.18),...p(-.98,-.24),...p(-.72,-.48));
    ctx.quadraticCurveTo(...p(-.62,-.88),...p(-.35,-.72));ctx.quadraticCurveTo(...p(-.22,-1.05),...p(.02,-.76));ctx.quadraticCurveTo(...p(.20,-1.05),...p(.39,-.72));ctx.quadraticCurveTo(...p(.63,-.93),...p(.76,-.48));
    ctx.bezierCurveTo(...p(1,-.22),...p(1,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.62));
  }else if(style==='tufts'){
    ctx.moveTo(...p(-.83,.62));ctx.bezierCurveTo(...p(-1,.18),...p(-.97,-.30),...p(-.67,-.55));ctx.quadraticCurveTo(...p(-.56,-1.03),...p(-.25,-.68));ctx.quadraticCurveTo(...p(-.05,-1.18),...p(.15,-.68));ctx.quadraticCurveTo(...p(.48,-1.08),...p(.68,-.52));ctx.bezierCurveTo(...p(.98,-.28),...p(1,.24),...p(.83,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.83,.62));
  }else if(style==='swept'){
    ctx.moveTo(...p(-.84,.60));ctx.bezierCurveTo(...p(-1,.12),...p(-.94,-.30),...p(-.64,-.55));ctx.bezierCurveTo(...p(-.36,-.90),...p(.03,-.72),...p(.25,-1.18));ctx.bezierCurveTo(...p(.32,-.82),...p(.69,-.98),...p(.68,-.55));ctx.bezierCurveTo(...p(.99,-.30),...p(1.01,.25),...p(.84,.60));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.60));
  }else if(style==='fringe'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1,.20),...p(-.98,-.24),...p(-.74,-.50));[[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50]].forEach(q=>ctx.lineTo(...p(...q)));ctx.bezierCurveTo(...p(1,-.25),...p(1,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.62));
  }else ctx.arc(0,0,r,0,Math.PI*2);ctx.closePath();
}
function puppetalkDrawLiveEyes(ctx,name,hr){
  const parts=PUPPETALK_LIVE_EYES[name]||PUPPETALK_LIVE_EYES.dots,s=hr*2/100;
  ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineCap='round';ctx.lineJoin='round';
  for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}ctx.restore();
}
function puppetalkDrawLiveNose(ctx,name,hr){
  const d=PUPPETALK_LIVE_NOSES[name]||PUPPETALK_LIVE_NOSES.curve,s=hr*2/100;
  ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(d));ctx.restore();
}
function puppetalkLiveMouthSamples(name){
  name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';if(PUPPETALK_LIVE_MOUTH_CACHE.has(name))return PUPPETALK_LIVE_MOUTH_CACHE.get(name);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',PUPPETALK_LIVE_MOUTHS[name].d);const len=path.getTotalLength(),pts=[];
  for(let i=0;i<=36;i++){const t=i/36,q=path.getPointAtLength(len*t);pts.push({x:q.x,y:q.y,t});}PUPPETALK_LIVE_MOUTH_CACHE.set(name,pts);return pts;
}
function puppetalkDrawLiveMouth(ctx,name,state,hr){
  name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';const def=PUPPETALK_LIVE_MOUTHS[name],pts=puppetalkLiveMouthSamples(name),s=hr*2/100,sv=Number.isFinite(state)?Math.max(0,Math.min(2,state)):0;
  ctx.save();ctx.translate(-20*s,13*s);ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
  if(sv<=0){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle='#08090a';ctx.lineWidth=4.6;ctx.stroke();}
  else{const amount=def.open*(sv===1?.38:1),up=[],lo=[];for(const p of pts){const taper=Math.pow(Math.sin(Math.PI*p.t),.68),spread=amount*taper;up.push({x:p.x,y:p.y-spread*.30});lo.push({x:p.x,y:p.y+spread*.72});}ctx.beginPath();ctx.moveTo(up[0].x,up[0].y);for(let i=1;i<up.length;i++)ctx.lineTo(up[i].x,up[i].y);for(let i=lo.length-1;i>=0;i--)ctx.lineTo(lo[i].x,lo[i].y);ctx.closePath();ctx.fillStyle='#08090a';ctx.fill();}
  ctx.restore();
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

  const severed = new Set(Array.isArray(p.severed)?p.severed:[]);
  const broken = new Set(Array.isArray(p.brokenSeams)?p.brokenSeams:[]);
  const splitChain = (start,a,b,end,seam,color,width)=>{
    if(broken.has(seam)){ chain([start,a],color,width); chain([b,end],color,width); }
    else chain([start,end],color,width);
  };
  splitChain(severed.has('leftHip')?p.thLt:p.hl,p.thLmA,p.thLmB,p.kl,'leftThigh',p.color,13.5);
  splitChain(severed.has('leftKnee')?p.shLt:p.kl,p.shLmA,p.shLmB,p.al,'leftShin',p.color,13.5);
  splitChain(severed.has('rightHip')?p.thRt:p.hr,p.thRmA,p.thRmB,p.kr,'rightThigh',p.color,13.5);
  splitChain(severed.has('rightKnee')?p.shRt:p.kr,p.shRmA,p.shRmB,p.ar,'rightShin',p.color,13.5);
  splitChain(severed.has('leftShoulder')?p.uaLt:p.sl,p.uaLmA,p.uaLmB,p.el,'leftUpperArm',p.color,12);
  splitChain(severed.has('leftElbow')?p.faLt:p.el,p.faLmA,p.faLmB,p.wl,'leftForearm',p.color,12);
  splitChain(severed.has('rightShoulder')?p.uaRt:p.sr,p.uaRmA,p.uaRmB,p.er,'rightUpperArm',p.color,12);
  splitChain(severed.has('rightElbow')?p.faRt:p.er,p.faRmA,p.faRmB,p.wr,'rightForearm',p.color,12);

  const drawSegmentRect = (q,pw,ph,radius)=>{
    if(!q) return;
    const x=q.x*w,y=q.y*h,sw=Math.max(8,pw*scale),sh=Math.max(8,ph*scale);
    ctx.save();ctx.translate(x,y);ctx.rotate(q.a||0);
    ctx.fillStyle='#08090a';roundRect(ctx,-sw/2-3,-sh/2-3,sw+6,sh+6,Math.max(4,radius*scale));ctx.fill();
    ctx.fillStyle=p.color;roundRect(ctx,-sw/2,-sh/2,sw,sh,Math.max(3,(radius-2)*scale));ctx.fill();ctx.restore();
  };
  const torsoSplit = broken.has('torsoUpper') || broken.has('torsoLower');
  if(torsoSplit){
    drawSegmentRect(p.segTorsoTop,40,26,7);
    drawSegmentRect(p.torso,40,26,7);
    drawSegmentRect(p.segTorsoBottom,40,26,7);
  }else{
    const tx = p.torso.x*w;
    const ty = p.torso.y*h;
    ctx.save();
    ctx.translate(tx,ty);
    ctx.rotate(p.torso.a || 0);
    const tw = Math.max(18,40*scale);
    const th = Math.max(34,78*scale);
    ctx.fillStyle = '#08090a';
    roundRect(ctx,-tw/2-3,-th/2-3,tw+6,th+6,Math.max(7,13*scale));
    ctx.fill();
    ctx.fillStyle = p.color;
    roundRect(ctx,-tw/2,-th/2,tw,th,Math.max(6,11*scale));
    ctx.fill();
    ctx.restore();
  }

  if(broken.has('headMiddle')){
    drawSegmentRect(p.segHeadLower,40,24,10);
    drawSegmentRect(p.segHeadTop,40,24,10);
    ctx.restore();
    return;
  }

  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(12,23.5*scale);
  const look = cleanLook(p.look,p.slot||0);
  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a || 0);
  puppetalkLiveHeadPath(ctx,look.headStyle,hr);
  ctx.fillStyle=look.color;ctx.fill();
  ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(3,hr*.12);ctx.lineJoin='round';ctx.stroke();
  puppetalkDrawLiveEyes(ctx,look.eyes,hr);
  puppetalkDrawLiveNose(ctx,look.nose,hr);
  const eyeY=-17*(hr*2/100)+6*(hr*2/100),ex=hr*.31;
  ctx.strokeStyle=ctx.fillStyle='#08090a';ctx.lineCap='round';
  if(look.extra==='glasses'){ctx.lineWidth=Math.max(1.3,hr*.055);for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke();}
  if(look.extra==='eyepatch'){ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(1.5,hr*.06);ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();}
  if(look.extra==='freckles'){for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.10+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}}
  puppetalkDrawLiveMouth(ctx,look.mouth,p.mouth,hr);
  if(look.extra==='moustache'){ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();

  ctx.font = `${highlight?'700':'600'} ${Math.max(10,12*scale)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = highlight ? '#fff' : 'rgba(255,255,255,.78)';
  ctx.fillText(highlight ? `${p.name} · YOU` : p.name,hx,hy-hr-12);
  ctx.restore();
}

function drawProp(ctx,p,w,h){
  if(!p) return;
  const projected = typeof displayPoint === 'function' ? displayPoint({x:p.x,y:p.y},w,h) : {x:p.x*w,y:p.y*h};
  const scale = typeof projectionRenderScale === 'function' ? projectionRenderScale(w,h) : Math.min(w/900,h/650);
  const x = projected.x;
  const y = projected.y;
  const s = Math.max(.72,scale*1.9)*(Number.isFinite(p.viewScale)?p.viewScale:1);
  if(p.type === 'balloon' && p.attachedTo?.mode === 'balloon' && p.attachedTo.anchor){
    const anchor = typeof displayPoint === 'function' ? displayPoint(p.attachedTo.anchor,w,h) : {x:p.attachedTo.anchor.x*w,y:p.attachedTo.anchor.y*h};
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,.48)';
    ctx.lineWidth=Math.max(1,s);
    ctx.beginPath();
    ctx.moveTo(x,y+15*s*Math.max(.22,p.scale||1));
    ctx.quadraticCurveTo((x+anchor.x)*.5+7*s,(y+anchor.y)*.5,anchor.x,anchor.y);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(p.a || 0);
  if(p.type === 'balloon') ctx.scale(Math.max(.22,p.scale||1),Math.max(.22,p.scale||1));
  ctx.lineCap = ctx.lineJoin = 'round';
  if(p.type === 'ball'){
    ctx.fillStyle = '#08090a';
    ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#f1c84c';
    ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,.55)';ctx.lineWidth = Math.max(1,1.5*s);
    ctx.beginPath();ctx.arc(0,0,8*s,-1.1,1.1);ctx.stroke();
  }else if(p.type === 'balloon'){
    if(!p.attachedTo?.anchor){
      ctx.strokeStyle = 'rgba(255,255,255,.45)';ctx.lineWidth = Math.max(1,s);
      ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();
    }
    ctx.fillStyle = '#08090a';ctx.beginPath();ctx.ellipse(0,0,16*s,20*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.ellipse(0,0,13*s,17*s,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(-3*s,16*s);ctx.lineTo(3*s,16*s);ctx.lineTo(0,22*s);ctx.closePath();ctx.fill();
  }else if(p.type === 'pump'){
    ctx.fillStyle='#08090a';roundRect(ctx,-25*s,-33*s,50*s,66*s,7*s);ctx.fill();
    ctx.fillStyle='#d9dde2';roundRect(ctx,-20*s,-28*s,40*s,56*s,5*s);ctx.fill();
    ctx.fillStyle='#181a1e';roundRect(ctx,-12*s,-24*s,24*s,34*s,4*s);ctx.fill();
    ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(0,-30*s);ctx.lineTo(0,-49*s);ctx.stroke();
    ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-18*s,-50*s);ctx.lineTo(18*s,-50*s);ctx.stroke();
    ctx.strokeStyle='#f1c84c';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-15*s,-50*s);ctx.lineTo(15*s,-50*s);ctx.stroke();
    ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(2,3*s);ctx.beginPath();ctx.moveTo(20*s,-18*s);ctx.lineTo(31*s,-29*s);ctx.stroke();
  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d7dce2';ctx.beginPath();ctx.arc(0,0,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111317';ctx.beginPath();ctx.arc(0,0,11*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.armed?'#ff4b5c':'rgba(255,255,255,.46)';
    ctx.lineWidth=Math.max(2,2.7*s);ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=p.armed?'#ff7b86':'rgba(20,20,20,.62)';ctx.lineWidth=Math.max(1,1.3*s);
    ctx.beginPath();ctx.moveTo(-15*s,0);ctx.lineTo(15*s,0);ctx.stroke();
  }else{
    ctx.strokeStyle = '#08090a';ctx.lineWidth = Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();
    ctx.strokeStyle = '#e9edf2';ctx.lineWidth = Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(17*s,0);ctx.stroke();
    ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.moveTo(22*s,0);ctx.lineTo(13*s,-5*s);ctx.lineTo(13*s,5*s);ctx.closePath();ctx.fill();
  }
  if(p.heldBy){
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.stroke();
  }
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

})();
