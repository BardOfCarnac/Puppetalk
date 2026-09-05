import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./depth-assist.js',import.meta.url),'utf8'),context,{filename:'depth-assist.js'});
const api=context.window.PuppetalkDepthAssist;
assert.ok(api?.create,'Depth-assist candidate did not install.');

const props=new Map(),puppets=new Map(),calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dimensions={W:1000,H:500};
const depths=new Map();
const depthState={
  getDepthForSlot:slot=>depths.get(slot)||0,
  scaleForDepth:depth=>1+depth,
  shiftForDepth:depth=>depth*.1
};
let tuning={minDepth:-.48,maxDepth:1};
const Body={
  translate(body,v){calls.push(['translate',body.id,v.x,v.y]);body.position={x:body.position.x+v.x,y:body.position.y+v.y};},
  setVelocity(body,v){calls.push(['velocity',body.id,v.x,v.y]);body.velocity={...v};}
};
const assist=api.create({
  props,puppets,clamp,Body,getDimensions:()=>dimensions,
  getDepthState:()=>depthState,getForegroundTuning:()=>tuning
});
assert.ok(assist?.driveDepthAssistedProps,'Depth-assist factory failed.');

assert.deepEqual(Array.from(assist.PUPPETALK_ACTION_SEAT_ORDER),[0,3,1,4,2,5]);
assert.equal(assist.PUPPETALK_ACTION_DEPTH_TOLERANCE,.38);
assert.equal(assist.PUPPETALK_ACTION_SCREEN_PAD,15);
assert.equal(assist.PUPPETALK_ACTION_DEPTH_X,.28);
assert.equal(assist.puppetalkActionSeatAngle(0),0);
assert.equal(assist.puppetalkActionSeatAngle(1),Math.PI);
assert.equal(assist.puppetalkActionSeatAngle(2),Math.PI/3);
assert.ok(Math.abs(assist.puppetalkActionHomeX(2)-.43)<1e-12);
depths.set(2,.25);
assert.equal(assist.puppetalkActionDepth(2),.25);
assert.equal(assist.puppetalkActionDepth('2'),0);
assert.equal(assist.puppetalkActionClampDepth(-1),-.48);
assert.equal(assist.puppetalkActionClampDepth(2),1);
tuning={minDepth:-.2,maxDepth:.7};
assert.equal(assist.puppetalkActionClampDepth(-1),-.2);
assert.equal(assist.puppetalkActionClampDepth(2),.7);
tuning={minDepth:-.48,maxDepth:1};

depths.set(0,.2);
const p0={slot:0,torso:{position:{x:160,y:200}}};
const projected=assist.puppetalkActionProjectPuppetPoint(p0,{x:170,y:210},0);
assert.ok(Math.abs(projected.x-172)<1e-12);
assert.ok(Math.abs(projected.y-222)<1e-12);
assert.ok(Math.abs(projected.depth-.2)<1e-12);
assert.ok(Math.abs(projected.scale-1.2)<1e-12);
assert.equal(assist.puppetalkActionProjectPuppetPoint(null,{x:0,y:0},0),null);
const q={x:4,y:5};
assert.equal(assist.puppetalkAimProjectPoint(null,q,0),q);

const propProjection={body:{position:{x:160,y:100}},_throwerSlot:0,_depth:.2};
const projectedProp=assist.puppetalkAimProjectPropPoint(propProjection,0);
assert.ok(Math.abs(projectedProp.x-160)<1e-12);
assert.ok(Math.abs(projectedProp.y-110)<1e-12);
assert.ok(Math.abs(projectedProp.depth-.2)<1e-12);
assert.deepEqual(JSON.parse(JSON.stringify(assist.puppetalkAimProjectPropPoint(null,0))),{x:0,y:0,depth:0});
const plainProp={body:{position:{x:7,y:8}}};
assert.deepEqual(JSON.parse(JSON.stringify(assist.puppetalkAimProjectPropPoint(plainProp,null))),{x:7,y:8,depth:0});

assert.equal(assist.puppetalkAssistSegmentDistance({x:3,y:4},{x:0,y:0},{x:0,y:0}),5);
assert.equal(assist.puppetalkAssistSegmentDistance({x:5,y:4},{x:0,y:0},{x:10,y:0}),4);
assert.equal(assist.puppetalkAssistBodyRadius(null),18);
assert.equal(assist.puppetalkAssistBodyRadius({bounds:{min:{x:0,y:0},max:{x:100,y:10}}},1),34);
assert.equal(assist.puppetalkAssistBodyRadius({bounds:{min:{x:0,y:0},max:{x:10,y:10}}},1),12);
assert.deepEqual(Array.from(assist.puppetalkAssistBodies({bodies:[{id:1},null,{id:2}]}),b=>b.id),[1,2]);
assert.deepEqual(Array.from(assist.puppetalkAssistBodies({})),[]);

// Use neutral projection scale/shift for exact assist-driver checks.
depthState.scaleForDepth=()=>1;
depthState.shiftForDepth=()=>0;
depths.clear();
function targetPuppet(slot=1){
  const torso={id:'target',position:{x:350,y:100},velocity:{x:0,y:0},bounds:{min:{x:320,y:70},max:{x:380,y:130}}};
  return {slot,torso,bodies:[torso]};
}
function thrown(type='ball'){
  return {
    id:'prop',type,_throwerSlot:0,_depth:.2,_depthAssistUntil:2000,_assistPrevScreen:{x:220,y:100,depth:.2},
    heldBy:null,contest:null,attachedTo:null,
    body:{id:'propBody',position:{x:240,y:100},velocity:{x:3,y:0}}
  };
}

props.clear();puppets.clear();calls.length=0;
const expired=thrown();expired._depthAssistUntil=900;props.set(expired.id,expired);
assist.driveDepthAssistedProps(1000);
assert.equal(expired._assistPrevScreen.x,240,'Assist path history must update before expiry gate.');
assert.equal(calls.length,0);

props.clear();puppets.clear();calls.length=0;
const slow=thrown();slow.body.velocity={x:2.19,y:0};props.set(slow.id,slow);
assist.driveDepthAssistedProps(1000);
assert.equal(slow._assistPrevScreen.x,240,'Assist path history must update before speed gate.');
assert.equal(calls.length,0);

props.clear();puppets.clear();calls.length=0;
const own=thrown();props.set(own.id,own);puppets.set(0,targetPuppet(0));
assist.driveDepthAssistedProps(1000);
assert.equal(own._depth,.2,'Thrower puppet must be excluded from depth assistance.');
assert.equal(calls.length,0);

props.clear();puppets.clear();calls.length=0;
const ballThrow=thrown('ball');props.set(ballThrow.id,ballThrow);puppets.set(1,targetPuppet(1));
assist.driveDepthAssistedProps(1000);
assert.ok(Math.abs(ballThrow._depth-.15)<1e-12,'Depth correction must use 26% delta with frozen ±.05 frame clamp.');
assert.deepEqual(calls[0],['translate','propBody',6,0],'Physical reconciliation must clamp translation to ±6.');
assert.deepEqual(calls[1],['velocity','propBody',4.05,0],'Physical reconciliation must clamp velocity correction to ±1.05.');

props.clear();puppets.clear();calls.length=0;
const frisbee=thrown('frisbee');props.set(frisbee.id,frisbee);puppets.set(1,targetPuppet(1));
assist.driveDepthAssistedProps(1000);
assert.ok(Math.abs(frisbee._depth-.15)<1e-12,'Frisbee must still receive depth reconciliation.');
assert.equal(calls.length,0,'Frisbee must not receive Matter translation/velocity reconciliation.');

props.clear();puppets.clear();calls.length=0;
depths.set(1,1);
const tooDeep=thrown('ball');props.set(tooDeep.id,tooDeep);puppets.set(1,targetPuppet(1));
assist.driveDepthAssistedProps(1000);
assert.equal(tooDeep._depth,.2,'Candidates beyond frozen .38 depth tolerance must be ignored.');
assert.equal(calls.length,0);

console.log('Depth-assist candidate preserves V1 seat/depth projection, helper geometry, path-history gates, target scoring, .38 tolerance, ±.05 depth pull and non-frisbee Matter reconciliation.');
