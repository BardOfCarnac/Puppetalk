import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/stage/stage-lifecycle.js','utf8'),context,{filename:'stage-lifecycle.js'});
const api=context.window.PuppetalkStageLifecycle;
assert.ok(api?.create,'Stage lifecycle candidate did not install.');

const events=[];
const canvas={width:0,height:0,style:{}};
const ctx={setTransform:(...args)=>events.push(['transform',...args])};
const engine={world:{id:'world'}};
let dimensions={W:1,H:1};
let bounds=[{id:'old-a'},{id:'old-b'}];
let viewport={width:1000,height:700,dpr:3};
let nextBody=0;
const Bodies={
  rectangle:(x,y,w,h,options)=>{
    const body={id:`new-${++nextBody}`,x,y,w,h,options:JSON.parse(JSON.stringify(options))};
    events.push(['rectangle',body.id,x,y,w,h,JSON.stringify(body.options)]);
    return body;
  }
};
const Composite={
  remove:(world,body)=>events.push(['remove',world.id,body.id]),
  add:(world,items)=>events.push(['add',world.id,...items.map(item=>item.id)])
};
const tick=()=>{};
let resizeListener=null;
const lifecycle=api.create({
  canvas,ctx,Bodies,Composite,engine,
  getBounds:()=>bounds,
  setBounds:value=>{bounds=value;events.push(['setBounds',...value.map(item=>item.id)]);},
  setDimensions:(W,H)=>{dimensions={W,H};events.push(['dimensions',W,H]);},
  ensureTestProps:()=>events.push(['seed']),
  installDartImpacts:()=>events.push(['dartImpacts']),
  installPropContactPhysics:()=>events.push(['contactPhysics']),
  tick,
  getViewport:()=>viewport,
  addEventListenerFn:(type,handler,opts)=>{events.push(['listener',type,opts?.passive===true]);resizeListener=handler;},
  requestFrame:callback=>events.push(['frame',callback===tick])
});
assert.ok(lifecycle?.resize && lifecycle?.start,'Stage lifecycle factory failed.');

lifecycle.start();
assert.deepEqual(events,[
  ['listener','resize',true],
  ['dimensions',1000,700],
  ['transform',2,0,0,2,0,0],
  ['remove','world','old-a'],['remove','world','old-b'],
  ['rectangle','new-1',500,710,1160,80,JSON.stringify({isStatic:true,friction:.9})],
  ['rectangle','new-2',500,-22,1160,44,JSON.stringify({isStatic:true,friction:.65})],
  ['rectangle','new-3',-30,350,60,1400,JSON.stringify({isStatic:true})],
  ['rectangle','new-4',1030,350,60,1400,JSON.stringify({isStatic:true})],
  ['setBounds','new-1','new-2','new-3','new-4'],
  ['add','world','new-1','new-2','new-3','new-4'],
  ['seed'],['dartImpacts'],['contactPhysics'],['frame',true]
],'Stage lifecycle startup order or boundary construction drifted from frozen V1.');
assert.equal(resizeListener,lifecycle.resize,'Resize listener must use the same lifecycle resize function.');
assert.deepEqual(dimensions,{W:1000,H:700});
assert.equal(canvas.width,2000);
assert.equal(canvas.height,1400);
assert.equal(canvas.style.width,'1000px');
assert.equal(canvas.style.height,'700px');
assert.equal(bounds.length,4);

events.length=0;
viewport={width:100,height:200,dpr:0};
resizeListener();
assert.deepEqual(dimensions,{W:320,H:360},'Stage viewport minimums drifted from frozen V1.');
assert.equal(canvas.width,320,'Falsy DPR must fall back to 1 like frozen devicePixelRatio || 1.');
assert.equal(canvas.height,360);
assert.equal(canvas.style.width,'320px');
assert.equal(canvas.style.height,'360px');
assert.deepEqual(events.slice(0,6),[
  ['dimensions',320,360],
  ['transform',1,0,0,1,0,0],
  ['remove','world','new-1'],['remove','world','new-2'],['remove','world','new-3'],['remove','world','new-4']
],'Resize must update dimensions/transform before replacing all previous boundaries.');
assert.deepEqual(events.filter(event=>event[0]==='rectangle'),[
  ['rectangle','new-5',160,370,480,80,JSON.stringify({isStatic:true,friction:.9})],
  ['rectangle','new-6',160,-22,480,44,JSON.stringify({isStatic:true,friction:.65})],
  ['rectangle','new-7',-30,180,60,720,JSON.stringify({isStatic:true})],
  ['rectangle','new-8',350,180,60,720,JSON.stringify({isStatic:true})]
],'Stage minimum-size collision walls drifted from frozen V1.');
assert.ok(!events.some(event=>['seed','dartImpacts','contactPhysics','frame'].includes(event[0])),'Resize events must not replay stage startup side effects.');

assert.equal(api.create({}),null,'Incomplete stage lifecycle dependencies must fail closed.');

console.log('Stage lifecycle candidate preserves V1 DPR/minimum sizing, four collision boundaries, replacement order, passive resize listener and startup sequence.');
