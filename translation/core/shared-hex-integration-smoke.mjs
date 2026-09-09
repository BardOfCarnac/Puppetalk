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
vm.runInNewContext(fs.readFileSync(new URL('./shared-hex-space.js',import.meta.url),'utf8'),context,{filename:'shared-hex-space.js'});
vm.runInNewContext(fs.readFileSync(new URL('./shared-hex-integration.js',import.meta.url),'utf8'),context,{filename:'shared-hex-integration.js'});

assert.equal(root.PuppetalkSharedHexIntegration?.active,true);
assert.deepEqual(Array.from(root.PuppetalkDepthSystem.tuning.planes),[-1,-.5,-.25,0,.25,.5,1]);
assert.equal(root.PuppetalkDepthState.getPlaneForSlot(0),3);
assert.equal(root.PuppetalkDepthState.stepDepth(0,1),true);
assert.equal(root.PuppetalkDepthState.getPlaneForSlot(0),4);
for(let i=0;i<8;i++){clock+=150;root.PuppetalkDepthState.getDepthForSlot(0);}
assert.ok(Math.abs(root.PuppetalkDepthState.getDepthForSlot(0)-.25)<.01);

const projection=root.PuppetalkSeatProjection.create({getDepthState:()=>root.PuppetalkDepthState});
const p={slot:0,depth:.5,visualScale:1.79,torso:{x:.18,y:.55},head:{x:.18,y:.4}};
const own=projection.puppetalkProjectPuppet(p,0).puppet;
assert.ok(Math.abs(own.torso.x-p.torso.x)<1e-7,'Owner flattening should preserve the raw horizontal control position.');
const opposite=projection.puppetalkProjectPuppet(p,1).puppet;
assert.ok(opposite.depth<0,'Opposite side should see positive owner depth as negative depth.');
assert.ok(Number.isFinite(opposite.worldX)&&Number.isFinite(opposite.worldY));

const sharedWorld={x:.2,y:.1};
const prop={id:'f',x:.5,y:.42,worldX:sharedWorld.x,worldY:sharedWorld.y};
const a=projection.puppetalkProjectProp(prop,new Map(),0);
const b=projection.puppetalkProjectProp(prop,new Map(),2);
assert.ok(a.x!==b.x||a.viewDepth!==b.viewDepth,'One world-space prop must flatten differently from different sides.');

console.log('Shared hex integration installs seven-plane depth and canonical six-view puppet/prop projection without replacing higher-level Puppetalk systems.');
