import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./prop-state.js',import.meta.url),'utf8'),context,{filename:'prop-state.js'});
const api=context.window.PuppetalkPropState;
assert.ok(api?.create,'Prop state candidate did not install.');

let dims={W:400,H:200};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const worldOffset=(body,local)=>({x:body.position.x+local.x,y:body.position.y+local.y});
const state=api.create({getDimensions:()=>dims,worldOffset,clamp});
assert.ok(state,'Prop state candidate factory failed.');

const base={
  id:'ball',type:'ball',body:{position:{x:100,y:50},angle:0},
  heldBy:null,contest:null,attachedTo:null
};
assert.deepEqual(JSON.parse(JSON.stringify(state.propState(base))),{
  id:'ball',type:'ball',x:.25,y:.25,a:0,heldBy:null,contestedBy:null,tug:0,attachedTo:null
});

const frisbee={
  id:'frisbee',type:'frisbee',body:{position:{x:200,y:100},angle:.7},
  _depth:.44,_throwerSlot:3,_cutArmed:true,
  heldBy:{slot:3,hand:'right'},contest:{slot:2,hand:'left',score:1.4},attachedTo:null
};
const frisbeeState=state.propState(frisbee);
assert.equal(frisbeeState.depth,.44);
assert.equal(frisbeeState.throwerSlot,3);
assert.equal(frisbeeState.armed,true);
assert.deepEqual(JSON.parse(JSON.stringify(frisbeeState.heldBy)),{slot:3,hand:'right'});
assert.deepEqual(JSON.parse(JSON.stringify(frisbeeState.contestedBy)),{slot:2,hand:'left'});
assert.equal(frisbeeState.tug,1,'Tug serialization must clamp at V1 maximum.');
assert.equal(frisbeeState.x,.5);
assert.equal(frisbeeState.y,.5);
assert.equal(frisbeeState.a,.7);

const balloon={
  id:'balloon7',type:'balloon',body:{position:{x:40,y:20},angle:0},
  _inflation:.62,_renderScale:1.35,
  heldBy:null,contest:{slot:1,hand:'left',score:-.3},
  attachedTo:{slot:4,part:'head',mode:'tied',body:{position:{x:120,y:70}},offset:{x:8,y:-10}}
};
const balloonState=state.propState(balloon);
assert.equal(balloonState.inflation,.62);
assert.equal(balloonState.scale,1.35);
assert.equal(balloonState.tug,0,'Tug serialization must clamp at V1 minimum.');
assert.deepEqual(JSON.parse(JSON.stringify(balloonState.attachedTo)),{
  slot:4,part:'head',mode:'tied',anchor:{x:.32,y:.3}
});

const defaultBalloon={
  id:'balloon8',type:'balloon',body:{position:{x:0,y:0},angle:0},
  heldBy:null,contest:null,
  attachedTo:{slot:0,part:'torso',body:null,offset:{x:0,y:0}}
};
const defaultBalloonState=state.propState(defaultBalloon);
assert.equal(defaultBalloonState.inflation,0);
assert.equal(defaultBalloonState.scale,1);
assert.deepEqual(JSON.parse(JSON.stringify(defaultBalloonState.attachedTo)),{
  slot:0,part:'torso',mode:'embedded',anchor:null
});

const pump={
  id:'pump',type:'pump',body:{position:{x:320,y:160},angle:-.4},_balloonId:'balloon7',
  heldBy:null,contest:null,attachedTo:null
};
assert.equal(state.propState(pump).pumpBalloon,'balloon7');
pump._balloonId='';
assert.equal(state.propState(pump).pumpBalloon,null);

const ordinary={...base,_depth:NaN,_throwerSlot:2.5};
const ordinaryState=state.propState(ordinary);
assert.equal(ordinaryState.depth,undefined);
assert.equal(ordinaryState.throwerSlot,undefined);
assert.equal(ordinaryState.armed,undefined);
assert.equal(ordinaryState.inflation,undefined);
assert.equal(ordinaryState.scale,undefined);
assert.equal(ordinaryState.pumpBalloon,undefined);

dims={W:800,H:400};
assert.equal(state.propState(base).x,.125,'Serializer must use current stage dimensions rather than captured dimensions.');
assert.equal(state.propState(base).y,.125);

assert.equal(api.create({}),null,'Prop state factory must fail closed without dependencies.');

console.log('Prop state candidate preserves V1 normalized positions, optional fields, holder/contest/tug state and balloon attachment serialization.');
