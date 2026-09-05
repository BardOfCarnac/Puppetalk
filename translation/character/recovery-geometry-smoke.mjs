import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/recovery-geometry.js','utf8'),context,{filename:'recovery-geometry.js'});
const api=context.window.PuppetalkRecoveryGeometry;
assert.ok(api?.create,'Recovery geometry did not install.');

const Vector={
  rotate(v,a){
    const c=Math.cos(a),s=Math.sin(a);
    return {x:v.x*c-v.y*s,y:v.x*s+v.y*c};
  }
};
const geometry=api.create(Vector);
const plain=value=>JSON.parse(JSON.stringify(value));
const body=(x,y,angle=0)=>({position:{x,y},angle});

function v1JointWorldPoint(constraint,side){
  const b=side==='A'?constraint?.bodyA:constraint?.bodyB;
  const point=side==='A'?constraint?.pointA:constraint?.pointB;
  if(!b||!point)return null;
  const r=Vector.rotate(point,b.angle||0);
  return {x:b.position.x+r.x,y:b.position.y+r.y};
}
function v1JointGap(constraint){
  const a=v1JointWorldPoint(constraint,'A');
  const b=v1JointWorldPoint(constraint,'B');
  return a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
}
function v1JointCutPoint(constraint){
  const a=v1JointWorldPoint(constraint,'A');
  const b=v1JointWorldPoint(constraint,'B');
  if(!a||!b)return null;
  return {x:(a.x+b.x)*.5,y:(a.y+b.y)*.5};
}

for(const constraint of [
  {bodyA:body(100,200,.3),pointA:{x:-14,y:12},bodyB:body(82,250,-.25),pointB:{x:0,y:-14.5}},
  {bodyA:body(0,0,0),pointA:{x:0,y:0},bodyB:body(3,4,0),pointB:{x:0,y:0}},
  {bodyA:body(-20,8,-2.7),pointA:{x:4,y:-9},bodyB:body(32,-14,2.8),pointB:{x:-7,y:2}}
]){
  assert.deepEqual(plain(geometry.jointWorldPoint(constraint,'A')),v1JointWorldPoint(constraint,'A'));
  assert.deepEqual(plain(geometry.jointWorldPoint(constraint,'B')),v1JointWorldPoint(constraint,'B'));
  assert.equal(geometry.jointGap(constraint),v1JointGap(constraint));
  assert.deepEqual(plain(geometry.jointCutPoint(constraint)),v1JointCutPoint(constraint));
  const puppet={seams:{test:constraint}};
  assert.deepEqual(plain(geometry.seamCutPoint(puppet,'test')),v1JointCutPoint(constraint));
}

for(const incomplete of [null,{}, {bodyA:body(0,0),pointA:{x:0,y:0}}]){
  assert.equal(geometry.jointWorldPoint(incomplete,'A')===null,v1JointWorldPoint(incomplete,'A')===null);
  assert.equal(geometry.jointGap(incomplete),Infinity);
  assert.equal(geometry.jointCutPoint(incomplete),null);
}
assert.equal(geometry.seamCutPoint({},'missing'),null);
assert.equal(geometry.seamCutPoint(null,'missing'),null);

console.log('Recovery geometry matches frozen V1 joint points, gaps and cut points.');