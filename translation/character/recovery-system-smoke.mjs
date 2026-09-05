import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/recovery-system.js','utf8'),context,{filename:'recovery-system.js'});
const api=context.window.PuppetalkRecoverySystem;
assert.ok(api?.create,'Recovery system did not install.');

const addCalls=[];
const removeCalls=[];
const forceCalls=[];
const engine={world:{id:'world'}};
const Composite={
  add(world,item){addCalls.push({world,item});},
  remove(world,item){removeCalls.push({world,item});}
};
const Body={applyForce(body,point,force){forceCalls.push({body,point,force});}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function angleDelta(target,current){
  let d=target-current;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return d;
}
const points=new Map();
const gaps=new Map();
const jointGap=c=>gaps.get(c) ?? Infinity;
const jointWorldPoint=(c,side)=>points.get(c)?.[side] ?? null;
const puppetBySlot=new Map();
const makeCalls=[];
const makePuppet=slot=>{makeCalls.push(slot);return puppetBySlot.get(slot);};
const system=api.create({Composite,Body,engine,makePuppet,jointGap,jointWorldPoint,angleDelta,clamp});

function fresh(){
  const jointA={id:'jointA'};
  const jointB={id:'jointB'};
  const seamA={id:'seamA',bodyA:{id:'a',mass:1.5,angle:.2,torque:.01},bodyB:{id:'b',mass:.05,angle:.8,torque:-.02}};
  const seamB={id:'seamB',bodyA:{id:'c',mass:1,angle:0,torque:0},bodyB:{id:'d',mass:2,angle:0,torque:0}};
  return {
    jointA,jointB,seamA,seamB,
    p:{
      joints:{neck:jointA,leftElbow:jointB},
      seams:{torsoUpper:seamA,leftShin:seamB},
      severedJoints:new Set(),brokenSeams:new Set(),
      recoverVersion:0,repairRequested:false
    }
  };
}

{
  const {p,jointA}=fresh();
  assert.equal(system.severJoint(null,'neck'),false);
  assert.equal(system.severJoint(p,'missing'),false);
  assert.equal(system.severJoint(p,'neck'),true);
  assert.deepEqual(removeCalls.splice(0),[{world:engine.world,item:jointA}]);
  assert.deepEqual([...p.severedJoints],['neck']);
  assert.equal(p.repairRequested,false);
  assert.equal(system.severJoint(p,'neck'),false,'Already severed joint must not be removed twice.');
  assert.equal(removeCalls.length,0);
}

{
  const {p,jointA,jointB}=fresh();
  p.severedJoints=new Set(['neck','leftElbow']);
  gaps.set(jointA,35);
  gaps.set(jointB,34);
  system.repairSeveredJoints(p);
  assert.equal(addCalls.length,0,'No joint repairs happen until Recover requests them.');
  p.repairRequested=true;
  system.repairSeveredJoints(p);
  assert.deepEqual(addCalls.splice(0),[{world:engine.world,item:jointB}]);
  assert.deepEqual([...p.severedJoints],['neck']);
  assert.equal(p.repairRequested,true,'Repair request remains while a severed joint is still out of range.');
  gaps.set(jointA,12);
  system.repairSeveredJoints(p);
  assert.deepEqual(addCalls.splice(0),[{world:engine.world,item:jointA}]);
  assert.equal(p.severedJoints.size,0);
  assert.equal(p.repairRequested,false,'V1 clears repairRequested when all severed joints are repaired.');
}

{
  const {p}=fresh();
  puppetBySlot.set(3,p);
  system.handleJointRecovery(3,{type:'look',input:{recoverVersion:1}});
  system.handleJointRecovery(3,{type:'input',input:{recoverVersion:1.5}});
  assert.equal(makeCalls.length,0,'Invalid recovery messages must not construct/access a puppet.');
  system.handleJointRecovery(3,{type:'input',input:{recoverVersion:1}});
  assert.deepEqual(makeCalls.splice(0),[3]);
  assert.equal(p.recoverVersion,1);
  assert.equal(p.repairRequested,true);
  p.repairRequested=false;
  system.handleJointRecovery(3,{type:'input',input:{recoverVersion:1}});
  assert.deepEqual(makeCalls.splice(0),[3]);
  assert.equal(p.repairRequested,false,'Same recovery version must not retrigger repair.');
  system.handleJointRecovery(3,{type:'input',input:{recoverVersion:0}});
  assert.deepEqual(makeCalls.splice(0),[3]);
  assert.equal(p.recoverVersion,1,'Older recovery version must not roll state backwards.');
  system.handleJointRecovery(3,{type:'input',input:{recoverVersion:4}});
  assert.deepEqual(makeCalls.splice(0),[3]);
  assert.equal(p.recoverVersion,4);
  assert.equal(p.repairRequested,true);
}

{
  const {p,seamA}=fresh();
  assert.equal(system.severSeam(null,'torsoUpper'),false);
  assert.equal(system.severSeam(p,'missing'),false);
  assert.equal(system.severSeam(p,'torsoUpper'),true);
  assert.deepEqual(removeCalls.splice(0),[{world:engine.world,item:seamA}]);
  assert.deepEqual([...p.brokenSeams],['torsoUpper']);
  assert.equal(p.repairRequested,false);
  assert.equal(system.severSeam(p,'torsoUpper'),false);
  assert.equal(removeCalls.length,0);
}

{
  const {p,seamA}=fresh();
  p.brokenSeams.add('torsoUpper');
  points.set(seamA,{A:{x:0,y:0},B:{x:19,y:0}});
  system.repairBrokenSeams(p);
  assert.equal(addCalls.length,0,'Broken seam repair must wait for Recover.');
  p.repairRequested=true;
  system.repairBrokenSeams(p);
  assert.deepEqual(addCalls.splice(0),[{world:engine.world,item:seamA}]);
  assert.equal(p.brokenSeams.size,0);
  assert.equal(p.repairRequested,false);
}

{
  const {p,seamA}=fresh();
  p.brokenSeams.add('torsoUpper');
  p.repairRequested=true;
  points.set(seamA,{A:{x:10,y:20},B:{x:50,y:70}});
  const dx=40,dy=50;
  const gap=Math.hypot(dx,dy);
  const pull=Math.min(.00032,.00011+gap*.0000024);
  const ma=1.5,mb=.2;
  const rel=angleDelta(.8,.2);
  system.repairBrokenSeams(p);
  assert.equal(addCalls.length,0,'Wide seam must be pulled together, not re-added immediately.');
  assert.equal(forceCalls.length,2);
  assert.deepEqual(forceCalls[0],{body:seamA.bodyA,point:{x:10,y:20},force:{x:dx*pull*ma,y:dy*pull*ma}});
  assert.deepEqual(forceCalls[1],{body:seamA.bodyB,point:{x:50,y:70},force:{x:-dx*pull*mb,y:-dy*pull*mb}});
  forceCalls.length=0;
  assert.equal(seamA.bodyA.torque,.01+clamp(rel*.0025,-.012,.012));
  assert.equal(seamA.bodyB.torque,-.02-clamp(rel*.0025,-.012,.012));
  assert.equal(p.brokenSeams.has('torsoUpper'),true);
  assert.equal(p.repairRequested,true);
}

{
  const {p,seamA}=fresh();
  p.brokenSeams.add('torsoUpper');
  p.severedJoints.add('neck');
  p.repairRequested=true;
  points.set(seamA,{A:{x:0,y:0},B:{x:2,y:1}});
  system.repairBrokenSeams(p);
  addCalls.length=0;
  assert.equal(p.brokenSeams.size,0);
  assert.equal(p.repairRequested,true,'V1 keeps repairRequested after seam repair while a severed joint remains.');
}

{
  const {p,seamA}=fresh();
  p.brokenSeams.add('torsoUpper');
  p.repairRequested=true;
  seamA.bodyB=null;
  system.repairBrokenSeams(p);
  assert.equal(addCalls.length,0);
  assert.equal(forceCalls.length,0);
  assert.equal(p.brokenSeams.has('torsoUpper'),true);
}

console.log('Recovery mutation system preserves V1 sever, Recover-version and seam/joint repair state transitions.');