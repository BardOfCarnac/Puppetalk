import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/drive-forces.js','utf8'),context,{filename:'drive-forces.js'});
const api=context.window.PuppetalkDriveForces;
assert.ok(api?.create,'Drive-force module did not install.');

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function angleDelta(target,current){
  let d=target-current;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return d;
}
let applied=null;
const Body={applyForce(body,point,force){applied={body,point,force};}};
const forces=api.create({Body,clamp,angleDelta});
const plain=value=>JSON.parse(JSON.stringify(value));

function v1Servo(body,target,strength=.006){
  body.torque += clamp(angleDelta(target,body.angle)*strength-body.angularVelocity*strength*.72,-.028,.028);
}
for(const sample of [
  {angle:.1,angularVelocity:.2,torque:0,target:1.4,strength:.006},
  {angle:3.05,angularVelocity:-.8,torque:.01,target:-3.02,strength:.018},
  {angle:-2.9,angularVelocity:5,torque:-.004,target:2.8,strength:.02}
]){
  const actual={angle:sample.angle,angularVelocity:sample.angularVelocity,torque:sample.torque};
  const expected={...actual};
  forces.servo(actual,sample.target,sample.strength);
  v1Servo(expected,sample.target,sample.strength);
  assert.equal(actual.torque,expected.torque,'servo torque drifted from frozen V1.');
}

function v1Spring(body,point,target,stiffness,damping=.003){
  const mass=Math.max(.2,body.mass||1);
  return {
    x:((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,
    y:((target.y-point.y)*stiffness-body.velocity.y*damping)*mass
  };
}
for(const sample of [
  {body:{mass:1.3,velocity:{x:2,y:-1}},point:{x:20,y:30},target:{x:80,y:10},stiffness:.0012,damping:.0026},
  {body:{mass:.05,velocity:{x:-4,y:3}},point:{x:50,y:60},target:{x:45,y:90},stiffness:.003,damping:.003},
  {body:{mass:2.1,velocity:{x:0,y:0}},point:{x:0,y:0},target:{x:-12,y:44},stiffness:.00085,damping:.0019}
]){
  applied=null;
  forces.springPull(sample.body,sample.point,sample.target,sample.stiffness,sample.damping);
  assert.equal(applied.body,sample.body);
  assert.equal(applied.point,sample.point);
  assert.deepEqual(plain(applied.force),v1Spring(sample.body,sample.point,sample.target,sample.stiffness,sample.damping),'springPull force drifted from frozen V1.');
}

console.log('Drive force helpers match frozen V1 servo and spring calculations.');