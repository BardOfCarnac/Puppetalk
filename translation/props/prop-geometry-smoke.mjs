import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./prop-geometry.js',import.meta.url),'utf8'),context,{filename:'prop-geometry.js'});
const api=context.window.PuppetalkPropGeometry;
assert.ok(api?.create,'Prop geometry candidate did not install.');

const puppets=new Map();
const props=new Map();
const calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const Vector={rotate(v,a){const c=Math.cos(a),s=Math.sin(a);return{x:v.x*c-v.y*s,y:v.x*s+v.y*c};}};
const grabWorldPoint=(p,part)=>{calls.push([p.slot,part]);return p.points?.[part]||{x:-1,y:-1};};
const g=api.create({puppets,props,grabWorldPoint,clamp,Vector});
assert.ok(g,'Prop geometry candidate factory failed.');

const p0={
  slot:0,torso:{position:{x:10,y:20}},
  faL:{id:'faL'},faL2:{id:'faL2'},faR:{id:'faR'},
  shL:{id:'shL'},shL2:{id:'shL2'},shR:{id:'shR'},
  points:{leftHand:{x:1,y:2},rightHand:{x:3,y:4},leftFoot:{x:5,y:6},rightFoot:{x:7,y:8}}
};
assert.equal(g.handBody(p0,'left'),p0.faL2);
assert.equal(g.handBody(p0,'right'),p0.faR);
assert.equal(g.handBody(p0,'leftFoot'),p0.shL2);
assert.equal(g.handBody(p0,'rightFoot'),p0.shR);
assert.equal(g.handBody(p0,'head'),null);
assert.deepEqual(JSON.parse(JSON.stringify(g.handPoint(p0,'left'))),{x:1,y:2});
assert.deepEqual(JSON.parse(JSON.stringify(g.handPoint(p0,'rightFoot'))),{x:7,y:8});
assert.deepEqual(JSON.parse(JSON.stringify(g.handPoint(p0,'unknown'))),{x:10,y:20});
assert.deepEqual(JSON.parse(JSON.stringify(g.handPoint(null,'unknown'))),{x:0,y:0});
assert.deepEqual(calls,[[0,'leftHand'],[0,'rightFoot']]);
assert.deepEqual(JSON.parse(JSON.stringify(g.propGripLocalPoint('left'))),{x:0,y:12});
assert.deepEqual(JSON.parse(JSON.stringify(g.propGripLocalPoint('leftFoot'))),{x:0,y:13.5});
assert.equal(g.validPropEffector('left'),true);
assert.equal(g.validPropEffector('rightFoot'),true);
assert.equal(g.validPropEffector('head'),false);
assert.equal(g.gripKey(3,'right'),'3:right');
assert.deepEqual(Array.from(g.ATTACHABLE_PARTS),['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR']);

const canonical={bounds:{min:{x:0,y:0},max:{x:20,y:20}},position:{x:10,y:10}};
const head={bounds:{min:{x:30,y:0},max:{x:50,y:20}},position:{x:40,y:10}};
const hidden={plugin:{puppetalkSlot:4,puppetalkSegmentPart:'uaR'},position:{x:90,y:90}};
const p1={slot:1,torso:canonical,head};
puppets.set(1,p1);
assert.equal(g.puppetPartForBody(canonical).slot,1);
assert.equal(g.puppetPartForBody(canonical).part,'torso');
assert.equal(g.puppetPartForBody(hidden).slot,4,'Hidden segment plugin slot must win without scanning puppet maps.');
assert.equal(g.puppetPartForBody(hidden).part,'uaR');
assert.equal(g.puppetPartForBody(null),null);
assert.equal(g.puppetPartForBody({}),null);

const propBody={id:'prop-body'};
const prop={id:'p',body:propBody};
props.set('p',prop);
assert.equal(g.propForBody(propBody),prop);
assert.equal(g.propForBody({id:'different'}),null);

assert.deepEqual(JSON.parse(JSON.stringify(g.closestPointOnBody(canonical,{x:25,y:-5}))),{x:20,y:0});
assert.deepEqual(JSON.parse(JSON.stringify(g.closestPointOnBody({position:{x:8,y:9}},{x:100,y:100}))),{x:8,y:9});

puppets.clear();
const held={bounds:{min:{x:52,y:0},max:{x:62,y:10}},position:{x:57,y:5}};
const near={bounds:{min:{x:35,y:0},max:{x:45,y:10}},position:{x:40,y:5}};
const farEdge={bounds:{min:{x:96,y:0},max:{x:106,y:10}},position:{x:101,y:5}};
const owner={slot:2,faL2:held,faL:held,torso:{bounds:{min:{x:200,y:200},max:{x:220,y:220}},position:{x:210,y:210}},head:near};
const other={slot:3,torso:farEdge};
puppets.set(2,owner);puppets.set(3,other);
const balloon={body:{position:{x:50,y:5}}};
let best=g.nearestBalloonTarget(balloon,2,'left');
assert.equal(best.slot,2);
assert.equal(best.part,'head');
assert.equal(best.body,near);
assert.equal(best.distance,5);
owner.head={bounds:{min:{x:96,y:0},max:{x:106,y:10}},position:{x:101,y:5}};
other.torso={bounds:{min:{x:130,y:0},max:{x:140,y:10}},position:{x:135,y:5}};
best=g.nearestBalloonTarget(balloon,2,'left');
assert.equal(best.slot,2);
assert.equal(best.part,'head');
assert.equal(best.distance,46);
owner.head={bounds:{min:{x:97,y:0},max:{x:107,y:10}},position:{x:102,y:5}};
best=g.nearestBalloonTarget(balloon,2,'left');
assert.equal(best,null,'Balloon target reach must stop beyond 46px.');

const body={position:{x:100,y:50},angle:Math.PI/2};
const world={x:100,y:60};
const local=g.localOffset(body,world);
assert.ok(Math.abs(local.x-10)<1e-12 && Math.abs(local.y)<1e-12);
const roundTrip=g.worldOffset(body,local);
assert.ok(Math.abs(roundTrip.x-world.x)<1e-12 && Math.abs(roundTrip.y-world.y)<1e-12);

console.log('Prop geometry candidate preserves V1 effector lookup, hidden/canonical part lookup, closest-point targeting, 46px balloon reach and local/world offsets.');
