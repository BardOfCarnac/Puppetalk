(function(root){
function create(deps={}){
  const {
    app,document,stageShell,clamp,angleDelta,NAMES,COLORS,defaultLook,cleanLook,
    GRAB_PARTS,POSES,ensureRig,resetPins,antiTangleTarget,rootFollow,
    drawBackdrop,drawProp,drawAnatomy,send,peerId,cleanPlayerName
  }=deps;
  if(!app || !document || !stageShell || !clamp || !angleDelta || !NAMES || !COLORS || !defaultLook || !cleanLook ||
     !GRAB_PARTS || !POSES || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow ||
     !drawBackdrop || !drawProp || !drawAnatomy || !send || !peerId || !cleanPlayerName) return null;

  function startStage(room){
    if(!root.Matter || !root.Peer){
      app.textContent = 'Puppetalk libraries failed to load.';
      return;
    }

    const stageUrl = new root.URL(root.location.href);
    stageUrl.search = '';
    stageUrl.searchParams.set('room',room);
    root.history.replaceState(null,'',stageUrl);

    const joinUrl = new root.URL(root.location.href);
    joinUrl.search = '';
    joinUrl.searchParams.set('mode','controller');
    joinUrl.searchParams.set('room',room);

    app.innerHTML = stageShell(room,joinUrl.href);

    const canvas = document.querySelector('#stage-canvas');
    const ctx = canvas.getContext('2d');
    const status = document.querySelector('#stage-status');
    const Matter = root.Matter;
    const Peer = root.Peer;
    const {Engine,Bodies,Body,Composite,Constraint,Vector} = Matter;
    const grabGeometry = root.PuppetalkGrabGeometry?.create?.(Vector);
    if(!grabGeometry) throw new Error('Puppetalk grab geometry failed to load.');
    const {worldPoint,grabBody,grabWorldPoint} = grabGeometry;
    const driveForces = root.PuppetalkDriveForces?.create?.({Body,clamp,angleDelta});
    if(!driveForces) throw new Error('Puppetalk drive forces failed to load.');
    const {servo,springPull} = driveForces;
    const recoveryGeometry = root.PuppetalkRecoveryGeometry?.create?.(Vector);
    if(!recoveryGeometry) throw new Error('Puppetalk recovery geometry failed to load.');
    const {jointWorldPoint,jointGap,jointCutPoint,seamCutPoint} = recoveryGeometry;
    const engine = Engine.create({enableSleeping:false});
    engine.gravity.y = 1.05;
    engine.gravity.scale = .001;

    let W = 1;
    let H = 1;
    let last = root.performance.now();
    let lastSceneSent = 0;
    let bounds = [];
    const puppets = new Map();
    const conns = new Map();
    const rigFactory = root.PuppetalkRigFactory?.create?.({
      Bodies,Body,Composite,Constraint,engine,puppets,
      getDimensions:()=>({W,H}),NAMES,COLORS,defaultLook
    });
    if(!rigFactory) throw new Error('Puppetalk rig factory failed to load.');
    const {makePuppet} = rigFactory;
    const recoverySystem = root.PuppetalkRecoverySystem?.create?.({
      Composite,Body,engine,makePuppet,jointGap,jointWorldPoint,angleDelta,clamp
    });
    if(!recoverySystem) throw new Error('Puppetalk recovery system failed to load.');
    const {severJoint,repairSeveredJoints,handleJointRecovery,severSeam,repairBrokenSeams} = recoverySystem;
    const sceneState = root.PuppetalkCharacterSceneState?.create?.({
      getDimensions:()=>({W,H}),worldPoint,cleanLook
    });
    if(!sceneState) throw new Error('Puppetalk character scene state failed to load.');
    const {anatomy} = sceneState;
    const inputSystem = root.PuppetalkCharacterInputSystem?.create?.({makePuppet,GRAB_PARTS,POSES,clamp});
    if(!inputSystem) throw new Error('Puppetalk character input system failed to load.');
    const {applyInput} = inputSystem;
    const puppetDriver = root.PuppetalkPuppetDriver?.create?.({
      getDimensions:()=>({W,H}),now:()=>root.performance.now(),POSES,
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
    const propFactory = root.PuppetalkPropFactory?.create?.({
      Bodies,Composite,engine,props,getDimensions:()=>({W,H})
    });
    if(!propFactory) throw new Error('Puppetalk prop factory failed to load.');
    const {makeProp,ensureTestProps,ensureLegacyTestProps} = propFactory;
    const propGeometry = root.PuppetalkPropGeometry?.create?.({puppets,props,grabWorldPoint,clamp,Vector});
    if(!propGeometry) throw new Error('Puppetalk prop geometry failed to load.');
    const {handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,nearestBalloonTarget,localOffset,worldOffset} = propGeometry;
    const propStateSystem = root.PuppetalkPropState?.create?.({
      getDimensions:()=>({W,H}),worldOffset,clamp
    });
    if(!propStateSystem) throw new Error('Puppetalk prop state failed to load.');
    const {balloonAttachmentState,propState} = propStateSystem;
    const propGripCore = root.PuppetalkPropGripCore?.create?.({
      propGrips,gripKey,
      Composite,engine,puppets,handBody,propGripLocalPoint,Constraint
    });
    if(!propGripCore) throw new Error('Puppetalk prop grip core failed to load.');
    const {gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest} = propGripCore;
    const balloonPops = root.PuppetalkBalloonPops?.create?.({
      props,cancelPropContest,releasePropHolder,Composite,engine,Vector,clamp,Body
    });
    if(!balloonPops) throw new Error('Puppetalk balloon pops failed to load.');
    const {distancePointToSegment,dartTouchesBalloon,popBalloon,driveDartBalloonPops} = balloonPops;
    const propAttachmentCore = root.PuppetalkPropAttachmentCore?.create?.({
      Body,performance:root.performance,cancelPropContest,releasePropHolder,localOffset,worldOffset
    });
    if(!propAttachmentCore) throw new Error('Puppetalk prop attachment core failed to load.');
    const {attachPropToBody,detachPropAttachment,syncAttachedProp} = propAttachmentCore;
    const balloonLift = root.PuppetalkBalloonLift?.create?.({
      props,puppets,cancelPropContest,releasePropHolder,localOffset,worldOffset,
      Body,syncAttachedProp,clamp
    });
    if(!balloonLift) throw new Error('Puppetalk balloon lift failed to load.');
    const {tieBalloonToBody,driveAttachedBalloon} = balloonLift;
    const propDriver = root.PuppetalkPropDriver?.create?.({
      props,propGrips,gripKey,cancelPropContest,promotePropContest,clamp,
      Body,engine,driveAttachedBalloon,syncAttachedProp,driveDartBalloonPops,
      now:()=>root.performance.now()
    });
    if(!propDriver) throw new Error('Puppetalk prop driver failed to load.');
    const {updatePropContest,driveProps} = propDriver;
    const depthAssist = root.PuppetalkDepthAssist?.create?.({
      props,puppets,clamp,Body,getDimensions:()=>({W,H}),
      getDepthState:()=>root.PuppetalkDepthState,
      getForegroundTuning:()=>root.PuppetalkForegroundTuning
    });
    if(!depthAssist) throw new Error('Puppetalk depth assist failed to load.');
    const {puppetalkAimProjectPoint,puppetalkAimProjectPropPoint,driveDepthAssistedProps} = depthAssist;
    const laserFrisbee = root.PuppetalkLaserFrisbee?.create?.({
      props,puppets,clamp,puppetalkAimProjectPropPoint,puppetalkAimProjectPoint,
      jointCutPoint,seamCutPoint,severSeam,severJoint,Body
    });
    if(!laserFrisbee) throw new Error('Puppetalk laser frisbee failed to load.');
    const {pointSegmentDistance,driveLaserFrisbeeCuts} = laserFrisbee;
    const pumpBalloonSystem = root.PuppetalkPumpBalloon?.create?.({
      props,makeProp,worldOffset,Body,syncAttachedProp,detachPropAttachment,
      now:()=>root.performance.now(),random:()=>Math.random()
    });
    if(!pumpBalloonSystem) throw new Error('Puppetalk pump balloon lifecycle failed to load.');
    const {pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon} = pumpBalloonSystem;
    const propInputSystem = root.PuppetalkPropInput?.create?.({
      props,conns,puppets,send,validPropEffector,handPoint,freePropHand,detachPropAttachment,beginPropHold,
      nearestBalloonTarget,tieBalloonToBody,cancelPropContest,promotePropContest,beginPropContest,
      releasePropHolder,gripRecord,handBody,clamp,Body,inflatePumpBalloon,releasePumpBalloon,
      getDimensions:()=>({W,H}),now:()=>root.performance.now(),
      getDepthForSlot:slot=>root.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0,
      projectPropPoint:puppetalkAimProjectPropPoint
    });
    if(!propInputSystem) throw new Error('Puppetalk prop input failed to load.');
    const {propHandIsClose,tapProp,releaseAllPropGrips,throwHeldProp,handlePropInput} = propInputSystem;
    const specialItemSystem = root.PuppetalkSpecialItems?.create?.({
      specialItems,props,puppets,conns,send,makeProp,grabWorldPoint,clamp,
      getDimensions:()=>({W,H})
    });
    if(!specialItemSystem) throw new Error('Puppetalk special items failed to load.');
    const {specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput} = specialItemSystem;
    const puppetLifecycle = root.PuppetalkPuppetLifecycle?.create?.({
      puppets,props,releaseAllPropGrips,detachPropAttachment,Composite,engine
    });
    if(!puppetLifecycle) throw new Error('Puppetalk puppet lifecycle failed to load.');
    const {removePuppet} = puppetLifecycle;
    const stageLoop = root.PuppetalkStageLoop?.create?.({
      getDimensions:()=>({W,H}),ctx,props,puppets,conns,
      drawBackdrop,drawProp,propState,drawAnatomy,anatomy,send,
      getLastSceneSent:()=>lastSceneSent,
      setLastSceneSent:value=>{ lastSceneSent=value; },
      getLast:()=>last,
      setLast:value=>{ last=value; },
      clamp,
      drivePuppet,repairBrokenSeams,repairSeveredJoints,driveProps,
      Engine,engine,driveDepthAssistedProps,driveLaserFrisbeeCuts,
      requestFrame:callback=>root.requestAnimationFrame(callback)
    });
    if(!stageLoop) throw new Error('Puppetalk stage loop failed to load.');
    const {drawStage,broadcastScene,tick} = stageLoop;

    const hostSession = root.PuppetalkHostSession?.create?.({
      Peer,room,peerId,status,conns,puppets,props,NAMES,
      makePuppet,send,anatomy,propState,
      applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
      cleanLook,cleanPlayerName,removePuppet,
      setTimer:(callback,ms)=>root.setTimeout(callback,ms),
      logError:error=>root.console.error(error)
    });
    if(!hostSession) throw new Error('Puppetalk host session failed to load.');
    const {peer,updateStatus,freeSlot} = hostSession;

    const dartImpacts = root.PuppetalkDartImpacts?.create?.({
      Matter,engine,propForBody,puppetPartForBody,attachPropToBody
    });
    if(!dartImpacts) throw new Error('Puppetalk dart impacts failed to load.');
    const {installDartImpacts} = dartImpacts;
    const propContactPhysics = root.PuppetalkPropContactPhysics?.create?.({
      Matter,engine,propForBody,puppetPartForBody,puppets,handBody,
      closestPointOnBody,tieBalloonToBody,performance:root.performance,Vector,Body,clamp
    });
    if(!propContactPhysics) throw new Error('Puppetalk prop contact physics failed to load.');
    const {installPropContactPhysics} = propContactPhysics;

    const stageLifecycle = root.PuppetalkStageLifecycle?.create?.({
      canvas,ctx,Bodies,Composite,engine,
      getBounds:()=>bounds,setBounds:value=>{ bounds=value; },
      setDimensions:(width,height)=>{ W=width; H=height; },
      ensureTestProps,installDartImpacts,installPropContactPhysics,tick,
      getViewport:()=>({width:root.innerWidth,height:root.innerHeight,dpr:root.devicePixelRatio || 1}),
      addEventListenerFn:(type,handler,opts)=>root.addEventListener(type,handler,opts),
      requestFrame:callback=>root.requestAnimationFrame(callback)
    });
    if(!stageLifecycle) throw new Error('Puppetalk stage lifecycle failed to load.');
    stageLifecycle.start();
  }

  return {startStage};
}

root.PuppetalkStageApp={create};
})(typeof window!=='undefined'?window:globalThis);
