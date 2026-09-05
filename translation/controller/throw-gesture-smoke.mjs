import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./throw-gesture.js',import.meta.url),'utf8'),context,{filename:'throw-gesture.js'});
const api=context.window.PuppetalkControllerThrowGesture;
assert.ok(api?.create,'Controller throw gesture candidate did not install.');
assert.equal(api.THROW_SAMPLE_MS,145);
assert.equal(api.THROW_MIN_SPEED,.62);

const listeners=new Map();
const canvas={addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);}};
const activePointers=new Map();
const held=new Set();
const sent=[];
let conn={open:true},slot=2,clock=1000;
const pointerToWorld=event=>({x:event.x,y:event.y});
const queue=[];
const system=api.create({
  canvas,activePointers,
  heldProp:hand=>held.has(hand)?{id:hand}:null,
  pointerToWorld,getConn:()=>conn,getSlot:()=>slot,
  send:(c,msg)=>sent.push([c,msg]),now:()=>clock,queueTask:fn=>queue.push(fn)
});
assert.ok(system?.install,'Throw gesture factory failed.');

assert.equal(system.handForGrabPart('leftHand'),'left');
assert.equal(system.handForGrabPart('rightHand'),'right');
assert.equal(system.handForGrabPart('leftFoot'),'leftFoot');
assert.equal(system.handForGrabPart('rightFoot'),'rightFoot');
assert.equal(system.handForGrabPart('torso'),null);

const gesture={samples:[{x:0,y:0,t:0},{x:1,y:0,t:700}]};
system.sampleThrowGesture(gesture,2,0,1000);
assert.deepEqual(gesture.samples.map(s=>s.t),[700,1000],'Sampling must prune stale points only while more than two samples remain.');
for(let i=0;i<12;i++) system.sampleThrowGesture(gesture,i,0,1010+i);
assert.equal(gesture.samples.length,10,'Throw history must retain at most ten samples.');

const vectorGesture={samples:[{x:0,y:0,t:700},{x:.2,y:.1,t:900}]};
const v=system.releaseVector(vectorGesture,.4,.2,1000);
assert.ok(Math.abs(v.vx-2)<1e-12 && Math.abs(v.vy-1)<1e-12,'Release vector must use the oldest sample inside the frozen 145ms window.');
const tinyDt={samples:[{x:0,y:0,t:999}]};
const fast=system.releaseVector(tinyDt,.035,0,1000);
assert.ok(Math.abs(fast.vx-1)<1e-12,'Release vector must clamp dt to at least 35ms.');

system.install();
assert.deepEqual([...listeners.keys()],['pointerdown','pointermove','pointerup','pointercancel']);
assert.equal(listeners.get('pointerdown').length,1);

// Pointerdown is deliberately deferred by a microtask so the ordinary puppet grab handler runs first.
activePointers.set(9,{part:'leftHand',x:.1,y:.2});
held.add('left');
listeners.get('pointerdown')[0]({pointerId:9});
assert.equal(system.throwGestures.has(9),false,'Throw tracking must not begin synchronously on pointerdown.');
assert.equal(queue.length,1);
queue.shift()();
assert.equal(system.throwGestures.get(9).hand,'left');
assert.deepEqual(JSON.parse(JSON.stringify(system.throwGestures.get(9).samples)),[{x:.1,y:.2,t:1000}]);

clock=1100;
listeners.get('pointermove')[0]({pointerId:9,x:.2,y:.2});
assert.equal(system.throwGestures.get(9).samples.length,2);
clock=1140;
listeners.get('pointerup')[0]({pointerId:9,x:.3,y:.2});
assert.equal(system.throwGestures.has(9),false);
assert.equal(sent.length,1);
assert.equal(sent[0][0],conn);
assert.equal(sent[0][1].type,'prop');
assert.equal(sent[0][1].action,'throw');
assert.equal(sent[0][1].hand,'left');
assert.ok(Math.abs(sent[0][1].vx-(.2/.14))<1e-12);
assert.equal(sent[0][1].vy,0);

// Slow release is consumed but not sent.
activePointers.set(10,{part:'rightHand',x:.4,y:.4});held.add('right');clock=2000;
listeners.get('pointerdown')[0]({pointerId:10});queue.shift()();
clock=2140;
listeners.get('pointerup')[0]({pointerId:10,x:.45,y:.4});
assert.equal(system.throwGestures.has(10),false);
assert.equal(sent.length,1,'Releases below .62 normalized units/s must not send a throw.');

// Losing the prop, connection or slot before release prevents dispatch.
for(const [id,mutate] of [
  [11,()=>held.delete('left')],
  [12,()=>{conn={open:false};}],
  [13,()=>{conn={open:true};slot=null;}]
]){
  activePointers.set(id,{part:'leftHand',x:0,y:0});held.add('left');conn={open:true};slot=2;clock=3000+id;
  listeners.get('pointerdown')[0]({pointerId:id});queue.shift()();
  mutate();clock+=100;
  listeners.get('pointerup')[0]({pointerId:id,x:.2,y:0});
  assert.equal(system.throwGestures.has(id),false);
}
assert.equal(sent.length,1);

activePointers.set(14,{part:'rightFoot',x:0,y:0});held.add('rightFoot');clock=4000;
listeners.get('pointerdown')[0]({pointerId:14});queue.shift()();
assert.equal(system.throwGestures.has(14),true);
listeners.get('pointercancel')[0]({pointerId:14});
assert.equal(system.throwGestures.has(14),false,'Pointer cancellation must discard the pending throw.');

console.log('Controller throw gesture candidate preserves V1 deferred hand capture, 145ms sampling, 35ms dt floor, .62 release gate and prop throw dispatch/cancellation semantics.');
