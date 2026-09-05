(function(){
const app = document.querySelector('#app');
const qs = new URLSearchParams(location.search);
const mode = qs.get('mode') === 'controller' ? 'controller' : 'stage';
const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

const COLORS = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8'];
const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];

const {LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook} = window.PuppetalkLookModel || {};
if(!LOOK_PALETTE || !LOOK_PARTS || !defaultLook || !cleanLook){
  throw new Error('Puppetalk look model failed to load.');
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
  const grabGeometry = window.PuppetalkGrabGeometry?.create?.(Vector);
  if(!grabGeometry) throw new Error('Puppetalk grab geometry failed to load.');
  const {worldPoint,grabBody,grabWorldPoint} = grabGeometry;
  const driveForces = window.PuppetalkDriveForces?.create?.({Body,clamp,angleDelta});
  if(!driveForces) throw new Error('Puppetalk drive forces failed to load.');
  const {servo,springPull} = driveForces;
  const recoveryGeometry = window.PuppetalkRecoveryGeometry?.create?.(Vector);
  if(!recoveryGeometry) throw new Error('Puppetalk recovery geometry failed to load.');
  const {jointWorldPoint,jointGap,jointCutPoint,seamCutPoint} = recoveryGeometry;
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
  const rigFactory = window.PuppetalkRigFactory?.create?.({
    Bodies,Body,Composite,Constraint,engine,puppets,
    getDimensions:()=>({W,H}),NAMES,COLORS,defaultLook
  });
  if(!rigFactory) throw new Error('Puppetalk rig factory failed to load.');
  const {makePuppet} = rigFactory;
  const recoverySystem = window.PuppetalkRecoverySystem?.create?.({
    Composite,Body,engine,makePuppet,jointGap,jointWorldPoint,angleDelta,clamp
  });
  if(!recoverySystem) throw new Error('Puppetalk recovery system failed to load.');
  const {severJoint,repairSeveredJoints,handleJointRecovery,severSeam,repairBrokenSeams} = recoverySystem;
  const sceneState = window.PuppetalkCharacterSceneState?.create?.({
    getDimensions:()=>({W,H}),worldPoint,cleanLook
  });
  if(!sceneState) throw new Error('Puppetalk character scene state failed to load.');
  const {anatomy} = sceneState;
  const inputSystem = window.PuppetalkCharacterInputSystem?.create?.({makePuppet,GRAB_PARTS,POSES,clamp});
  if(!inputSystem) throw new Error('Puppetalk character input system failed to load.');
  const {applyInput} = inputSystem;
  const puppetDriver = window.PuppetalkPuppetDriver?.create?.({
    getDimensions:()=>({W,H}),now:()=>performance.now(),POSES,
    ensureRig,resetPins,antiTangleTarget,rootFollow,
    grabBody,grabWorldPoint,springPull,servo,clamp
  });
  if(!puppetDriver) throw new Error('Puppetalk puppet driver failed to load.');
  const {drivePuppet} = puppetDriver;

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
  const specialItems = new Map();
  const propFactory = window.PuppetalkPropFactory?.create?.({
    Bodies,Composite,engine,props,getDimensions:()=>({W,H})
  });
  if(!propFactory) throw new Error('Puppetalk prop factory failed to load.');
  const {makeProp,ensureTestProps,ensureLegacyTestProps} = propFactory;
  const propGeometry = window.PuppetalkPropGeometry?.create?.({puppets,props,grabWorldPoint,clamp,Vector});
  if(!propGeometry) throw new Error('Puppetalk prop geometry failed to load.');
  const {handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset} = propGeometry;
  const propStateSystem = window.PuppetalkPropState?.create?.({
    getDimensions:()=>({W,H}),worldOffset,clamp
  });
  if(!propStateSystem) throw new Error('Puppetalk prop state failed to load.');
  const {balloonAttachmentState,propState} = propStateSystem;
  const propGripCore = window.PuppetalkPropGripCore?.create?.({
    propGrips,gripKey,
    Composite,engine,puppets,handBody,propGripLocalPoint,Constraint
  });
  if(!propGripCore) throw new Error('Puppetalk prop grip core failed to load.');
  const {gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest} = propGripCore;
  const balloonPops = window.PuppetalkBalloonPops?.create?.({
    props,cancelPropContest,releasePropHolder,Composite,engine,Vector,clamp,Body
  });
  if(!balloonPops) throw new Error('Puppetalk balloon pops failed to load.');
  const {distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops} = balloonPops;
  const propAttachmentCore = window.PuppetalkPropAttachmentCore?.create?.({
    Body,performance,cancelPropContest,releasePropHolder,localOffset,worldOffset
  });
  if(!propAttachmentCore) throw new Error('Puppetalk prop attachment core failed to load.');
  const {attachPropToBody,detachPropAttachment,syncAttachedProp} = propAttachmentCore;
  const balloonLift = window.PuppetalkBalloonLift?.create?.({
    props,puppets,cancelPropContest,releasePropHolder,localOffset,worldOffset,
    Body,syncAttachedProp,clamp
  });
  if(!balloonLift) throw new Error('Puppetalk balloon lift failed to load.');
  const {tieBalloonToBody,driveAttachedBalloon} = balloonLift;
  const propDriver = window.PuppetalkPropDriver?.create?.({
    props,propGrips,gripKey,cancelPropContest,promotePropContest,clamp,
    Body,engine,driveAttachedBalloon,syncAttachedProp,driveDartBalloonPops,
    now:()=>performance.now()
  });
  if(!propDriver) throw new Error('Puppetalk prop driver failed to load.');
  const {updatePropContest,driveProps} = propDriver;
  const depthAssist = window.PuppetalkDepthAssist?.create?.({
    props,puppets,clamp,Body,getDimensions:()=>({W,H}),
    getDepthState:()=>window.PuppetalkDepthState,
    getForegroundTuning:()=>window.PuppetalkForegroundTuning
  });
  if(!depthAssist) throw new Error('Puppetalk depth assist failed to load.');
  const {puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,driveDepthAssistedProps} = depthAssist;
  const laserFrisbee = window.PuppetalkLaserFrisbee?.create?.({
    props,puppets,clamp,puppetalkAimProjectPropPoint,puppetalkAimProjectPoint,
    jointCutPoint,seamCutPoint,severSeam,severJoint,Body
  });
  if(!laserFrisbee) throw new Error('Puppetalk laser frisbee failed to load.');
  const {pointSegmentDistance,driveLaserFrisbeeCuts} = laserFrisbee;
  const pumpBalloonSystem = window.PuppetalkPumpBalloon?.create?.({
    props,makeProp,worldOffset,Body,syncAttachedProp,detachPropAttachment,
    now:()=>performance.now(),random:()=>Math.random()
  });
  if(!pumpBalloonSystem) throw new Error('Puppetalk pump balloon lifecycle failed to load.');
  const {pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon} = pumpBalloonSystem;
  const propInputSystem = window.PuppetalkPropInput?.create?.({
    props,conns,puppets,send,validPropEffector,handPoint,freePropHand,detachPropAttachment,beginPropHold,
    nearestBalloonTarget,tieBalloonToBody,cancelPropContest,promotePropContest,beginPropContest,
    releasePropHolder,gripRecord,handBody,clamp,Body,inflatePumpBalloon,releasePumpBalloon,
    getDimensions:()=>({W,H}),now:()=>performance.now(),
    getDepthForSlot:slot=>window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0,
    projectPropPoint:puppetalkAimProjectPropPoint
  });
  if(!propInputSystem) throw new Error('Puppetalk prop input failed to load.');
  const {propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput} = propInputSystem;
  const specialItemSystem = window.PuppetalkSpecialItems?.create?.({
    specialItems,props,puppets,conns,send,makeProp,grabWorldPoint,clamp,
    getDimensions:()=>({W,H})
  });
  if(!specialItemSystem) throw new Error('Puppetalk special items failed to load.');
  const {specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput} = specialItemSystem;
  const puppetLifecycle = window.PuppetalkPuppetLifecycle?.create?.({
    puppets,props,releaseAllPropGrips,detachPropAttachment,Composite,engine
  });
  if(!puppetLifecycle) throw new Error('Puppetalk puppet lifecycle failed to load.');
  const {removePuppet} = puppetLifecycle;
  const stageLoop = window.PuppetalkStageLoop?.create?.({
    getDimensions:()=>({W,H}),ctx,props,puppets,conns,
    drawBackdrop,drawProp,propState,drawAnatomy,anatomy,send,
    getLastSceneSent:()=>lastSceneSent,
    setLastSceneSent:value=>{ lastSceneSent=value; },
    getLast:()=>last,
    setLast:value=>{ last=value; },
    clamp,
    drivePuppet,repairBrokenSeams,repairSeveredJoints,driveProps,
    Engine,engine,driveDepthAssistedProps,driveLaserFrisbeeCuts,
    requestFrame:callback=>requestAnimationFrame(callback)
  });
  if(!stageLoop) throw new Error('Puppetalk stage loop failed to load.');
  const {drawStage,broadcastScene,tick} = stageLoop;

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

  const hostSession = window.PuppetalkHostSession?.create?.({
    Peer,room,peerId,status,conns,puppets,props,NAMES,
    makePuppet,send,anatomy,propState,
    applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
    cleanLook,cleanPlayerName,removePuppet,
    setTimer:(callback,ms)=>setTimeout(callback,ms),
    logError:error=>console.error(error)
  });
  if(!hostSession) throw new Error('Puppetalk host session failed to load.');
  const {peer,updateStatus,freeSlot} = hostSession;

  addEventListener('resize',resize,{passive:true});
  const dartImpacts = window.PuppetalkDartImpacts?.create?.({
    Matter,engine,propForBody,puppetPartForBody,attachPropToBody
  });
  if(!dartImpacts) throw new Error('Puppetalk dart impacts failed to load.');
  const {installDartImpacts} = dartImpacts;
  const propContactPhysics = window.PuppetalkPropContactPhysics?.create?.({
    Matter,engine,propForBody,puppetPartForBody,puppets,handBody,
    closestPointOnBody,tieBalloonToBody,performance,Vector,Body,clamp
  });
  if(!propContactPhysics) throw new Error('Puppetalk prop contact physics failed to load.');
  const {installPropContactPhysics} = propContactPhysics;

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

  const itemInteraction = window.PuppetalkControllerItems?.create?.({
    document,canvas,send,
    getConn:()=>conn,getSlot:()=>slot,getPropScene:()=>propScene,getScene:()=>scene,
    getDimensions:()=>({cw,ch}),getMyPuppet:()=>scene.find(p=>p.slot === slot),
    seatProjection:puppetalkSeatProjection,
    displayPoint:typeof displayPoint === 'function' ? displayPoint : null,
    storage:localStorage
  });
  if(!itemInteraction) throw new Error('Puppetalk controller item interactions failed to load.');
  const {
    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand
  } = itemInteraction;

  function transmit(force=false){
    if(!conn?.open) return;
    const body = JSON.stringify(input);
    if(!force && body === lastSent) return;
    lastSent = body;
    send(conn,{type:'input',input});
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

  itemInteraction.installPropTap();

  const characterCreator = window.PuppetalkCharacterCreator?.create?.({
    document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,
    getConn:()=>conn,getSlot:()=>slot,savedPlayerName,random:()=>Math.random()
  });
  if(!characterCreator) throw new Error('Puppetalk character creator controller failed to load.');
  characterCreator.install();

  const controllerThrowGesture = window.PuppetalkControllerThrowGesture?.create?.({
    canvas,activePointers,heldProp,pointerToWorld,
    getConn:()=>conn,getSlot:()=>slot,send,
    now:()=>performance.now(),queueTask:callback=>queueMicrotask(callback)
  });
  if(!controllerThrowGesture) throw new Error('Puppetalk controller throw gesture failed to load.');
  controllerThrowGesture.install();

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
  itemInteraction.installButtons();
  updateSpecialItemButton(false);

  const controllerAudio = window.PuppetalkControllerAudio?.create?.({
    micButton,level,talkButton,input,transmit,setStatus,clamp,
    getUserMedia:constraints=>navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext:()=>new AudioContext(),
    requestFrame:callback=>requestAnimationFrame(callback),
    cancelFrame:id=>cancelAnimationFrame(id),
    setTimer:(callback,ms)=>setInterval(callback,ms),
    clearTimer:id=>clearInterval(id)
  });
  if(!controllerAudio) throw new Error('Puppetalk controller audio failed to load.');
  controllerAudio.install();

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
