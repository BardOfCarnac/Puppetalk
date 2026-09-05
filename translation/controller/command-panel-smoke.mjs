import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./command-panel.js',import.meta.url),'utf8'),context,{filename:'command-panel.js'});
const api=context.window.PuppetalkControllerCommands;
assert.ok(api?.create,'Controller command panel candidate did not install.');

class ClassList{
  constructor(){this.values=new Set();}
  add(v){this.values.add(v);}
  remove(v){this.values.delete(v);}
  toggle(v,on){if(on)this.values.add(v);else this.values.delete(v);}
  has(v){return this.values.has(v);}
}
class El{
  constructor(){this.listeners=new Map();this.dataset={};this.textContent='';this.classList=new ClassList();this.attrs=new Set();}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  fire(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event);}
  hasAttribute(name){return this.attrs.has(name);}
}
const poses=new El(),centreButton=new El(),retry=new El(),rag=new El();
rag.attrs.add('data-rag');rag.textContent='Go limp';
const poseA=new El(),poseB=new El();poseA.dataset.pose='stand';poseB.dataset.pose='cheer';
const elements=new Map([['#poses',poses],['#centre',centreButton],['#retry',retry],['[data-rag]',rag]]);
const document={
  querySelector:s=>elements.get(s)||null,
  querySelectorAll:s=>s==='[data-pose]'?[poseA,poseB]:[]
};
const input={pose:'stand',poseVersion:0,rag:false,grabs:[]};
const activePointers=new Map();
const transmissions=[];
let connectCalls=0;
let centreTimer=null;
let timerId=0;
const timers=new Map();
const cleared=[];
const panel=api.create({
  document,input,activePointers,transmit:force=>transmissions.push([force,JSON.parse(JSON.stringify(input))]),
  connect:()=>{connectCalls++;},getCentreTimer:()=>centreTimer,setCentreTimer:v=>{centreTimer=v;},
  setTimeoutFn:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
  clearTimeoutFn:id=>{cleared.push(id);timers.delete(id);}
});
assert.ok(panel?.install,'Controller command panel factory failed.');
panel.install();
assert.equal(poses.listeners.get('click')?.length,1);
assert.equal(centreButton.listeners.get('click')?.length,1);
assert.equal(retry.listeners.get('click')?.length,1);

// Pose selection resets rag, increments version, activates only selected pose and restores rag label.
input.rag=true;rag.classList.add('active');poseA.classList.add('active');
poses.fire('click',{target:{closest:s=>s==='button'?poseB:null}});
assert.equal(input.pose,'cheer');
assert.equal(input.poseVersion,1);
assert.equal(input.rag,false);
assert.equal(poseA.classList.has('active'),false);
assert.equal(poseB.classList.has('active'),true);
assert.equal(rag.classList.has('active'),false);
assert.equal(rag.textContent,'Go limp');
assert.equal(transmissions.at(-1)[0],true);

// Re-selecting a pose still bumps poseVersion exactly like frozen V1.
poses.fire('click',{target:{closest:s=>s==='button'?poseB:null}});
assert.equal(input.poseVersion,2);

// Rag toggle alternates label and active state without changing pose/version.
poses.fire('click',{target:{closest:s=>s==='button'?rag:null}});
assert.equal(input.rag,true);assert.equal(rag.classList.has('active'),true);assert.equal(rag.textContent,'Recover');
assert.equal(input.pose,'cheer');assert.equal(input.poseVersion,2);
poses.fire('click',{target:{closest:s=>s==='button'?rag:null}});
assert.equal(input.rag,false);assert.equal(rag.classList.has('active'),false);assert.equal(rag.textContent,'Go limp');
const beforeNoop=transmissions.length;
poses.fire('click',{target:{closest:()=>null}});
assert.equal(transmissions.length,beforeNoop);

// Centre action is blocked while any direct pointer is active.
activePointers.set(1,{});
panel.centre();
assert.equal(input.grabs.length,0);assert.equal(timers.size,0);
activePointers.clear();
panel.centre();
assert.deepEqual(JSON.parse(JSON.stringify(input.grabs)),[{part:'torso',x:.5,y:.55}]);
assert.equal(transmissions.at(-1)[0],true);
assert.equal(centreTimer,1);
assert.equal(timers.get(1).ms,150,'Centre pulse must remain 150ms.');

// Re-centering clears the previous timer before scheduling another.
panel.centre();
assert.deepEqual(cleared,[1]);
assert.equal(centreTimer,2);
timers.get(2).fn();
assert.deepEqual(JSON.parse(JSON.stringify(input.grabs)),[]);
assert.equal(transmissions.at(-1)[0],true);
assert.equal(centreTimer,null);

retry.fire('click');
assert.equal(connectCalls,1);

console.log('Controller command panel candidate preserves V1 pose/ragdoll UI semantics, poseVersion bumps, 150ms centre pulse, active-pointer guard and retry dispatch.');
