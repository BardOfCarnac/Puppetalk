(function(){
const app = document.querySelector('#app');
const runtimeRoute = window.PuppetalkRuntimeRoute?.create?.({URLSearchParamsClass:URLSearchParams});
if(!runtimeRoute) throw new Error('Puppetalk runtime route failed to load.');
const {mode,room} = runtimeRoute.parse(location.search);
const {COLORS,NAMES} = window.PuppetalkRuntimeConfig || {};
if(!COLORS || !NAMES) throw new Error('Puppetalk runtime config failed to load.');

const {LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook} = window.PuppetalkLookModel || {};
if(!LOOK_PALETTE || !LOOK_PARTS || !defaultLook || !cleanLook){
  throw new Error('Puppetalk look model failed to load.');
}

const runtimeHelpers = window.PuppetalkRuntimeHelpers?.create?.({
  cleanLook,defaultLook,getStorage:()=>localStorage,random:()=>Math.random()
});
if(!runtimeHelpers) throw new Error('Puppetalk runtime helpers failed to load.');
const {clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta} = runtimeHelpers;

const {
  POSES,GRAB_PARTS,ensureRig,resetPins,antiTangleTarget,rootFollow
} = window.PuppetalkCharacterRigCore || {};
if(!POSES || !GRAB_PARTS || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow){
  throw new Error('Puppetalk character rig core failed to load.');
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

const controllerApp = window.PuppetalkControllerApp?.create?.({
  app,document,POSES,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,savedLook,
  peerId,NAMES,send,savedPlayerName,clamp,drawBackdrop,puppetalkSeatProjection,
  drawProp,drawAnatomy,incompleteInviteShell,controllerShell
});
if(!controllerApp) throw new Error('Puppetalk controller app failed to load.');
const {startController} = controllerApp;

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



})();
