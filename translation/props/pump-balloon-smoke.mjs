import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./pump-balloon.js',import.meta.url),'utf8'),context,{filename:'pump-balloon.js'});
const api=context.window.PuppetalkPumpBalloon;
assert.ok(api?.create,'Pump balloon candidate did not install.');

const props=new Map();
const calls=[];
let clock=2400;
const randomValues=[.8];
const Body={
  setStatic(body,value){body.isStatic=value;calls.push(['static',body.id,value]);},
  scale(body,x,y){calls.push(['scale',body.id,x,y]);body.scale=(body.scale||1)*x;},
  setVelocity(body,value){body.velocity={...value};calls.push(['velocity',body.id,value.x,value.y]);}
};
const worldOffset=(body,offset)=>({x:body.position.x+offset.x,y:body.position.y+offset.y});
let next=1;
const makeProp=(type,x,y)=>{
  const prop={id:'b'+next++,type,body:{id:'body'+next,position:{x,y},collisionFilter:{mask:0xFFFFFFFF}},heldBy:null,contest:null,attachedTo:null};
  props.set(prop.id,prop);calls.push(['make',type,x,y,prop.id]);return prop;
};
const syncAttachedProp=prop=>calls.push(['sync',prop.id,JSON.parse(JSON.stringify({mode:prop.attachedTo?.mode,offset:prop.attachedTo?.offset}))]);
const detachPropAttachment=prop=>{calls.push(['detach',prop.id]);prop.attachedTo=null;prop.body.isStatic=false;prop.body.collisionFilter.mask=0xFFFFFFFF;return true;};
const now=()=>clock;
const random=()=>randomValues.shift();
const pumpBalloon=api.create({props,makeProp,worldOffset,Body,syncAttachedProp,detachPropAttachment,now,random});
assert.ok(pumpBalloon?.inflatePumpBalloon,'Pump balloon factory failed.');

assert.deepEqual(JSON.parse(JSON.stringify(pumpBalloon.pumpNozzleOffset(undefined))),{x:0,y:-40.12});
assert.deepEqual(JSON.parse(JSON.stringify(pumpBalloon.pumpNozzleOffset(.2))),{x:0,y:-40.12});
assert.deepEqual(JSON.parse(JSON.stringify(pumpBalloon.pumpNozzleOffset(1))),{x:0,y:-52});
assert.equal(pumpBalloon.ensurePumpBalloon(null),null);
assert.equal(pumpBalloon.ensurePumpBalloon({type:'ball'}),null);

const pump={id:'pump1',type:'pump',body:{position:{x:300,y:500}},_balloonId:null};
props.set(pump.id,pump);
let balloon=pumpBalloon.ensurePumpBalloon(pump);
assert.equal(balloon.type,'balloon');
assert.equal(balloon._inflation,0);
assert.equal(balloon._renderScale,1);
assert.equal(balloon._pumpId,'pump1');
assert.equal(balloon.attachedTo.mode,'pump');
assert.equal(balloon.attachedTo.pumpId,'pump1');
assert.equal(balloon.attachedTo.part,'pump');
assert.equal(balloon.attachedTo.slot,null);
assert.equal(balloon.attachedTo.body,pump.body);
assert.deepEqual(JSON.parse(JSON.stringify(balloon.attachedTo.offset)),{x:0,y:-40.12});
assert.equal(balloon.attachedTo.angle,0);
assert.equal(balloon.body.isStatic,true);
assert.equal(balloon.body.collisionFilter.mask,0);
assert.equal(pump._balloonId,balloon.id);
assert.deepEqual(calls.find(c=>c[0]==='make'),['make','balloon',300,459.88,balloon.id]);
assert.ok(calls.some(c=>c[0]==='sync'&&c[1]===balloon.id));
assert.equal(pumpBalloon.ensurePumpBalloon(pump),balloon,'Existing pump balloon must be reused.');
assert.equal(calls.filter(c=>c[0]==='make').length,1,'Reuse must not create another balloon.');

let result=pumpBalloon.inflatePumpBalloon({type:'ball'});
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,message:'The pump is jammed.'});

result=pumpBalloon.inflatePumpBalloon(pump);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,message:'Pump 1 — balloon growing.'});
const scale1=.45+.28*Math.sqrt(1);
assert.equal(balloon._inflation,1);
assert.equal(balloon._renderScale,scale1);
assert.equal(pump._lastPumpAt,2400);
assert.deepEqual(JSON.parse(JSON.stringify(balloon.attachedTo.offset)),JSON.parse(JSON.stringify(pumpBalloon.pumpNozzleOffset(scale1))));
let scaleCall=calls.filter(c=>c[0]==='scale').at(-1);
assert.ok(Math.abs(scaleCall[2]-scale1)<1e-12 && Math.abs(scaleCall[3]-scale1)<1e-12,'First inflation ratio must be targetScale / 1.');

clock=2600;
result=pumpBalloon.inflatePumpBalloon(pump);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,message:'Pump 2 — balloon growing.'});
const scale2=.45+.28*Math.sqrt(2);
scaleCall=calls.filter(c=>c[0]==='scale').at(-1);
assert.ok(Math.abs(scaleCall[2]-(scale2/scale1))<1e-12,'Subsequent inflation must scale by target/previous ratio.');
assert.equal(balloon._inflation,2);
assert.equal(balloon._renderScale,scale2);
assert.equal(pump._lastPumpAt,2600);

assert.equal(pumpBalloon.releasePumpBalloon(null),false);
assert.equal(pumpBalloon.releasePumpBalloon({type:'balloon',attachedTo:{mode:'body'}}),false);
const releasedId=balloon.id;
assert.equal(pumpBalloon.releasePumpBalloon(balloon),true);
assert.equal(pump._balloonId,null);
assert.equal(balloon._pumpId,null);
assert.equal(balloon.attachedTo,null);
assert.ok(calls.some(c=>c[0]==='detach'&&c[1]===releasedId));
const velocity=calls.filter(c=>c[0]==='velocity').at(-1);
assert.equal(velocity[1],balloon.body.id);
assert.ok(Math.abs(velocity[2]-.105)<1e-12,'Release x impulse must remain (random-.5)*.35.');
assert.equal(velocity[3],-1.15);

console.log('Pump balloon candidate preserves V1 nozzle geometry, creation/reuse, inflation scaling/timing and release cleanup/impulse.');
