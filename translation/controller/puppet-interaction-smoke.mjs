import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{innerHeight:1000}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./puppet-interaction.js',import.meta.url),'utf8'),context,{filename:'puppet-interaction.js'});
const api=context.window.PuppetalkControllerPuppetry;
assert.ok(api?.create,'Direct puppet interaction candidate did not install.');

class ClassList{
  constructor(){this.values=new Set(['quiet']);}
  add(v){this.values.add(v);}
  remove(v){this.values.delete(v);}
  has(v){return this.values.has(v);}
}
class Canvas{
  constructor(){this.listeners=new Map();this.captures=[];}
  getBoundingClientRect(){return {left:10,top:20,width:1000,height:500};}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  setPointerCapture(id){this.captures.push(id);}
}
const canvas=new Canvas();
const ctxCalls=[];
const ctx={
  save(){ctxCalls.push(['save']);},restore(){ctxCalls.push(['restore']);},beginPath(){ctxCalls.push(['begin']);},
  arc(...args){ctxCalls.push(['arc',...args]);},fill(){ctxCalls.push(['fill']);},stroke(){ctxCalls.push(['stroke']);},
  set fillStyle(v){ctxCalls.push(['fillStyle',v]);},set strokeStyle(v){ctxCalls.push(['strokeStyle',v]);},set lineWidth(v){ctxCalls.push(['lineWidth',v]);}
};
const hint={textContent:'',classList:new ClassList()};
const input={grabs:[]};
let slot=1;
const puppet={
  slot:1,head:{x:.5,y:.2},sl:{x:.4,y:.35},sr:{x:.6,y:.35},wl:{x:.3,y:.5},wr:{x:.7,y:.5},
  al:{x:.43,y:.85},ar:{x:.57,y:.85},hl:{x:.46,y:.62},hr:{x:.54,y:.62},torso:{x:.5,y:.48}
};
const other={...puppet,slot:2,head:{x:.25,y:.2}};
let scene=[other,puppet];
let props=[{id:'prop'}];
const renderCalls=[];
const transmitCalls=[];
let centreCancels=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const controller=api.create({
  canvas,ctx,hint,input,clamp,getScene:()=>scene,getPropScene:()=>props,getSlot:()=>slot,getDimensions:()=>({cw:1000,ch:500}),
  drawBackdrop:(...args)=>renderCalls.push(['backdrop',args[1],args[2]]),
  seatProjection:(puppets,projectedProps,viewer)=>({puppets,props:projectedProps,viewer}),
  drawProp:(c,p,w,h)=>renderCalls.push(['prop',p.id,w,h]),
  drawAnatomy:(c,p,w,h,highlight,alpha)=>renderCalls.push(['puppet',p.slot,highlight,alpha]),
  transmit:force=>transmitCalls.push(force),cancelCentre:()=>{centreCancels++;}
});
assert.ok(controller?.install,'Direct puppet interaction factory failed.');

const spots=controller.grabSpots(puppet);
assert.equal(spots.length,9);
assert.deepEqual(JSON.parse(JSON.stringify(spots.map(s=>[s.part,s.r]))),[
  ['head',40],['leftShoulder',31],['rightShoulder',31],['leftHand',32],['rightHand',32],
  ['leftFoot',32],['rightFoot',32],['pelvis',42],['torso',50]
]);
const pelvis=spots.find(s=>s.part==='pelvis').q;
assert.ok(Math.abs(pelvis.x-.5)<1e-12 && Math.abs(pelvis.y-.62)<1e-12);
assert.equal(controller.grabSpots(null).length,0);
assert.equal(controller.myPuppet(),puppet);
slot=5;assert.equal(controller.myPuppet(),undefined);slot=1;

assert.deepEqual(JSON.parse(JSON.stringify(controller.pointerToWorld({clientX:-100,clientY:900}))),{x:.02,y:.94});
assert.deepEqual(JSON.parse(JSON.stringify(controller.pointerToWorld({clientX:510,clientY:270}))),{x:.5,y:.5});

renderCalls.length=0;ctxCalls.length=0;
controller.renderPersonalScene();
assert.deepEqual(renderCalls,[['backdrop',1000,500],['prop','prop',1000,500],['puppet',2,false,.48],['puppet',1,true,1]]);
assert.equal(ctxCalls.filter(c=>c[0]==='arc').length,9,'Own puppet render must draw all nine grab handles.');

let event={pointerId:11,clientX:510,clientY:120,prevented:false,preventDefault(){this.prevented=true;}};
const picked=controller.pickGrab(event);
assert.equal(picked.part,'head');
controller.pointerDown(event);
assert.equal(event.prevented,true);
assert.equal(centreCancels,1);
assert.deepEqual(canvas.captures,[11]);
assert.equal(controller.activePointers.size,1);
assert.deepEqual(JSON.parse(JSON.stringify(input.grabs)),[{part:'head',x:.5,y:.2,screenY:.12}]);
assert.equal(hint.textContent,'Holding head');
assert.equal(hint.classList.has('quiet'),false);
assert.equal(transmitCalls.at(-1),true);

assert.notEqual(controller.pickGrab({clientX:510,clientY:120})?.part,'head');

const move={pointerId:11,clientX:610,clientY:170,prevented:false,preventDefault(){this.prevented=true;}};
controller.pointerMove(move);
assert.equal(move.prevented,true);
assert.ok(Math.abs(controller.activePointers.get(11).x-.6)<1e-12);
assert.ok(Math.abs(controller.activePointers.get(11).y-.3)<1e-12);
assert.ok(Math.abs(controller.activePointers.get(11).screenY-.17)<1e-12);
assert.deepEqual(JSON.parse(JSON.stringify(input.grabs)),[{part:'head',x:.6,y:.3,screenY:.17}]);
assert.deepEqual(transmitCalls.at(-1),undefined,'Pointer move must use normal deduplicated transmit().');

let second={pointerId:12,clientX:310,clientY:270,preventDefault(){}};
controller.pointerDown(second);
assert.equal(controller.activePointers.size,2);
assert.equal(input.grabs.length,2);
assert.ok(Math.abs(input.grabs[1].screenY-.27)<1e-12);
const beforeThird=centreCancels;
controller.pointerDown({pointerId:13,clientX:710,clientY:270,preventDefault(){}});
assert.equal(controller.activePointers.size,2,'Frozen controller accepts at most two simultaneous grabs.');
assert.equal(centreCancels,beforeThird,'Third pointer must return before cancelling centre motion.');

controller.stopPointer({pointerId:11});
assert.equal(controller.activePointers.size,1);
assert.equal(hint.textContent,'Holding left hand');
assert.equal(hint.classList.has('quiet'),false);
assert.equal(transmitCalls.at(-1),true);
controller.stopPointer({pointerId:12});
assert.equal(controller.activePointers.size,0);
assert.deepEqual(JSON.parse(JSON.stringify(input.grabs)),[]);
assert.equal(hint.textContent,'Grab another part, or choose a pose');
assert.equal(hint.classList.has('quiet'),true);
assert.equal(transmitCalls.at(-1),true);

const countBefore=transmitCalls.length;
controller.pointerMove({pointerId:99,clientX:0,clientY:0,preventDefault(){throw new Error('inactive move should not prevent');}});
controller.stopPointer({pointerId:99});
assert.equal(transmitCalls.length,countBefore);

controller.install();
for(const type of ['pointerdown','pointermove','pointerup','pointercancel']) assert.equal(canvas.listeners.get(type)?.length,1,`Missing ${type} listener.`);

console.log('Direct puppet interaction candidate preserves V1 nine-point grab geometry, handle rendering, personal-scene ordering, coordinate clamps, viewport screenY metadata, two-pointer limit and pointer grab/move/release lifecycle.');
