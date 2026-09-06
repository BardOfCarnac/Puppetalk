import fs from 'node:fs';

const input='translation/generated/app-final.js';
const output=process.argv[2]||'translation/runtime/app.js';
let source=fs.readFileSync(input,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Could not find ${label} in frozen final source.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

function removeBetweenOnce(label,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  if(start<0) throw new Error(`Could not find ${label} start marker in frozen final source.`);
  if(source.indexOf(startMarker,start+1)>=0) throw new Error(`${label} start marker matched more than once.`);
  const end=source.indexOf(endMarker,start+startMarker.length);
  if(end<0) throw new Error(`Could not find ${label} end marker in frozen final source.`);
  source=source.slice(0,start)+source.slice(end);
}

removeBetweenOnce(
  'embedded look model',
  `const LOOK_PALETTE = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'];`,
  `const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];`
);

replaceOnce(
  'look model setup point',
  `const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];`,
  `const {LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook} = window.PuppetalkLookModel || {};
if(!LOOK_PALETTE || !LOOK_PARTS || !defaultLook || !cleanLook){
  throw new Error('Puppetalk look model failed to load.');
}

const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];`
);

replaceOnce('pose/grab constants',`const POSES = {
  stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
};
const GRAB_PARTS = new Set(['torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot']);`, `const {
  POSES,GRAB_PARTS,ensureRig,resetPins,antiTangleTarget,rootFollow
} = window.PuppetalkCharacterRigCore || {};
if(!POSES || !GRAB_PARTS || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow){
  throw new Error('Puppetalk character rig core failed to load.');
}`);

replaceOnce('character helper factory point',`  const {Engine,Bodies,Body,Composite,Constraint,Vector} = Matter;`, `  const {Engine,Bodies,Body,Composite,Constraint,Vector} = Matter;
  const grabGeometry = window.PuppetalkGrabGeometry?.create?.(Vector);
  if(!grabGeometry) throw new Error('Puppetalk grab geometry failed to load.');
  const {worldPoint,grabBody,grabWorldPoint} = grabGeometry;
  const driveForces = window.PuppetalkDriveForces?.create?.({Body,clamp,angleDelta});
  if(!driveForces) throw new Error('Puppetalk drive forces failed to load.');
  const {servo,springPull} = driveForces;
  const recoveryGeometry = window.PuppetalkRecoveryGeometry?.create?.(Vector);
  if(!recoveryGeometry) throw new Error('Puppetalk recovery geometry failed to load.');
  const {jointWorldPoint,jointGap,jointCutPoint,seamCutPoint} = recoveryGeometry;`);

replaceOnce('character factory setup point',`  const puppets = new Map();
  const conns = new Map();`, `  const puppets = new Map();
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
  const {drivePuppet} = puppetDriver;`);

replaceOnce('stage and lifecycle setup point',`  const specialItems = new Map();`, `  const specialItems = new Map();
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
  const {drawStage,broadcastScene,tick} = stageLoop;`);

replaceOnce('embedded prop id counter',`  let nextPropId = 1;
`,``);

removeBetweenOnce(
  'embedded prop factory',
  `  function makeProp(type,x,y){`,
  `  function updatePropContest(prop,now){`
);

removeBetweenOnce(
  'embedded prop contest driver',
  `  function updatePropContest(prop,now){`,
  `  function distancePointToSegment(point,a,b){`
);

removeBetweenOnce(
  'embedded balloon pops',
  `  function distancePointToSegment(point,a,b){`,
  `  function pointSegmentDistance(point,a,b){`
);

replaceOnce('embedded joint constructor',`  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

`,``);

removeBetweenOnce(
  'embedded laser frisbee',
  `  function pointSegmentDistance(point,a,b){`,
  `  function pumpNozzleOffset(scale){`
);

removeBetweenOnce(
  'embedded pump balloon lifecycle',
  `  function pumpNozzleOffset(scale){`,
  `  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;`
);

removeBetweenOnce(
  'embedded depth assist',
  `  const PUPPETALK_ACTION_DEPTH_TOLERANCE = .38;`,
  `  function driveProps(){`
);

replaceOnce('embedded special item constants',`  const SPECIAL_ITEM_TYPES = ['frisbee','pump','ball','dart'];
  const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];
`,``);

removeBetweenOnce(
  'embedded special item tail',
  `  function specialItemType(slot,requested){`,
  `  function tagHiddenSegment(body,slot,part,segment){`
);

removeBetweenOnce(
  'embedded rig construction',
  `  function tagHiddenSegment(body,slot,part,segment){`,
  `  function jointWorldPoint(constraint,side){`
);

replaceOnce('embedded recovery geometry',`  function jointWorldPoint(constraint,side){
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
`,``);

removeBetweenOnce(
  'embedded recovery mutations',
  `  function severJoint(p,name){`,
  `  function removePuppet(slot){`
);

replaceOnce('embedded puppet lifecycle',`  function removePuppet(slot){
    const p = puppets.get(slot);
    if(!p) return;
    releaseAllPropGrips(slot);
    props.forEach(prop=>{ if(prop.attachedTo?.slot === slot) detachPropAttachment(prop); });
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));
    puppets.delete(slot);
  }

`,``);

replaceOnce('embedded servo',`  function servo(body,target,strength=.006){
    body.torque += clamp(angleDelta(target,body.angle)*strength-body.angularVelocity*strength*.72,-.028,.028);
  }

`,``);

replaceOnce('embedded grab geometry',`  function worldPoint(body,local){
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

`,``);

replaceOnce('embedded spring pull',`  function springPull(body,point,target,stiffness,damping=.003){
    const mass = Math.max(.2,body.mass || 1);
    Body.applyForce(body,point,{
      x:((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,
      y:((target.y-point.y)*stiffness-body.velocity.y*damping)*mass
    });
  }

`,``);

replaceOnce('embedded rig helpers',`  function ensureRig(p){
    if(p._rig) return p._rig;
    p._rig = {
      sessions:{},
      lastPose:p.pose,
      lastPoseVersion:p.poseVersion || 0,
      pins:{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null}
    };
    return p._rig;
  }

  function antiTangleTarget(p,part,desired,age){
    if(!(part.includes('Hand') || part.includes('Foot'))) return desired;
    const t = p.torso.position;
    let clear = desired;
    if(part === 'leftHand') clear = {x:t.x-54,y:t.y+4};
    if(part === 'rightHand') clear = {x:t.x+54,y:t.y+4};
    if(part === 'leftFoot') clear = {x:t.x-23,y:t.y+132};
    if(part === 'rightFoot') clear = {x:t.x+23,y:t.y+132};
    const fade = 1-clamp(age/190,0,1);
    const amount = .3*fade;
    return {x:desired.x+(clear.x-desired.x)*amount,y:desired.y+(clear.y-desired.y)*amount};
  }

  function rootFollow(part){
    if(part === 'torso') return 1;
    if(part === 'pelvis') return .92;
    if(part.includes('Shoulder')) return .82;
    if(part === 'head') return .72;
    if(part.includes('Hand')) return .42;
    return .3;
  }

`,``);

removeBetweenOnce(
  'embedded puppet driver',
  `  function drivePuppet(p){`,
  `  function norm(point){`
);

removeBetweenOnce(
  'embedded character scene serialization',
  `  function norm(point){`,
  `  function drawStage(){`
);

removeBetweenOnce(
  'embedded stage loop',
  `  function drawStage(){`,
  `  function updateStatus(extra=''){`
);

removeBetweenOnce(
  'embedded character input normalization',
  `  function applyInput(slot,msg){`,
  `  const peer = new Peer(peerId(room));`
);

removeBetweenOnce(
  'embedded host session',
  `  function updateStatus(extra=''){`,
  `  addEventListener('resize',resize,{passive:true});`
);

replaceOnce('host session setup point',
  `  addEventListener('resize',resize,{passive:true});`,
  `  const hostSession = window.PuppetalkHostSession?.create?.({
    Peer,room,peerId,status,conns,puppets,props,NAMES,
    makePuppet,send,anatomy,propState,
    applyInput,handlePropInput,handleSpecialItemInput,handleJointRecovery,
    cleanLook,cleanPlayerName,removePuppet,
    setTimer:(callback,ms)=>setTimeout(callback,ms),
    logError:error=>console.error(error)
  });
  if(!hostSession) throw new Error('Puppetalk host session failed to load.');
  const {peer,updateStatus,freeSlot} = hostSession;

  addEventListener('resize',resize,{passive:true});`
);

removeBetweenOnce(
  'embedded generic prop driver',
  `  function driveProps(){`,
  `  function propState(prop){`
);

removeBetweenOnce(
  'embedded prop state serializer',
  `  function propState(prop){`,
  `  function handBody(p,hand){`
);

removeBetweenOnce(
  'embedded prop geometry',
  `  function handBody(p,hand){`,
  `  function tieBalloonToBody(prop,target){`
);

removeBetweenOnce(
  'embedded balloon lift',
  `  function tieBalloonToBody(prop,target){`,
  `  function balloonAttachmentState(prop){`
);

removeBetweenOnce(
  'embedded balloon attachment state',
  `  function balloonAttachmentState(prop){`,
  `  function localOffset(body,world){`
);

removeBetweenOnce(
  'embedded prop attachment core',
  `  function localOffset(body,world){`,
  `  function installDartImpacts(){`
);

removeBetweenOnce(
  'embedded dart impacts',
  `  function installDartImpacts(){`,
  `  function gripRecord(slot,hand){`
);

removeBetweenOnce(
  'embedded prop grip core',
  `  function gripRecord(slot,hand){`,
  `  function propHandIsClose(slot,hand,prop){`
);

removeBetweenOnce(
  'embedded prop input',
  `  function propHandIsClose(slot,hand,prop){`,
  `  function specialItemLabel(type){`
);

replaceOnce('embedded special item label',`  function specialItemLabel(type){
    if(type === 'frisbee') return 'Laser frisbee';
    if(type === 'pump') return 'Balloon pump';
    if(type === 'ball') return 'Ball';
    if(type === 'dart') return 'Sticky darts';
    return 'Item';
  }
`,``);

removeBetweenOnce(
  'embedded prop contact physics',
  `  function installPropContactPhysics(){`,
  `  resize();`
);

replaceOnce(
  'embedded controller active pointer state',
  `  const activePointers = new Map();
`,
  ``
);

replaceOnce(
  'embedded controller grab sync',
  `  function syncGrabs(){ input.grabs = [...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y})); }
`,
  ``
);

replaceOnce(
  'direct puppet interaction setup point',
  `  input.look = savedLook();`,
  `  input.look = savedLook();

  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({
    canvas,ctx,hint,input,clamp,
    getScene:()=>scene,getPropScene:()=>propScene,getSlot:()=>slot,getDimensions:()=>({cw,ch}),
    drawBackdrop,seatProjection:puppetalkSeatProjection,drawProp,drawAnatomy,transmit,
    cancelCentre:()=>{ if(centreTimer){ clearTimeout(centreTimer); centreTimer = null; } }
  });
  if(!puppetInteraction) throw new Error('Puppetalk direct puppet interaction failed to load.');
  const {
    activePointers,myPuppet,grabSpots,renderGrabHandles,renderPersonalScene,
    pointerToWorld,pickGrab,describeActiveGrabs
  } = puppetInteraction;`
);

removeBetweenOnce(
  'embedded direct puppet interaction',
  `  function myPuppet(){ return scene.find(p=>p.slot === slot); }`,
  `  function propDisplayPoint(q){`
);

replaceOnce(
  'direct puppet interaction install point',
  `  function propDisplayPoint(q){`,
  `  puppetInteraction.install();

  function propDisplayPoint(q){`
);

removeBetweenOnce(
  'embedded controller special-item helpers',
  `  function controllerSpecialType(){`,
  `  function transmit(force=false){`
);

replaceOnce(
  'controller item interactions setup point',
  `  function transmit(force=false){`,
  `  const itemInteraction = window.PuppetalkControllerItems?.create?.({
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

  function transmit(force=false){`
);

removeBetweenOnce(
  'embedded controller grip helpers',
  `  function heldProp(hand){ return propScene.find(prop=>prop?.heldBy?.slot === slot && prop?.heldBy?.hand === hand); }`,
  `  function connect(){`
);

removeBetweenOnce(
  'embedded controller prop tap interactions',
  `  function propDisplayPoint(q){`,
  `  function sendLook(){`
);

replaceOnce(
  'controller prop tap install point',
  `  function sendLook(){`,
  `  itemInteraction.installPropTap();

  function sendLook(){`
);

replaceOnce(
  'controller item buttons',
  `  document.querySelector('#special-item')?.addEventListener('click',bringOutMySpecialItem);
  updateSpecialItemButton(false);
  document.querySelector('#grip-left')?.addEventListener('click',()=>toggleGrip('left'));
  document.querySelector('#grip-right')?.addEventListener('click',()=>toggleGrip('right'));`,
  `  itemInteraction.installButtons();
  updateSpecialItemButton(false);`
);

removeBetweenOnce(
  'embedded character creator controller',
  `  function sendLook(){`,
  `  const throwGestures = new Map();`
);

replaceOnce(
  'character creator controller setup point',
  `  const throwGestures = new Map();`,
  `  const characterCreator = window.PuppetalkCharacterCreator?.create?.({
    document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,saveLook,send,
    getConn:()=>conn,getSlot:()=>slot,savedPlayerName,random:()=>Math.random()
  });
  if(!characterCreator) throw new Error('Puppetalk character creator controller failed to load.');
  characterCreator.install();

  const throwGestures = new Map();`
);

removeBetweenOnce(
  'embedded controller throw gesture',
  `  const throwGestures = new Map();`,
  `  document.querySelector('#poses').addEventListener('click',event=>{`
);

replaceOnce(
  'embedded controller audio state',
  `  let micStop = null;
  let manualTimer = null;
`,
  ``
);

removeBetweenOnce(
  'embedded controller audio',
  `  async function enableMic(){`,
  `  addEventListener('resize',resizeCanvas,{passive:true});`
);

replaceOnce(
  'controller audio setup point',
  `  addEventListener('resize',resizeCanvas,{passive:true});`,
  `  const controllerAudio = window.PuppetalkControllerAudio?.create?.({
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

  addEventListener('resize',resizeCanvas,{passive:true});`
);

replaceOnce(
  'controller throw gesture setup point',
  `  document.querySelector('#poses').addEventListener('click',event=>{`,
  `  const controllerThrowGesture = window.PuppetalkControllerThrowGesture?.create?.({
    canvas,activePointers,heldProp,pointerToWorld,
    getConn:()=>conn,getSlot:()=>slot,send,
    now:()=>performance.now(),queueTask:callback=>queueMicrotask(callback)
  });
  if(!controllerThrowGesture) throw new Error('Puppetalk controller throw gesture failed to load.');
  controllerThrowGesture.install();

  document.querySelector('#poses').addEventListener('click',event=>{`
);

removeBetweenOnce(
  'embedded controller command panel',
  `  document.querySelector('#poses').addEventListener('click',event=>{`,
  `  itemInteraction.installButtons();`
);

replaceOnce(
  'controller command panel setup point',
  `  itemInteraction.installButtons();`,
  `  const commandPanel = window.PuppetalkControllerCommands?.create?.({
    document,input,activePointers,transmit,connect,
    getCentreTimer:()=>centreTimer,setCentreTimer:value=>{ centreTimer=value; },
    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),
    clearTimeoutFn:id=>clearTimeout(id)
  });
  if(!commandPanel) throw new Error('Puppetalk controller command panel failed to load.');
  commandPanel.install();

  itemInteraction.installButtons();`
);

replaceOnce(
  'embedded controller session state',
  `  let peer;
  let conn;
  let slot = null;
  let scene = [];
  let propScene = [];
  let centreTimer = null;
  let cw = 1;
  let ch = 1;
  let lastSent = '';
  let reconnectTimer = null;
  let connectGeneration = 0;
  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};`,
  `  let centreTimer = null;
  let cw = 1;
  let ch = 1;
  const input = {pose:'stand',poseVersion:0,rag:false,mouth:0,grabs:[]};`
);

replaceOnce(
  'controller session setup point',
  `  input.look = savedLook();

  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({`,
  `  input.look = savedLook();

  const controllerSession = window.PuppetalkControllerSession?.create?.({
    Peer,room,peerId,NAMES,input,send,savedPlayerName,hint,youChip,status,dot,
    setTimeoutFn:(callback,ms)=>setTimeout(callback,ms),
    clearTimeoutFn:id=>clearTimeout(id)
  });
  if(!controllerSession) throw new Error('Puppetalk controller session failed to load.');
  const {setStatus,transmit,connect,getConn,getSlot,getScene,getPropScene} = controllerSession;

  const puppetInteraction = window.PuppetalkControllerPuppetry?.create?.({`
);

replaceOnce(
  'controller session direct-puppetry accessors',
  `    getScene:()=>scene,getPropScene:()=>propScene,getSlot:()=>slot,getDimensions:()=>({cw,ch}),`,
  `    getScene,getPropScene,getSlot,getDimensions:()=>({cw,ch}),`
);

removeBetweenOnce(
  'embedded controller status setter',
  `  function setStatus(text,state=''){`,
  `  function resizeCanvas(){`
);

replaceOnce(
  'controller session item accessors',
  `    getConn:()=>conn,getSlot:()=>slot,getPropScene:()=>propScene,getScene:()=>scene,
    getDimensions:()=>({cw,ch}),getMyPuppet:()=>scene.find(p=>p.slot === slot),`,
  `    getConn,getSlot,getPropScene,getScene,
    getDimensions:()=>({cw,ch}),getMyPuppet:()=>getScene().find(p=>p.slot === getSlot()),`
);

replaceOnce(
  'controller session hook point',
  `  const {
    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand
  } = itemInteraction;`,
  `  const {
    controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
    heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand
  } = itemInteraction;
  controllerSession.setHooks({updateSpecialItemButton,updateGripButtons,renderPersonalScene});`
);

removeBetweenOnce(
  'embedded controller session operations',
  `  function transmit(force=false){`,
  `  puppetInteraction.install();`
);

replaceOnce(
  'controller session character accessors',
  `    getConn:()=>conn,getSlot:()=>slot,savedPlayerName,random:()=>Math.random()`,
  `    getConn,getSlot,savedPlayerName,random:()=>Math.random()`
);

replaceOnce(
  'controller session throw accessors',
  `    getConn:()=>conn,getSlot:()=>slot,send,`,
  `    getConn,getSlot,send,`
);

replaceOnce('prop collision setup point',
  `  resize();`,
  `  const dartImpacts = window.PuppetalkDartImpacts?.create?.({
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

  resize();`
);

replaceOnce(
  'embedded stage lifecycle resize listener',
  `  addEventListener('resize',resize,{passive:true});
`,
  ``
);

removeBetweenOnce(
  'embedded stage lifecycle resize',
  `  function resize(){`,
  `  const hostSession = window.PuppetalkHostSession?.create?.({`
);

replaceOnce(
  'stage lifecycle startup',
  `  resize();
  ensureTestProps();
  installDartImpacts();
  installPropContactPhysics();
  requestAnimationFrame(tick);`,
  `  const stageLifecycle = window.PuppetalkStageLifecycle?.create?.({
    canvas,ctx,Bodies,Composite,engine,
    getBounds:()=>bounds,setBounds:value=>{ bounds=value; },
    setDimensions:(width,height)=>{ W=width; H=height; },
    ensureTestProps,installDartImpacts,installPropContactPhysics,tick,
    getViewport:()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio || 1}),
    addEventListenerFn:(type,handler,opts)=>addEventListener(type,handler,opts),
    requestFrame:callback=>requestAnimationFrame(callback)
  });
  if(!stageLifecycle) throw new Error('Puppetalk stage lifecycle failed to load.');
  stageLifecycle.start();`
);

replaceOnce(
  'scene renderer setup point',
  `if(mode === 'controller') startController(room);`,
  `const sceneRenderer = window.PuppetalkSceneRenderer?.create?.({
  cleanLook,document,
  Path2DClass:typeof Path2D === 'function' ? Path2D : null,
  getDisplayPoint:()=>typeof displayPoint === 'function' ? displayPoint : null,
  getProjectionRenderScale:()=>typeof projectionRenderScale === 'function' ? projectionRenderScale : null
});
if(!sceneRenderer) throw new Error('Puppetalk scene renderer failed to load.');
const {drawBackdrop,drawAnatomy,drawProp,roundRect} = sceneRenderer;

if(mode === 'controller') startController(room);`
);

removeBetweenOnce(
  'embedded shared scene renderer',
  `function drawBackdrop(ctx,w,h){`,
  `})();`
);

removeBetweenOnce(
  'embedded seat projection',
  `const PUPPETALK_SEAT_ORDER = [0,3,1,4,2,5];`,
  `function startController(room){`
);

replaceOnce(
  'seat projection setup point',
  `if(mode === 'controller') startController(room);`,
  `const seatProjection = window.PuppetalkSeatProjection?.create?.({
  getDepthState:()=>window.PuppetalkDepthState,
  getForegroundTuning:()=>window.PuppetalkForegroundTuning
});
if(!seatProjection) throw new Error('Puppetalk seat projection failed to load.');
const {puppetalkSeatProjection} = seatProjection;

if(mode === 'controller') startController(room);`
);

removeBetweenOnce(
  'dead legacy line-face renderer',
  `const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];`,
  `function savedLook(){`
);

replaceOnce(
  'view shell setup point',
  `if(mode === 'controller') startController(room);`,
  `const {incompleteInviteShell,stageShell,controllerShell} = window.PuppetalkViewShells || {};
if(!incompleteInviteShell || !stageShell || !controllerShell){
  throw new Error('Puppetalk view shells failed to load.');
}

if(mode === 'controller') startController(room);`
);

removeBetweenOnce(
  'embedded stage shell',
  `  app.innerHTML = \`
    <section class=\"stage-shell\">`,
  `  const canvas = document.querySelector('#stage-canvas');`
);

replaceOnce(
  'stage shell render point',
  `  const canvas = document.querySelector('#stage-canvas');`,
  `  app.innerHTML = stageShell(room,joinUrl.href);

  const canvas = document.querySelector('#stage-canvas');`
);

replaceOnce(
  'incomplete controller invite shell',
  `    app.innerHTML = \`<section class=\"join-form\"><div class=\"join-panel card\"><strong>Puppetalk</strong><div class=\"muted small\">This invite is incomplete.</div></div></section>\`;`,
  `    app.innerHTML = incompleteInviteShell();`
);

removeBetweenOnce(
  'embedded controller shell',
  `  app.innerHTML = \`
    <section class=\"shell controller-shell personal-controller\">`,
  `  const canvas = document.querySelector('#personal-canvas');`
);

replaceOnce(
  'controller shell render point',
  `  const canvas = document.querySelector('#personal-canvas');`,
  `  app.innerHTML = controllerShell(room,POSES);

  const canvas = document.querySelector('#personal-canvas');`
);

new Function(source);
fs.mkdirSync('translation/runtime',{recursive:true});
fs.writeFileSync(output,source.endsWith('\n')?source:`${source}\n`,'utf8');
console.log(`Built ${output}: character systems, stage loop, host session and prop grip/attachment/contact systems extracted with frozen V1 behaviour intact.`);
