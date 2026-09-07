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
const stageBox={style:{},width:500,getBoundingClientRect(){return {width:this.width};}};
const transforms=[];
const ctx={setTransform(...args){transforms.push(args);}};
const listeners=[];
let dpr=3;
let renders=0;
const lifecycle=api.create({
  canvas,stageBox,ctx,
  getDevicePixelRatio:()=>dpr,
  addEventListenerFn:(type,handler,opts)=>listeners.push({type,handler,opts})
});
assert.ok(lifecycle?.start,'Controller canvas lifecycle factory failed.');
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:1,ch:1});
lifecycle.setRender(()=>{renders++;});
lifecycle.start();

assert.equal(listeners.length,1);
assert.equal(listeners[0].type,'resize');
assert.equal(listeners[0].opts?.passive,true);
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:500,ch:400});
assert.equal(canvas.width,1000,'DPR must remain capped at 2.');
assert.equal(canvas.height,800);
assert.equal(canvas.style.width,'500px');
assert.equal(canvas.style.height,'400px');
assert.equal(stageBox.style.minHeight,'400px');
assert.deepEqual(transforms.at(-1),[2,0,0,2,0,0]);
assert.equal(renders,1,'Initial resize must redraw the personal scene once.');

stageBox.width=200;
dpr=1;
listeners[0].handler();
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:280,ch:250},'Frozen minimum controller dimensions changed.');
assert.equal(canvas.width,280);
assert.equal(canvas.height,250);
assert.equal(renders,2);

stageBox.width=900;
lifecycle.resizeCanvas();
assert.deepEqual(JSON.parse(JSON.stringify(lifecycle.getDimensions())),{cw:900,ch:430},'Frozen controller height cap changed.');
assert.equal(canvas.style.width,'900px');
assert.equal(canvas.style.height,'430px');
assert.equal(stageBox.style.minHeight,'430px');
assert.equal(renders,3);

console.log('Controller canvas lifecycle preserves frozen sizing, DPR cap, passive resize hook and redraw timing.');
