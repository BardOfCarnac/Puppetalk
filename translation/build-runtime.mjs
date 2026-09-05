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

replaceOnce('embedded joint constructor',`  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

`,``);

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

new Function(source);
fs.mkdirSync('translation/runtime',{recursive:true});
fs.writeFileSync(output,source.endsWith('\n')?source:`${source}\n`,'utf8');
console.log(`Built ${output}: character systems and stage loop extracted with frozen V1 behaviour intact.`);