import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/rig-core.js','utf8'),context,{filename:'rig-core.js'});
const core=context.window.PuppetalkCharacterRigCore;
assert.ok(core,'Rig core did not install.');
const plain=value=>JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(core.POSES),{
  stand:[.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:[1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:[2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:[1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch:[.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
});
assert.deepEqual([...core.GRAB_PARTS],[
  'torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot'
]);

for(const [part,value] of Object.entries({torso:1,pelvis:.92,leftShoulder:.82,rightShoulder:.82,head:.72,leftHand:.42,rightHand:.42,leftFoot:.3,rightFoot:.3})){
  assert.equal(core.rootFollow(part),value,`rootFollow drifted for ${part}`);
}

const puppet={pose:'stand',poseVersion:0,torso:{position:{x:100,y:200}}};
const rig=core.ensureRig(puppet);
assert.equal(rig.lastPose,'stand');
assert.equal(rig.lastPoseVersion,0);
assert.deepEqual(plain(rig.pins),{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null});
assert.equal(core.ensureRig(puppet),rig,'ensureRig must reuse existing rig state.');
rig.pins.head={x:1,y:2};
core.resetPins(rig);
assert.deepEqual(plain(rig.pins),{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null});

function v1AntiTangle(part,desired,age){
  if(!(part.includes('Hand')||part.includes('Foot'))) return desired;
  const t=puppet.torso.position;
  let clear=desired;
  if(part==='leftHand') clear={x:t.x-54,y:t.y+4};
  if(part==='rightHand') clear={x:t.x+54,y:t.y+4};
  if(part==='leftFoot') clear={x:t.x-23,y:t.y+132};
  if(part==='rightFoot') clear={x:t.x+23,y:t.y+132};
  const fade=1-Math.max(0,Math.min(1,age/190));
  const amount=.3*fade;
  return {x:desired.x+(clear.x-desired.x)*amount,y:desired.y+(clear.y-desired.y)*amount};
}
for(const part of ['torso','head','leftHand','rightHand','leftFoot','rightFoot']){
  for(const age of [0,70,190,400]){
    const desired={x:160,y:250};
    assert.deepEqual(plain(core.antiTangleTarget(puppet,part,desired,age)),v1AntiTangle(part,desired,age),`antiTangleTarget drifted for ${part} at ${age}`);
  }
}

console.log('Character rig core matches frozen V1 constants and helper behaviour.');