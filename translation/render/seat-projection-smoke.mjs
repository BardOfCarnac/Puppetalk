import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./seat-projection.js',import.meta.url),'utf8'),context,{filename:'seat-projection.js'});
const api=context.window.PuppetalkSeatProjection;
assert.ok(api?.create,'Seat projection candidate did not install.');

const depthState={
  scaleForDepth:d=>1+d,
  shiftForDepth:d=>d*.1
};
const tuning={minDepth:-.48,maxDepth:1};
const projection=api.create({getDepthState:()=>depthState,getForegroundTuning:()=>tuning});
assert.ok(projection?.puppetalkSeatProjection,'Seat projection factory failed.');

assert.deepEqual(Array.from(projection.PUPPETALK_SEAT_ORDER),[0,3,1,4,2,5]);
assert.equal(projection.PUPPETALK_DEPTH_X,.28);
assert.ok(projection.PUPPETALK_FOREGROUND_TUNED_KEYS.has('torso'));
assert.ok(projection.PUPPETALK_FOREGROUND_TUNED_KEYS.has('head'));
assert.equal(projection.PUPPETALK_FOREGROUND_TUNED_KEYS.has('segHeadTop'),false,'New seam/segment points remain raw in V1.');
assert.equal(projection.puppetalkSeatAngle(0),0);
assert.ok(Math.abs(projection.puppetalkSeatAngle(1)-Math.PI)<1e-12);
assert.ok(Math.abs(projection.puppetalkSeatAngle(2)-Math.PI/3)<1e-12);
assert.ok(Math.abs(projection.puppetalkSeatAngle(5)-Math.PI*5/3)<1e-12);
assert.ok(Math.abs(projection.puppetalkHomeX(0)-.16)<1e-12);
assert.ok(Math.abs(projection.puppetalkHomeX(5)-.835)<1e-12);

const invalid={x:'bad',y:.2};
assert.equal(projection.puppetalkRawPoint(invalid,{x:.5,y:.5},2,.1),invalid);
assert.equal(projection.puppetalkViewPoint(invalid,{x:.5,y:.5},{x:.4,y:.5},2,.1),invalid);
const raw=projection.puppetalkRawPoint({x:.7,y:.8,a:.2},{x:.5,y:.5},2,.1);
assert.ok(Math.abs(raw.x-.6)<1e-12 && Math.abs(raw.y-.6)<1e-12 && raw.a===.2);
const viewed=projection.puppetalkViewPoint(raw,{x:.5,y:.5},{x:.4,y:.5},2,.1);
assert.ok(Math.abs(viewed.x-.6)<1e-12 && Math.abs(viewed.y-.8)<1e-12 && viewed.a===.2);

const invalidPuppet={slot:0};
const invalidProjected=projection.puppetalkProjectPuppet(invalidPuppet,0);
assert.equal(invalidProjected.puppet,invalidPuppet);
assert.equal(invalidProjected.meta,null);

const home0=projection.puppetalkHomeX(0);
const puppet0={
  slot:0,depth:.2,visualScale:1.2,
  torso:{x:home0+.1,y:.5,a:.1},head:{x:home0+.1,y:.3,a:.2},
  segHeadTop:{x:home0+.14,y:.6,a:.3},name:'Mara'
};
const same=projection.puppetalkProjectPuppet(puppet0,0);
assert.notEqual(same.puppet,puppet0);
assert.ok(Math.abs(same.puppet.depth-.2)<1e-12);
assert.ok(Math.abs(same.puppet.visualScale-1.2)<1e-12);
assert.ok(Math.abs(same.puppet.torso.x-puppet0.torso.x)<1e-12 && Math.abs(same.puppet.torso.y-puppet0.torso.y)<1e-12,'Already foreground-tuned visible points round-trip in the owner view.');
assert.ok(Math.abs(same.puppet.head.x-puppet0.head.x)<1e-12 && Math.abs(same.puppet.head.y-puppet0.head.y)<1e-12);
assert.ok(Math.abs(same.puppet.segHeadTop.x-puppet0.segHeadTop.x)>.001 || Math.abs(same.puppet.segHeadTop.y-puppet0.segHeadTop.y)>.001,'New seam/segment point must not be unscaled before view projection.');
assert.equal(same.meta.slot,0);

const rotated=projection.puppetalkProjectPuppet(puppet0,1);
assert.ok(rotated.puppet.depth>=tuning.minDepth && rotated.puppet.depth<=tuning.maxDepth);
assert.notEqual(rotated.puppet.depth,puppet0.depth,'Different seat rotates forward depth into the viewer frame.');

const puppets=[
  {...puppet0,slot:0,depth:.2,torso:{...puppet0.torso}},
  {...puppet0,slot:1,depth:-.1,torso:{x:projection.puppetalkHomeX(1),y:.5}}
];
const unchangedPuppets=[{slot:0}],unchangedProps=[{id:'p'}];
const noViewer=projection.puppetalkSeatProjection(unchangedPuppets,unchangedProps,null);
assert.equal(noViewer.puppets,unchangedPuppets);
assert.equal(noViewer.props,unchangedProps);

const thrown={id:'throw',type:'ball',x:home0+.1,y:.4,depth:.2,throwerSlot:0};
const projectedThrown=projection.puppetalkProjectProp(thrown,new Map(),0);
assert.ok(Math.abs(projectedThrown.x-thrown.x)<1e-12);
assert.ok(Math.abs(projectedThrown.y-(thrown.y+.02))<1e-12);
assert.ok(Math.abs(projectedThrown.viewDepth-.2)<1e-12);
assert.ok(Math.abs(projectedThrown.viewScale-1.2)<1e-12);

const view=projection.puppetalkSeatProjection(puppets,[thrown],0);
assert.equal(view.puppets.length,2);
assert.ok(view.puppets[0].depth<=view.puppets[1].depth,'Projected puppets stay depth-sorted.');
assert.equal(view.props.length,1);
assert.equal(view.props[0].id,'throw');

// Explicit held/attached ownership is remembered after the prop becomes free.
const ownerPuppet={...puppet0,slot:0,depth:.3,visualScale:1.3,torso:{x:home0+.08,y:.52}};
const ownerMeta=projection.puppetalkProjectPuppet(ownerPuppet,0).meta;
const metaBySlot=new Map([[0,ownerMeta]]);
const held={id:'sticky',x:home0+.12,y:.45,heldBy:{slot:0,hand:'left'}};
const heldProjected=projection.puppetalkProjectProp(held,metaBySlot,0);
assert.notEqual(heldProjected,held);
const free={id:'sticky',x:held.x,y:held.y};
const freeProjected=projection.puppetalkProjectProp(free,metaBySlot,0);
assert.notEqual(freeProjected,free,'Last explicit prop owner remains sticky after release.');
assert.ok(Math.abs(freeProjected.x-heldProjected.x)<1e-12 && Math.abs(freeProjected.y-heldProjected.y)<1e-12);

const attached={id:'anchor',x:home0+.11,y:.46,attachedTo:{slot:0,mode:'balloon',anchor:{x:home0+.08,y:.55}}};
const attachedProjected=projection.puppetalkProjectProp(attached,metaBySlot,0);
assert.notEqual(attachedProjected.attachedTo,attached.attachedTo);
assert.notDeepEqual(JSON.parse(JSON.stringify(attachedProjected.attachedTo.anchor)),attached.attachedTo.anchor,'Attachment anchor is projected with its owner.');

const malformed={id:'bad',x:null,y:.2};
assert.equal(projection.puppetalkProjectProp(malformed,metaBySlot,0),malformed);

console.log('Seat projection candidate preserves V1 six-seat ordering, depth/side rotation, tuned-point undo rules, depth sorting, thrown-prop projection and sticky prop ownership/anchors.');
