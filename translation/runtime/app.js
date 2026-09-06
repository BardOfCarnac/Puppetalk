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

const seatProjection = window.PuppetalkSeatProjection?.create?.({
  getDepthState:()=>window.PuppetalkDepthState,
  getForegroundTuning:()=>window.PuppetalkForegroundTuning
});
if(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');
const {puppetalkSeatProjection} = seatProjection;

const {incompleteInviteShell,stageShell,controllerShell} = window.PuppetalkViewShells || {};
if(!incompleteInviteShell || !stageShell || !controllerShell){
  throw new Error('Puppetalk view shells failed to load.');
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

  app.innerHTML = stageShell(room,joinUrl.href);

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

  const stageLifecycle = window.PuppetalkStageLifecycle?.create?.({
    canvas,ctx,Bodies,Composite,engine,
    getBounds:()=>bounds,setBounds:value=>{ bounds=value; },
    setDimensions:(width,height)=>{ W=width; H=height; },
    ensureTestProps,installDartImpacts,installPropContactPhysics,tick,
    getViewport:()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio || 1}),
    addEventListenerFn:(type,handler,opts)=>addEventListener(type,handler,opts),
    requestFrame:callback=>requestAnimationFrame(callback)
  });
  if(!stageLifecycle) throw new Error('Puppetalk stage lifecycle failed to load.');
  stageLifecycle.start();
}

function startController(room){
  if(!window.Peer){
    app.textContent = 'Puppetalk network library failed to load.';
    return;
  }
  if(!room){
    app.innerHTML = incompleteInviteShell();
    return;
  }

  app.innerHTML = controllerShell(room,POSES);

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
