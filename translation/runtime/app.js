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

const sceneRenderer = window.PuppetalkSceneRenderer?.create?.({
  cleanLook,document,
  Path2DClass:typeof Path2D === 'function' ? Path2D : null,
  getDisplayPoint:()=>typeof displayPoint === 'function' ? displayPoint : null,
  getProjectionRenderScale:()=>typeof projectionRenderScale === 'function' ? projectionRenderScale : null
});
if(!sceneRenderer) throw new Error('Puppetalk scene renderer failed to load.');
const {drawBackdrop,drawAnatomy,drawProp,roundRect} = sceneRenderer;

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

const seatProjection = window.PuppetalkSeatProjection?.create?.({
  getDepthState:()=>window.PuppetalkDepthState,
  getForegroundTuning:()=>window.PuppetalkForegroundTuning
});
if(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');
const {puppetalkSeatProjection} = seatProjection;

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

  let centreTimer = null;
  let cw = 1;
  let ch = 1;
  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};

  input.look = savedLook();

  const controllerSession = window.PuppetalkControllerSession?.create?.({
    Peer,room,peerId,NAMES,input,send,savedPlayerName,hint,youChip,status,dot,
    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),
    clearTimeoutFn:id=>clearTimeout(id)
  });
  if(!controllerSession) throw new Error('Puppetalk controller session failed to load.');
  const {setStatus,transmit,connect,getConn,getSlot,getScene,getPropScene} = controllerSession;

  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({
    canvas,ctx,hint,input,clamp,
    getScene,getPropScene,getSlot,getDimensions:()=>({cw,ch}),
    drawBackdrop,seatProjection:puppetalkSeatProjection,drawProp,drawAnatomy,transmit,
    cancelCentre:()=>{ if(centreTimer){ clearTimeout(centreTimer); centreTimer = null; } }
  });
  if(!puppetInteraction) throw new Error('Puppetalk direct puppet interaction failed to load.');
  const {
    activePointers,myPuppet,grabSpots,renderGrabHandles,renderPersonalScene,
    pointerToWorld,pickGrab,describeActiveGrabs
  } = puppetInteraction;

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
    getConn,getSlot,getPropScene,getScene,
    getDimensions:()=>({cw,ch}),getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),
    seatProjection:puppetalkSeatProjection,
    displayPoint:typeof displayPoint === 'function' ? displayPoint : null,
    storage:localStorage
  });
  if(!itemInteraction) throw new Error('Puppetalk controller item interactions failed to load.');
  const {
    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand
  } = itemInteraction;
  controllerSession.setHooks({updateSpecialItemButton,updateGripButtons,renderPersonalScene});

  puppetInteraction.install();

  itemInteraction.installPropTap();

  const characterCreator = window.PuppetalkCharacterCreator?.create?.({
    document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,
    getConn,getSlot,savedPlayerName,random:()=>Math.random()
  });
  if(!characterCreator) throw new Error('Puppetalk character creator controller failed to load.');
  characterCreator.install();

  const controllerThrowGesture = window.PuppetalkControllerThrowGesture?.create?.({
    canvas,activePointers,heldProp,pointerToWorld,
    getConn,getSlot,send,
    now:()=>performance.now(),queueTask:callback=>queueMicrotask(callback)
  });
  if(!controllerThrowGesture) throw new Error('Puppetalk controller throw gesture failed to load.');
  controllerThrowGesture.install();

  const commandPanel = window.PuppetalkControllerCommands?.create?.({
    document,input,activePointers,transmit,connect,
    getCentreTimer:()=>centreTimer,setCentreTimer:value=>{ centreTimer=value; },
    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),
    clearTimeoutFn:id=>clearTimeout(id)
  });
  if(!commandPanel) throw new Error('Puppetalk controller command panel failed to load.');
  commandPanel.install();

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

})();
