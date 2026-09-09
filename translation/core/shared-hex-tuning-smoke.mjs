import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let clock=1000;
const root={
  innerWidth:900,innerHeight:600,
  performance:{now:()=>clock},
  Event:class Event{constructor(type){this.type=type;}},
  dispatchEvent:()=>{},
  PuppetalkPropState:{create:()=>({propState:p=>({id:p.id,x:.5,y:.5})})},
  PuppetalkPropDriver:{create:()=>({driveProps(){}})},
  PuppetalkDepthAssist:{create:()=>({puppetalkAssistSegmentDistance(){return 0;}})}
};
const context={window:root,globalThis:root,Map,Set,Math,Number,Date,Object,Array};
for(const file of ['shared-hex-space.js','shared-hex-integration.js','shared-hex-tuning.js']){
  vm.runInNewContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context,{filename:file});
}

assert.equal(root.PuppetalkSharedHexTuning?.active,true);
assert.deepEqual(Array.from(root.PuppetalkDepthSystem.tuning.planes),[-1,-.5,-.25,0,.25,.5,1]);
assert.deepEqual(Array.from(root.PuppetalkDepthSystem.playableDepths),[-.84,-.5,-.25,0,.25,.5,.84]);
assert.equal(root.PuppetalkDepthSystem.shiftForDepth(-.84),0);
assert.equal(root.PuppetalkDepthSystem.shiftForDepth(.84),0);

const scales=root.PuppetalkDepthSystem.playableDepths.map(d=>root.PuppetalkDepthSystem.scaleForDepth(d));
assert.ok(Math.abs(scales[0]-.90)<1e-9);
assert.ok(Math.abs(scales[3]-1)<1e-9);
assert.ok(Math.abs(scales[6]-1.10)<1e-9);
for(let i=1;i<scales.length;i++){
  assert.ok(Math.abs((scales[i]-scales[i-1])-(.20/6))<1e-9,'Each logical depth field should change size by the same amount.');
}

const stage=root.PuppetalkDepthSystem.createStage({now:()=>clock});
for(let i=0;i<3;i++) assert.equal(stage.stepDepth(0,1),true);
assert.equal(stage.getPlaneForSlot(0),6);
for(let i=0;i<10;i++){clock+=150;stage.getDepthForSlot(0);}
assert.ok(Math.abs(stage.getDepthForSlot(0)-.84)<.01,'Nearest logical field should settle inside the degenerate vertex.');

const raw={slot:0,torso:{x:.18,y:.55},head:{x:.18,y:.40}};
const tuned=stage.tunePuppet(raw,clock);
assert.ok(Math.abs(tuned.torso.y-raw.torso.y)<1e-12,'Depth must never vertically shift the torso root.');

root.PuppetalkDepthState=stage;
const projection=root.PuppetalkSeatProjection.create({getDepthState:()=>stage});
for(const x of [.08,.5,.92]){
  const p={slot:0,depth:stage.getDepthForSlot(0),visualScale:stage.scaleForDepth(stage.getDepthForSlot(0)),torso:{x,y:.55},head:{x,y:.40}};
  const own=projection.puppetalkProjectPuppet(p,0).puppet;
  assert.ok(Math.abs(own.torso.x-x)<1e-7,'Extreme field must retain lateral owner-screen movement instead of collapsing to the centre.');
}

while(stage.getPlaneForSlot(0)>0) stage.stepDepth(0,-1);
for(let i=0;i<14;i++){clock+=150;stage.getDepthForSlot(0);}
assert.ok(Math.abs(stage.getDepthForSlot(0)+.84)<.01,'Furthest logical field should also remain inset and playable.');
for(const x of [.08,.5,.92]){
  const d=stage.getDepthForSlot(0);
  const p={slot:0,depth:d,visualScale:stage.scaleForDepth(d),torso:{x,y:.55},head:{x,y:.40}};
  const own=projection.puppetalkProjectPuppet(p,0).puppet;
  assert.ok(Math.abs(own.torso.x-x)<1e-7,'Far extreme field must retain lateral owner-screen movement.');
}

console.log('Shared hex tuning keeps both extreme fields horizontally playable, uses even shallow scale increments, and removes vertical depth feedback from the torso.');
