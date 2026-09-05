import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const frozenSource=fs.readFileSync('translation/generated/app-final.js','utf8');
const start=frozenSource.indexOf('  function drivePuppet(p){');
const end=frozenSource.indexOf('\n  function norm(point)',start);
assert.ok(start>=0 && end>start,'Could not isolate frozen V1 drivePuppet().');
const frozenDriverSource=frozenSource.slice(start,end);

const moduleContext={window:{}};
moduleContext.globalThis=moduleContext;
vm.runInNewContext(fs.readFileSync('translation/character/puppet-driver.js','utf8'),moduleContext,{filename:'puppet-driver.js'});
const driverApi=moduleContext.window.PuppetalkPuppetDriver;
assert.ok(driverApi?.create,'Puppet driver candidate did not install.');

const POSES={
  stand:[.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:[1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:[2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:[1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch:[.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
};
const W=1000,H=800,NOW=12345;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const emptyPins=()=>({head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null});
const plain=v=>JSON.parse(JSON.stringify(v));

function makeBody(id,x,y,vx=0){
  return {id,position:{x,y},velocity:{x:vx,y:0},angle:0,angularVelocity:0};
}

function makePuppet(overrides={}){
  const p={
    slot:0,
    torso:makeBody('torso',500,520,1.25),
    head:makeBody('head',500,455),
    uaL:makeBody('uaL',463,490), faL:makeBody('faL',458,538),
    uaR:makeBody('uaR',537,490), faR:makeBody('faR',542,538),
    thL:makeBody('thL',486,570), shL:makeBody('shL',486,624),
    thR:makeBody('thR',514,570), shR:makeBody('shR',514,624),
    faL2:makeBody('faL2',458,562), faR2:makeBody('faR2',542,562),
    shL2:makeBody('shL2',486,651), shR2:makeBody('shR2',514,651),
    target:{x:.5,y:.65},
    pose:'stand',poseVersion:0,rag:false,grabs:[]
  };
  Object.assign(p,overrides);
  return p;
}

function dependencySet(logs){
  const ensureRig=p=>{
    if(p._rig) return p._rig;
    p._rig={sessions:{},lastPose:p.pose,lastPoseVersion:p.poseVersion||0,pins:emptyPins()};
    return p._rig;
  };
  const resetPins=rig=>{ logs.resetPins++; rig.pins=emptyPins(); };
  const antiTangleTarget=(p,part,desired,age)=>{
    if(!(part.includes('Hand')||part.includes('Foot'))) return desired;
    const t=p.torso.position;
    let clear=desired;
    if(part==='leftHand') clear={x:t.x-54,y:t.y+4};
    if(part==='rightHand') clear={x:t.x+54,y:t.y+4};
    if(part==='leftFoot') clear={x:t.x-23,y:t.y+132};
    if(part==='rightFoot') clear={x:t.x+23,y:t.y+132};
    const fade=1-clamp(age/190,0,1);
    const amount=.3*fade;
    return {x:desired.x+(clear.x-desired.x)*amount,y:desired.y+(clear.y-desired.y)*amount};
  };
  const rootFollow=part=>{
    if(part==='torso') return 1;
    if(part==='pelvis') return .92;
    if(part.includes('Shoulder')) return .82;
    if(part==='head') return .72;
    if(part.includes('Hand')) return .42;
    return .3;
  };
  const grabBody=(p,part)=>{
    if(part==='head') return p.head;
    if(part==='leftHand') return p.faL2||p.faL;
    if(part==='rightHand') return p.faR2||p.faR;
    if(part==='leftFoot') return p.shL2||p.shL;
    if(part==='rightFoot') return p.shR2||p.shR;
    return p.torso;
  };
  const grabWorldPoint=(p,part)=>{
    const at=(b,dx,dy)=>({x:b.position.x+dx,y:b.position.y+dy});
    if(part==='pelvis') return at(p.torso,0,34);
    if(part==='leftShoulder') return at(p.torso,-24,-27);
    if(part==='rightShoulder') return at(p.torso,24,-27);
    if(part==='leftHand') return at(p.faL2||p.faL,0,12);
    if(part==='rightHand') return at(p.faR2||p.faR,0,12);
    if(part==='leftFoot') return at(p.shL2||p.shL,0,13.5);
    if(part==='rightFoot') return at(p.shR2||p.shR,0,13.5);
    return grabBody(p,part).position;
  };
  const springPull=(body,point,target,stiffness,damping=.003)=>{
    logs.springs.push({body:body.id,point:plain(point),target:plain(target),stiffness,damping});
  };
  const servo=(body,target,strength=.006)=>{
    logs.servos.push({body:body.id,target,strength});
  };
  return {ensureRig,resetPins,antiTangleTarget,rootFollow,grabBody,grabWorldPoint,springPull,servo};
}

function runFrozen(p){
  const logs={springs:[],servos:[],resetPins:0,nowCalls:0};
  const deps=dependencySet(logs);
  const context={
    W,H,POSES,clamp,
    performance:{now(){logs.nowCalls++;return NOW;}},
    ensureRig:deps.ensureRig,
    antiTangleTarget:deps.antiTangleTarget,
    rootFollow:deps.rootFollow,
    grabBody:deps.grabBody,
    grabWorldPoint:deps.grabWorldPoint,
    springPull:deps.springPull,
    servo:deps.servo
  };
  vm.createContext(context);
  vm.runInContext(`${frozenDriverSource}\nthis.__drivePuppet=drivePuppet;`,context,{filename:'frozen-drivePuppet.js'});
  context.__drivePuppet(p);
  return {logs,p};
}

function runCandidate(p){
  const logs={springs:[],servos:[],resetPins:0,nowCalls:0};
  const deps=dependencySet(logs);
  const driver=driverApi.create({
    getDimensions:()=>({W,H}),
    now(){logs.nowCalls++;return NOW;},
    POSES,clamp,...deps
  });
  assert.ok(driver?.drivePuppet,'Puppet driver candidate did not expose drivePuppet.');
  driver.drivePuppet(p);
  return {logs,p};
}

function stateOf(p){
  return plain({target:p.target,rig:p._rig,pose:p.pose,poseVersion:p.poseVersion,rag:p.rag,grabs:p.grabs});
}

const scenarios=[
  {
    name:'standing idle',
    build:()=>makePuppet({target:{x:.53,y:.65}})
  },
  {
    name:'ragdoll new hand grab',
    build:()=>makePuppet({rag:true,target:{x:.46,y:.65},grabs:[{part:'leftHand',x:.91,y:.18}]})
  },
  {
    name:'single hand grab with existing session',
    build:()=>makePuppet({
      target:{x:.48,y:.65},grabs:[{part:'rightHand',x:.78,y:.34}],
      _rig:{
        sessions:{rightHand:{startDesired:{x:650,y:240},startRootX:470,startTorsoY:515,startedAt:12260},stale:{startedAt:1}},
        lastPose:'stand',lastPoseVersion:0,
        pins:{head:{x:4,y:-60},leftHand:null,rightHand:null,leftFoot:null,rightFoot:null}
      }
    })
  },
  {
    name:'two grabs torso plus hand',
    build:()=>makePuppet({
      target:{x:.51,y:.65},
      grabs:[{part:'torso',x:.67,y:.58},{part:'rightHand',x:.82,y:.3}]
    })
  },
  {
    name:'crouch idle',
    build:()=>makePuppet({pose:'crouch',poseVersion:3,target:{x:.44,y:.65}})
  },
  {
    name:'pose version reset',
    build:()=>makePuppet({
      pose:'stand',poseVersion:5,target:{x:.57,y:.65},grabs:[],
      _rig:{
        sessions:{leftHand:{startDesired:{x:100,y:100},startRootX:300,startTorsoY:500,startedAt:11000}},
        lastPose:'point',lastPoseVersion:4,
        pins:{head:{x:1,y:2},leftHand:{x:3,y:4},rightHand:{x:5,y:6},leftFoot:{x:7,y:8},rightFoot:{x:9,y:10}}
      }
    })
  }
];

for(const scenario of scenarios){
  const frozen=runFrozen(scenario.build());
  const candidate=runCandidate(scenario.build());
  assert.deepEqual(candidate.logs.springs,frozen.logs.springs,`${scenario.name}: springPull call sequence drifted from frozen V1.`);
  assert.deepEqual(candidate.logs.servos,frozen.logs.servos,`${scenario.name}: servo call sequence drifted from frozen V1.`);
  assert.equal(candidate.logs.nowCalls,frozen.logs.nowCalls,`${scenario.name}: time-read count drifted from frozen V1.`);
  assert.deepEqual(stateOf(candidate.p),stateOf(frozen.p),`${scenario.name}: target/session/pin state drifted from frozen V1.`);
}

const rag=runCandidate(scenarios[1].build());
assert.equal(rag.logs.servos.length,0,'Ragdoll path must return before all pose servos.');
assert.equal(rag.logs.springs.length,2,'Single ragdoll hand grab should only pull the hand and torso-follow before returning.');

const reset=runCandidate(scenarios[5].build());
assert.deepEqual(reset.p._rig.pins,emptyPins(),'Pose/version change must clear all remembered pins.');
assert.deepEqual(Object.keys(reset.p._rig.sessions),[],'Inactive grab sessions must still be removed after a pose/version change.');
assert.equal(reset.logs.resetPins,1,'Candidate should use the extracted resetPins helper exactly once for the pose/version change.');

console.log('Puppet driver candidate matches the real frozen V1 drivePuppet call-for-call across idle, ragdoll, grab, two-grab, crouch and pose-reset cases.');
