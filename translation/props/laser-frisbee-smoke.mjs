import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./laser-frisbee.js',import.meta.url),'utf8'),context,{filename:'laser-frisbee.js'});
const api=context.window.PuppetalkLaserFrisbee;
assert.ok(api?.create,'Laser frisbee candidate did not install.');

const props=new Map(),puppets=new Map(),calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const puppetalkAimProjectPropPoint=prop=>({x:prop.body.position.x,y:prop.body.position.y,depth:prop._depth||0});
const puppetalkAimProjectPoint=(p,q)=>({x:q.x,y:q.y,depth:p.depth||0});
const jointCutPoint=constraint=>constraint?.point||null;
const seamCutPoint=(p,name)=>p?.seams?.[name]?.point||null;
let severSeamResult=true,severJointResult=true;
const severSeam=(p,name)=>{calls.push(['seam',p.slot,name]);return severSeamResult;};
const severJoint=(p,name)=>{calls.push(['joint',p.slot,name]);return severJointResult;};
const Body={
  setVelocity(body,v){body.velocity={...v};calls.push(['velocity',body.id,v.x,v.y]);},
  setAngularVelocity(body,v){body.angularVelocity=v;calls.push(['angular',body.id,v]);}
};
const frisbee=api.create({props,puppets,clamp,puppetalkAimProjectPropPoint,puppetalkAimProjectPoint,jointCutPoint,seamCutPoint,severSeam,severJoint,Body});
assert.ok(frisbee?.driveLaserFrisbeeCuts,'Laser frisbee factory failed.');

assert.equal(frisbee.pointSegmentDistance({x:3,y:4},{x:0,y:0},{x:0,y:0}),5);
assert.equal(frisbee.pointSegmentDistance({x:5,y:4},{x:0,y:0},{x:10,y:0}),4);
assert.equal(frisbee.pointSegmentDistance({x:-3,y:4},{x:0,y:0},{x:10,y:0}),5);

function makeFrisbee(overrides={}){
  return {
    id:'f',type:'frisbee',_throwerSlot:0,_depth:0,_cutArmed:true,_thrownAt:0,_frisbeePrev:{x:0,y:0,depth:0},
    heldBy:null,contest:null,attachedTo:null,
    body:{id:'fb',position:{x:10,y:0},velocity:{x:6.1,y:0},angularVelocity:.12,isSensor:true},
    ...overrides
  };
}

props.clear();puppets.clear();calls.length=0;
const ball={id:'b',type:'ball',body:{position:{x:10,y:0}}};
props.set(ball.id,ball);
frisbee.driveLaserFrisbeeCuts(500);
assert.equal(ball._frisbeePrev,undefined,'Non-frisbees must be ignored completely.');

props.clear();calls.length=0;
const unarmed=makeFrisbee({_cutArmed:false,_frisbeePrev:null});
props.set(unarmed.id,unarmed);
frisbee.driveLaserFrisbeeCuts(500);
assert.equal(unarmed._frisbeePrev.x,10,'Frisbee swept-path history must update before armed/held gates.');
assert.equal(calls.length,0);

props.clear();calls.length=0;
const young=makeFrisbee({_thrownAt:450});
props.set(young.id,young);
frisbee.driveLaserFrisbeeCuts(500);
assert.equal(young._cutArmed,true,'A frisbee must not cut inside the frozen 120ms hand-clearance window.');
assert.equal(calls.length,0);

props.clear();calls.length=0;
const slow=makeFrisbee({_thrownAt:0,body:{id:'slowBody',position:{x:10,y:0},velocity:{x:3.49,y:0},angularVelocity:.3,isSensor:true}});
props.set(slow.id,slow);
frisbee.driveLaserFrisbeeCuts(500);
assert.equal(slow._cutArmed,false,'Slow frisbee after 280ms must disarm.');
assert.equal(slow.body.isSensor,false);

props.clear();puppets.clear();calls.length=0;severSeamResult=true;severJointResult=true;
const p={
  slot:0,
  joints:{elbow:{point:{x:5,y:2}}},severedJoints:new Set(),
  seams:{arm:{point:{x:5,y:1}}},brokenSeams:new Set(),seamMeta:{arm:{radius:14}}
};
puppets.set(p.slot,p);
const cutter=makeFrisbee();
props.set(cutter.id,cutter);
frisbee.driveLaserFrisbeeCuts(500);
assert.deepEqual(calls[0],['seam',0,'arm'],'Nearest eligible seam/joint along the swept path must win, including the thrower\'s own puppet.');
assert.equal(cutter._cutArmed,false,'Successful cut must consume the throw.');
assert.equal(cutter.body.isSensor,false);
assert.ok(calls.some(c=>c[0]==='velocity'&&Math.abs(c[2]-4.392)<1e-12&&c[3]===0),'Post-cut linear velocity must retain exactly 72%.');
assert.ok(calls.some(c=>c[0]==='angular'&&Math.abs(c[2]-.066)<1e-12),'Post-cut spin must retain exactly 55%.');

props.clear();puppets.clear();calls.length=0;severSeamResult=true;severJointResult=true;
const p2={
  slot:2,
  joints:{neck:{point:{x:5,y:.5}},old:{point:{x:5,y:0}}},severedJoints:new Set(['old']),
  seams:{broken:{point:{x:5,y:0}}},brokenSeams:new Set(['broken']),seamMeta:{}
};
puppets.set(p2.slot,p2);
const jointCutter=makeFrisbee();
props.set(jointCutter.id,jointCutter);
frisbee.driveLaserFrisbeeCuts(500);
assert.deepEqual(calls[0],['joint',2,'neck'],'Already severed/broken candidates must be skipped.');

props.clear();puppets.clear();calls.length=0;severJointResult=false;
const p3={slot:3,joints:{neck:{point:{x:5,y:0}}},severedJoints:new Set(),seams:null,brokenSeams:null};
puppets.set(p3.slot,p3);
const failed=makeFrisbee();
props.set(failed.id,failed);
frisbee.driveLaserFrisbeeCuts(500);
assert.equal(failed._cutArmed,true,'A failed sever operation must not consume the armed throw.');
assert.equal(failed.body.isSensor,true);
assert.equal(calls.filter(c=>c[0]==='velocity'||c[0]==='angular').length,0);

console.log('Laser frisbee candidate preserves V1 swept geometry, safety/danger gates, nearest seam/joint cutting, self-cuts, one-cut arming and post-cut damping.');
