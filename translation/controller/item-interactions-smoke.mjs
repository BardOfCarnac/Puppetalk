import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./item-interactions.js',import.meta.url),'utf8'),context,{filename:'item-interactions.js'});
const api=context.window.PuppetalkControllerItems;
assert.ok(api?.create,'Controller item interactions candidate did not install.');

class El{
  constructor(){this.textContent='';this.disabled=false;this.listeners=new Map();}
  addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,options});this.listeners.set(type,list);}
  fire(type,event={}){for(const entry of this.listeners.get(type)||[])entry.fn(event);}
}
const special=new El(),left=new El(),right=new El();
const document={querySelector:s=>s==='#special-item'?special:s==='#grip-left'?left:s==='#grip-right'?right:null};
const canvas=new El();
canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:500});
let slot=null;
let conn={open:true};
let propScene=[];
let scene=[];
const sent=[];
let saved=null;
const storage={getItem:key=>{assert.equal(key,'puppetalk-special-item');return saved;}};
const seatProjection=(puppets,props,viewer)=>({puppets,props,viewer});
const mine={wl:{x:.4,y:.5},wr:{x:.6,y:.5},al:{x:.45,y:.8},ar:{x:.55,y:.8}};
const controller=api.create({
  document,canvas,send:(target,msg)=>sent.push([target,JSON.parse(JSON.stringify(msg))]),
  getConn:()=>conn,getSlot:()=>slot,getPropScene:()=>propScene,getScene:()=>scene,
  getDimensions:()=>({cw:1000,ch:500}),getMyPuppet:()=>mine,seatProjection,
  displayPoint:(q,w,h)=>({x:q.x*w,y:q.y*h}),storage
});
assert.ok(controller?.installPropTap,'Controller item interactions factory failed.');

assert.equal(controller.controllerSpecialType(),null,'Null slot with no saved choice must have no special item.');
saved='pump';
assert.equal(controller.controllerSpecialType(),'pump','Saved valid special item must win before slot fallback.');
saved='invalid';slot=0;
assert.equal(controller.controllerSpecialType(),'frisbee');
slot=3;assert.equal(controller.controllerSpecialType(),'dart');
slot=5;assert.equal(controller.controllerSpecialType(),'pump');
assert.equal(controller.controllerSpecialLabel('frisbee'),'Laser frisbee');
assert.equal(controller.controllerSpecialLabel('pump'),'Balloon pump');
assert.equal(controller.controllerSpecialLabel('ball'),'Ball');
assert.equal(controller.controllerSpecialLabel('dart'),'Sticky darts');
assert.equal(controller.controllerSpecialLabel('other'),'Item');

slot=null;saved='invalid';
controller.updateSpecialItemButton(false);
assert.equal(special.textContent,'Special item');
assert.equal(special.disabled,true);
slot=2;
controller.updateSpecialItemButton(false);
assert.equal(special.textContent,'Bring out Ball');
assert.equal(special.disabled,false);
controller.updateSpecialItemButton(true);
assert.equal(special.textContent,'Ball is out');
assert.equal(special.disabled,true);

sent.length=0;
controller.bringOutMySpecialItem();
assert.deepEqual(sent.at(-1),[conn,{type:'special-item',action:'bring-out',item:'ball'}]);
conn={open:false};controller.bringOutMySpecialItem();assert.equal(sent.length,1);
conn={open:true};slot=null;controller.bringOutMySpecialItem();assert.equal(sent.length,1);

slot=1;
propScene=[
  {id:'a',heldBy:{slot:1,hand:'left'}},
  {id:'b',heldBy:{slot:2,hand:'right'}}
];
assert.equal(controller.heldProp('left').id,'a');
assert.equal(controller.heldProp('right'),undefined);
controller.updateGripButtons();
assert.equal(left.textContent,'Drop L');
assert.equal(right.textContent,'Grip R');
sent.length=0;
controller.toggleGrip('right');
assert.deepEqual(sent.at(-1),[conn,{type:'prop',action:'toggleGrip',hand:'right'}]);

propScene=[
  {id:'far',type:'ball',x:.1,y:.1},
  {id:'near',type:'ball',x:.5,y:.5}
];
let event={clientX:500,clientY:250};
assert.equal(controller.pickTappedProp(event).id,'near');
assert.equal(controller.pickTappedProp({clientX:900,clientY:450}),null);

const closeBall={id:'ball',type:'ball',x:.42,y:.5};
assert.equal(controller.nearestPropHand(closeBall),'left');
const farBall={id:'farball',type:'ball',x:.1,y:.1};
assert.equal(controller.nearestPropHand(farBall),null,'Ordinary prop reach must remain 88px.');
const frisbee={id:'disc',type:'frisbee',x:.5,y:.7};
assert.equal(controller.nearestPropHand(frisbee),'leftFoot','Frisbee uses frozen 118px reach.');

function tapEvent(x,y){return {clientX:x,clientY:y,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};}
slot=1;conn={open:true};sent.length=0;
propScene=[{id:'pump',type:'pump',x:.5,y:.5}];
event=tapEvent(500,250);controller.handlePropTap(event);
assert.equal(event.prevented,true);assert.equal(event.stopped,true);
assert.deepEqual(sent.at(-1),[conn,{type:'prop',action:'pump',propId:'pump'}]);

sent.length=0;propScene=[{id:'bal',type:'balloon',x:.5,y:.5,attachedTo:{mode:'pump'}}];
event=tapEvent(500,250);controller.handlePropTap(event);
assert.deepEqual(sent.at(-1),[conn,{type:'prop',action:'release-pump-balloon',propId:'bal'}]);

sent.length=0;propScene=[{id:'held',type:'ball',x:.4,y:.5,heldBy:{slot:1,hand:'left'}}];
event=tapEvent(400,250);controller.handlePropTap(event);
assert.equal(sent.length,0,'Tapping a prop already held by this slot must fall through to puppet grabbing.');
assert.equal(event.prevented,false);assert.equal(event.stopped,false);

sent.length=0;propScene=[{id:'free',type:'ball',x:.42,y:.5}];
event=tapEvent(420,250);controller.handlePropTap(event);
assert.deepEqual(sent.at(-1),[conn,{type:'prop',action:'tap',propId:'free',hand:'left'}]);
assert.equal(event.prevented,true);assert.equal(event.stopped,true);

controller.installPropTap();
const tapListeners=canvas.listeners.get('pointerdown');
assert.equal(tapListeners.length,1);
assert.equal(tapListeners[0].options,true,'Prop tap listener must preserve frozen capture=true registration.');
controller.installButtons();
assert.equal(special.listeners.get('click')?.length,1);
assert.equal(left.listeners.get('click')?.length,1);
assert.equal(right.listeners.get('click')?.length,1);

sent.length=0;slot=1;special.fire('click');
assert.equal(sent.at(-1)[1].type,'special-item');
left.fire('click');
assert.deepEqual(sent.at(-1),[conn,{type:'prop',action:'toggleGrip',hand:'left'}]);

console.log('Controller item interactions candidate preserves V1 special-item fallback/labels, grip state/actions, prop hit radii/reach and captured pump/balloon/grip tap semantics.');
