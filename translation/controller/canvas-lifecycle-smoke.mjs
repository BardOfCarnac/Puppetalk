import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./canvas-lifecycle.js',import.meta.url),'utf8'),context,{filename:'canvas-lifecycle.js'});
const api=context.window.PuppetalkControllerCanvas;
assert.ok(api?.create,'Controller canvas lifecycle candidate did not install.');
assert.equal(api.create(),null,'Incomplete dependencies must fail closed.');

const canvas={width:0,height:0,style:{}};
const stageBox={
  style:{},width:500,height:700,
  getBoundingClientRect(){return {width:this.width,height:this.height};}
};
const transforms=[];
const ctx={setTransform(...args){transforms.push(args);}};
const listeners=[];
const viewportListeners=[];
const timers=[];
const frames=[];
let innerHeight=650;
let dpr=3;
let renders=0;
const lifecycle=api.create({
  canvas,stageBox,ctx,
  getDevicePixelRatio:()=>dpr,
  getInnerHeight:()=>innerHeight,
  addEventListenerFn:(type,handler,opts)=>listeners.push({type,handler,opts}),
  setTimeoutFn:(handler,ms)=>{timers.push({handler,ms});return timers.length;},
  requestFrameFn:handler=>{frames.push(handler);return frames.length;},
  visualViewport:{addEventListener:(type,handler,opts)=>viewportListeners.push({type,handler,opts})}
});
assert.ok(lifecycle?.start,'Controller canvas lifecycle factory failed.');
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:1,ch:1});
lifecycle.setRender(()=>{renders++;});
lifecycle.start();

assert.deepEqual(listeners.map(listener=>listener.type),['resize','orientationchange','puppetalk-stage-viewport','puppetalk-scene-change']);
assert.ok(listeners.every(listener=>listener.opts?.passive===true),'Frozen projection-settle listeners remain passive.');
assert.equal(viewportListeners.length,1);
assert.equal(viewportListeners[0].type,'resize');
assert.equal(viewportListeners[0].opts?.passive,true);
assert.equal(timers.length,1);
assert.equal(timers[0].ms,160,'Frozen delayed projection settle changed.');
assert.equal(frames.length,1,'Frozen double-frame settle must schedule its outer frame.');
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:500,ch:700});
assert.equal(canvas.width,1000,'DPR must remain capped at 2.');
assert.equal(canvas.height,1400);
assert.equal(canvas.style.width,'500px');
assert.equal(canvas.style.height,'700px');
assert.equal(stageBox.style.minHeight,'700px');
assert.deepEqual(transforms.at(-1),[2,0,0,2,0,0]);
assert.equal(renders,1,'Initial resize must redraw the personal scene once.');

stageBox.width=200;
stageBox.height=0;
innerHeight=600;
dpr=1;
listeners.find(listener=>listener.type==='resize').handler();
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:280,ch:600},'Fullscreen controller must fall back to viewport height when the stage has not settled.');
assert.equal(canvas.width,280);
assert.equal(canvas.height,600);
assert.equal(renders,2);

stageBox.width=900;
stageBox.height=200;
lifecycle.resizeCanvas();
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:900,ch:320},'Frozen fullscreen controller minimum height changed.');
assert.equal(canvas.style.width,'900px');
assert.equal(canvas.style.height,'320px');
assert.equal(stageBox.style.minHeight,'320px');
assert.equal(renders,3);

stageBox.height=681;
lifecycle.settleProjection();
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:900,ch:681},'Controller logical height must follow the visible fullscreen stage rather than the pre-patch 430px cap.');
assert.equal(renders,4);

listeners.find(listener=>listener.type==='orientationchange').handler();
assert.equal(timers.at(-1).ms,90,'Orientation settle delay drifted from frozen V1.');

console.log('Controller canvas lifecycle preserves effective V1 fullscreen sizing, DPR cap and projection-settle hooks.');
