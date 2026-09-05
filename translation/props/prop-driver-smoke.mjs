import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./prop-driver.js',import.meta.url),'utf8'),context,{filename:'prop-driver.js'});
const api=context.window.PuppetalkPropDriver;
assert.ok(api?.create,'Prop driver candidate did not install.');

const props=new Map(),propGrips=new Map(),calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gripKey=(slot,hand)=>`${slot}:${hand}`;
const cancelPropContest=prop=>{calls.push(['cancel',prop.id]);prop.contest=null;};
const promotePropContest=prop=>calls.push(['promote',prop.id]);
const Body={applyForce(body,point,force){calls.push(['force',body.id,{...point},{...force}]);}};
const engine={gravity:{y:1,scale:.001}};
const driveAttachedBalloon=(prop,at)=>calls.push(['attached',prop.id,at]);
const syncAttachedProp=prop=>calls.push(['sync',prop.id]);
const driveDartBalloonPops=()=>calls.push(['pops']);
let nowValue=1000;
const driver=api.create({
  props,propGrips,gripKey,cancelPropContest,promotePropContest,clamp,
  Body,engine,driveAttachedBalloon,syncAttachedProp,driveDartBalloonPops,now:()=>nowValue
});
assert.ok(driver?.driveProps,'Prop driver factory failed.');

const idle={id:'idle',heldBy:null,contest:null};
driver.updatePropContest(idle,1000);
assert.equal(calls.length,0,'Props without an active holder/contest must be ignored.');

const missing={id:'missing',heldBy:{slot:0,hand:'left'},contest:{score:.4,lastUpdateAt:900,lastTapAt:900,constraint:{stiffness:0}}};
driver.updatePropContest(missing,1000);
assert.deepEqual(calls.shift(),['cancel','missing'],'A contest without its holder grip must cancel.');

const holder={constraint:{stiffness:0}};
propGrips.set('1:right',holder);
const tug={id:'tug',heldBy:{slot:1,hand:'right'},contest:{score:.5,lastUpdateAt:0,lastTapAt:0,constraint:{stiffness:0}}};
driver.updatePropContest(tug,1000);
assert.equal(tug.contest.lastUpdateAt,1000);
assert.ok(Math.abs(tug.contest.score-(.5-.08*.12))<1e-12,'Contest decay must cap dt at .08 and decay by .12/s after 260ms.');
assert.ok(Math.abs(holder.constraint.stiffness-(.86-tug.contest.score*.58))<1e-12);
assert.ok(Math.abs(tug.contest.constraint.stiffness-(.14+tug.contest.score*.72))<1e-12);

const recent={id:'recent',heldBy:{slot:1,hand:'right'},contest:{score:.5,lastUpdateAt:900,lastTapAt:800,constraint:{stiffness:0}}};
driver.updatePropContest(recent,1000);
assert.equal(recent.contest.score,.5,'Contest score must not decay within 260ms of the last tap.');

const winner={id:'winner',heldBy:{slot:1,hand:'right'},contest:{score:1.2,lastUpdateAt:1000,lastTapAt:1000,constraint:{stiffness:0}}};
driver.updatePropContest(winner,1000);
assert.equal(winner.contest.score,1.05,'Contest score must clamp at 1.05.');
assert.ok(calls.some(c=>c[0]==='promote'&&c[1]==='winner'),'Score >= 1 must promote the challenger.');

const exhausted={id:'exhausted',heldBy:{slot:1,hand:'right'},contest:{score:0,lastUpdateAt:0,lastTapAt:0,constraint:{stiffness:0}}};
driver.updatePropContest(exhausted,1000);
assert.ok(calls.some(c=>c[0]==='cancel'&&c[1]==='exhausted'),'Zero score after 700ms must cancel the contest.');

props.clear();calls.length=0;propGrips.clear();
const balloon={id:'balloon',type:'balloon',body:{id:'balloonBody',position:{x:12,y:34},mass:2},heldBy:null,contest:null};
const ball={id:'ball',type:'ball',body:{id:'ballBody',position:{x:50,y:60},mass:3},heldBy:null,contest:null};
props.set(balloon.id,balloon);props.set(ball.id,ball);
nowValue=2345;
driver.driveProps();
const expected=[
  ['force','balloonBody',{x:12,y:34},{x:0,y:-2*.001*1.42}],
  ['attached','balloon',2345],
  ['sync','balloon'],
  ['attached','ball',2345],
  ['sync','ball'],
  ['pops']
];
assert.deepEqual(calls,expected,'Generic prop drive order or frozen balloon anti-gravity force changed.');

console.log('Prop driver candidate preserves V1 tug decay/stiffness/promotion/cancel rules and generic per-frame balloon/attachment/sync/pop driving.');
