import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/stage/stage-loop.js','utf8'),context,{filename:'stage-loop.js'});
const api=context.window.PuppetalkStageLoop;
assert.ok(api?.create,'Stage loop candidate did not install.');

const events=[];
let dims={W:1000,H:800};
let last=100;
let lastSceneSent=0;
const ctx={id:'ctx'};
const p1={id:'puppet-1'},p2={id:'puppet-2'};
const prop1={id:'prop-1'},prop2={id:'prop-2'};
const c1={id:'conn-1'},c2={id:'conn-2'};
const puppets=new Map([[0,p1],[1,p2]]);
const props=new Map([['a',prop1],['b',prop2]]);
const conns=new Map([[0,c1],[1,c2]]);
const scenes=[];
let scheduled=null;

const deps={
  getDimensions:()=>dims,ctx,props,puppets,conns,
  drawBackdrop:(gotCtx,W,H)=>events.push(['backdrop',gotCtx.id,W,H]),
  propState:prop=>{events.push(['propState',prop.id]);return {id:prop.id,state:true};},
  drawProp:(gotCtx,state,W,H)=>events.push(['drawProp',gotCtx.id,state.id,W,H]),
  anatomy:p=>{events.push(['anatomy',p.id]);return {id:p.id,body:true};},
  drawAnatomy:(gotCtx,state,W,H,remote)=>events.push(['drawAnatomy',gotCtx.id,state.id,W,H,remote]),
  send:(conn,scene)=>{events.push(['send',conn.id]);scenes.push({conn:conn.id,scene:JSON.parse(JSON.stringify(scene))});},
  getLastSceneSent:()=>lastSceneSent,
  setLastSceneSent:v=>{events.push(['setLastSceneSent',v]);lastSceneSent=v;},
  getLast:()=>last,
  setLast:v=>{events.push(['setLast',v]);last=v;},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  drivePuppet:p=>events.push(['drivePuppet',p.id]),
  repairBrokenSeams:p=>events.push(['repairBrokenSeams',p.id]),
  repairSeveredJoints:p=>events.push(['repairSeveredJoints',p.id]),
  driveProps:()=>events.push(['driveProps']),
  Engine:{update:(engine,dt)=>events.push(['engineUpdate',engine.id,dt])},
  engine:{id:'engine'},
  driveDepthAssistedProps:now=>events.push(['depthProps',now]),
  driveLaserFrisbeeCuts:now=>events.push(['laserCuts',now]),
  requestFrame:fn=>{events.push(['requestFrame']);scheduled=fn;}
};
const stage=api.create(deps);
assert.ok(stage?.tick && stage?.drawStage && stage?.broadcastScene,'Stage loop candidate did not expose all V1 stage functions.');

stage.drawStage();
assert.deepEqual(events.splice(0),[
  ['backdrop','ctx',1000,800],
  ['propState','prop-1'],['drawProp','ctx','prop-1',1000,800],
  ['propState','prop-2'],['drawProp','ctx','prop-2',1000,800],
  ['anatomy','puppet-1'],['drawAnatomy','ctx','puppet-1',1000,800,false],
  ['anatomy','puppet-2'],['drawAnatomy','ctx','puppet-2',1000,800,false]
],'Stage drawing order drifted from frozen V1.');

dims={W:640,H:480};
stage.drawStage();
assert.deepEqual(events[0],['backdrop','ctx',640,480],'Stage drawing must read current dimensions each call.');
events.length=0;

lastSceneSent=100;
stage.broadcastScene(150);
assert.deepEqual(events,[],'Broadcast must be throttled when fewer than 66ms elapsed.');
assert.equal(lastSceneSent,100,'Throttled broadcast must not advance lastSceneSent.');

conns.clear();
stage.broadcastScene(200);
assert.deepEqual(events,[],'Broadcast must do nothing with zero connections.');
assert.equal(lastSceneSent,100,'No-connection broadcast must not advance lastSceneSent.');

conns.set(0,c1);conns.set(1,c2);
stage.broadcastScene(200);
assert.deepEqual(events,[
  ['setLastSceneSent',200],
  ['anatomy','puppet-1'],['anatomy','puppet-2'],
  ['propState','prop-1'],['propState','prop-2'],
  ['send','conn-1'],['send','conn-2']
],'Broadcast scene construction/send order drifted from frozen V1.');
assert.equal(lastSceneSent,200);
assert.equal(scenes.length,2);
assert.deepEqual(scenes[0],{
  conn:'conn-1',scene:{
    type:'scene',
    puppets:[{id:'puppet-1',body:true},{id:'puppet-2',body:true}],
    props:[{id:'prop-1',state:true},{id:'prop-2',state:true}]
  }
});
assert.deepEqual(scenes[1].scene,scenes[0].scene,'Every connection must receive the same constructed scene object value.');
events.length=0;scenes.length=0;

last=100;
lastSceneSent=0;
stage.tick(130);
assert.deepEqual(events,[
  ['setLast',130],
  ['drivePuppet','puppet-1'],['repairBrokenSeams','puppet-1'],['repairSeveredJoints','puppet-1'],
  ['drivePuppet','puppet-2'],['repairBrokenSeams','puppet-2'],['repairSeveredJoints','puppet-2'],
  ['driveProps'],
  ['engineUpdate','engine',25],
  ['depthProps',130],
  ['laserCuts',130],
  ['backdrop','ctx',640,480],
  ['propState','prop-1'],['drawProp','ctx','prop-1',640,480],
  ['propState','prop-2'],['drawProp','ctx','prop-2',640,480],
  ['anatomy','puppet-1'],['drawAnatomy','ctx','puppet-1',640,480,false],
  ['anatomy','puppet-2'],['drawAnatomy','ctx','puppet-2',640,480,false],
  ['setLastSceneSent',130],
  ['anatomy','puppet-1'],['anatomy','puppet-2'],
  ['propState','prop-1'],['propState','prop-2'],
  ['send','conn-1'],['send','conn-2'],
  ['requestFrame']
],'Per-frame stage order drifted from frozen V1.');
assert.equal(last,130);
assert.equal(lastSceneSent,130);
assert.equal(typeof scheduled,'function','tick must schedule itself for the next animation frame.');
events.length=0;scenes.length=0;

last=130;
lastSceneSent=130;
scheduled(134);
assert.deepEqual(events.slice(0,2),[['setLast',134],['drivePuppet','puppet-1']]);
assert.ok(events.some(e=>e[0]==='engineUpdate'&&e[2]===8),'Frame delta must clamp to the V1 minimum of 8ms.');
assert.ok(!events.some(e=>e[0]==='setLastSceneSent'),'A 4ms follow-up frame must not broadcast.');
assert.deepEqual(events.at(-1),['requestFrame'],'Scheduled tick must schedule the next tick again.');

console.log('Stage loop candidate preserves V1 draw order, 66ms broadcast throttle, scene construction, frame update order and dt clamping.');
