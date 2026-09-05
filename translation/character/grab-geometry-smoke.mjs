import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/grab-geometry.js','utf8'),context,{filename:'grab-geometry.js'});
const api=context.window.PuppetalkGrabGeometry;
assert.ok(api?.create,'Grab geometry did not install.');

const Vector={
  rotate(v,a){
    const c=Math.cos(a),s=Math.sin(a);
    return {x:v.x*c-v.y*s,y:v.x*s+v.y*c};
  }
};
const geometry=api.create(Vector);
const plain=value=>JSON.parse(JSON.stringify(value));

const body=(x,y,angle=0)=>({position:{x,y},angle});
const p={
  torso:body(100,200,.2),
  head:body(102,140,-.1),
  faL:body(60,205,.3),faL2:body(58,220,.35),
  faR:body(140,205,-.3),faR2:body(142,220,-.35),
  shL:body(82,300,.12),shL2:body(80,320,.16),
  shR:body(118,300,-.12),shR2:body(120,320,-.16)
};

function v1WorldPoint(b,local){
  const r=Vector.rotate(local,b.angle);
  return {x:b.position.x+r.x,y:b.position.y+r.y};
}
function v1GrabBody(part){
  if(part==='head') return p.head;
  if(part==='leftHand') return p.faL2||p.faL;
  if(part==='rightHand') return p.faR2||p.faR;
  if(part==='leftFoot') return p.shL2||p.shL;
  if(part==='rightFoot') return p.shR2||p.shR;
  return p.torso;
}
function v1GrabWorldPoint(part){
  if(part==='pelvis') return v1WorldPoint(p.torso,{x:0,y:34});
  if(part==='leftShoulder') return v1WorldPoint(p.torso,{x:-24,y:-27});
  if(part==='rightShoulder') return v1WorldPoint(p.torso,{x:24,y:-27});
  if(part==='leftHand') return v1WorldPoint(p.faL2||p.faL,{x:0,y:12});
  if(part==='rightHand') return v1WorldPoint(p.faR2||p.faR,{x:0,y:12});
  if(part==='leftFoot') return v1WorldPoint(p.shL2||p.shL,{x:0,y:13.5});
  if(part==='rightFoot') return v1WorldPoint(p.shR2||p.shR,{x:0,y:13.5});
  return v1GrabBody(part).position;
}

assert.deepEqual(plain(geometry.worldPoint(p.torso,{x:13,y:-7})),v1WorldPoint(p.torso,{x:13,y:-7}));
for(const part of ['torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot']){
  assert.equal(geometry.grabBody(p,part),v1GrabBody(part),`grabBody drifted for ${part}`);
  assert.deepEqual(plain(geometry.grabWorldPoint(p,part)),plain(v1GrabWorldPoint(part)),`grabWorldPoint drifted for ${part}`);
}

const fallback={...p,faL2:null,faR2:null,shL2:null,shR2:null};
assert.equal(geometry.grabBody(fallback,'leftHand'),p.faL);
assert.equal(geometry.grabBody(fallback,'rightHand'),p.faR);
assert.equal(geometry.grabBody(fallback,'leftFoot'),p.shL);
assert.equal(geometry.grabBody(fallback,'rightFoot'),p.shR);

console.log('Grab geometry matches frozen V1 body selection and world-point maths.');