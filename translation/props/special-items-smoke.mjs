import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./special-items.js',import.meta.url),'utf8'),context,{filename:'special-items.js'});
const api=context.window.PuppetalkSpecialItems;
assert.ok(api?.create,'Special item candidate did not install.');
assert.deepEqual(Array.from(api.SPECIAL_ITEM_TYPES),['frisbee','pump','ball','dart']);
assert.deepEqual(Array.from(api.SPECIAL_ITEM_BY_SLOT),['frisbee','pump','ball','dart','frisbee','pump']);

const specialItems=new Map(),props=new Map(),puppets=new Map(),conns=new Map([[0,{id:'c0'}],[1,{id:'c1'}],[2,{id:'c2'}]]);
const calls=[];
let nextId=1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const send=(conn,msg)=>calls.push(['send',conn?.id,JSON.parse(JSON.stringify(msg))]);
const makeProp=(type,x,y)=>{
  const prop={id:'p'+nextId++,type,x,y};
  props.set(prop.id,prop);
  calls.push(['make',type,x,y,prop.id]);
  return prop;
};
const grabWorldPoint=(p,part)=>{
  assert.equal(part,'rightHand');
  return {...p.rightHand};
};
const getDimensions=()=>({W:900,H:650});

puppets.set(0,{torso:{position:{x:180,y:320}},rightHand:{x:240,y:275}});
puppets.set(1,{torso:{position:{x:100,y:300}},rightHand:{x:80,y:260}});
puppets.set(2,{torso:{position:{x:880,y:300}},rightHand:{x:895,y:40}});

const special=api.create({specialItems,props,puppets,conns,send,makeProp,grabWorldPoint,clamp,getDimensions});
assert.ok(special?.handleSpecialItemInput,'Special item factory failed.');

assert.equal(special.specialItemLabel('frisbee'),'Laser frisbee');
assert.equal(special.specialItemLabel('pump'),'Balloon pump');
assert.equal(special.specialItemLabel('ball'),'Ball');
assert.equal(special.specialItemLabel('dart'),'Sticky darts');
assert.equal(special.specialItemLabel('nope'),'Item');

assert.equal(special.specialItemType(0), 'frisbee');
assert.equal(special.specialItemType(1), 'pump');
assert.equal(special.specialItemType(2), 'ball');
assert.equal(special.specialItemType(3), 'dart');
assert.equal(special.specialItemType(6), 'frisbee');
assert.equal(special.specialItemType(5,'dart'), 'dart');
assert.equal(special.specialItemType(-4), 'frisbee');

let result=special.bringOutSpecialItem(9,'ball');
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,message:'Your puppet is not ready yet.'});

result=special.bringOutSpecialItem(0,'ball');
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,type:'ball',propId:'p1',message:'Brought out Ball.'});
assert.deepEqual(calls.find(c=>c[0]==='make'&&c[4]==='p1'),['make','ball',274,267,'p1']);
assert.equal(props.get('p1').specialOwner,0);
assert.equal(specialItems.get(0),'p1');
assert.equal(special.specialItemStillOut(0),true);

result=special.bringOutSpecialItem(0,'dart');
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,alreadyOut:true,type:'dart',message:'Sticky darts is already out.'});
props.delete('p1');
assert.equal(special.specialItemStillOut(0),false,'Missing prop must make the ownership slot available again.');

result=special.bringOutSpecialItem(1,'pump');
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,type:'pump',propId:'p2',message:'Brought out Balloon pump.'});
assert.deepEqual(calls.find(c=>c[0]==='make'&&c[4]==='p2'),['make','pump',52,582,'p2'],'Pump spawn must preserve V1 floor placement and x clamp.');

result=special.bringOutSpecialItem(2,'dart');
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,type:'dart',propId:'p3',message:'Brought out Sticky darts.'});
assert.deepEqual(calls.find(c=>c[0]==='make'&&c[4]==='p3'),['make','dart',870,46,'p3'],'Non-pump spawn must preserve right-hand offset and viewport clamps.');

const sendsBefore=calls.filter(c=>c[0]==='send').length;
special.handleSpecialItemInput(0,{type:'prop',action:'bring-out',item:'ball'});
special.handleSpecialItemInput(0,{type:'special-item',action:'noop',item:'ball'});
assert.equal(calls.filter(c=>c[0]==='send').length,sendsBefore,'Unrelated messages must be ignored.');
props.delete(specialItems.get(0));
special.handleSpecialItemInput(0,{type:'special-item',action:'bring-out',item:'frisbee'});
const sent=calls.filter(c=>c[0]==='send').at(-1);
assert.equal(sent[1],'c0');
assert.deepEqual(sent[2],{type:'special-item-result',ok:true,type:'frisbee',propId:'p4',message:'Brought out Laser frisbee.'});

console.log('Special item candidate preserves V1 labels, slot defaults, ownership, spawn placement/clamps and special-item-result dispatch.');
