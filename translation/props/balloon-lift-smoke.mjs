import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./balloon-lift.js',import.meta.url),'utf8'),context,{filename:'balloon-lift.js'});
const api=context.window.PuppetalkBalloonLift;
assert.ok(api?.create,'Balloon lift candidate did not install.');

const props=new Map(),puppets=new Map(),calls=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const localOffset=(body,world)=>({x:world.x-body.position.x,y:world.y-body.position.y});
const worldOffset=(body,local)=>({x:body.position.x+local.x,y:body.position.y+local.y});
const Body={
  setStatic(body,value){body.isStatic=value;calls.push(['static',body.id,value]);},
  applyForce(body,point,force){calls.push(['force',body.id,{...point},{...force}]);}
};
const cancelPropContest=prop=>{calls.push(['cancel',prop.id]);prop.contest=null;};
const releasePropHolder=(prop,promote)=>{calls.push(['release',prop.id,promote]);prop.heldBy=null;};
const syncAttachedProp=prop=>calls.push(['sync',prop.id]);
const lift=api.create({props,puppets,cancelPropContest,releasePropHolder,localOffset,worldOffset,Body,syncAttachedProp,clamp});
assert.ok(lift?.driveAttachedBalloon,'Balloon lift factory failed.');

assert.equal(lift.tieBalloonToBody(null,{}),false);
assert.equal(lift.tieBalloonToBody({type:'balloon'},{}),false);
assert.equal(lift.tieBalloonToBody({type:'ball'}, {body:{}}),false);
assert.equal(lift.tieBalloonToBody({type:'balloon',attachedTo:{}},{body:{}}),false);

const targetBody={id:'arm',position:{x:100,y:200}};
const balloon={id:'prop-99',type:'balloon',body:{id:'balloonBody',collisionFilter:{mask:123}},heldBy:{slot:0,hand:'left'},contest:{slot:1},attachedTo:null};
props.set(balloon.id,balloon);
assert.equal(lift.tieBalloonToBody(balloon,{slot:2,part:'faR',body:targetBody,point:{x:115,y:190}}),true);
assert.ok(calls.some(c=>c[0]==='cancel'&&c[1]==='prop-99'));
assert.ok(calls.some(c=>c[0]==='release'&&c[1]==='prop-99'&&c[2]===false));
assert.equal(balloon.attachedTo.slot,2);
assert.equal(balloon.attachedTo.part,'faR');
assert.equal(balloon.attachedTo.body,targetBody);
assert.deepEqual(JSON.parse(JSON.stringify(balloon.attachedTo.offset)),{x:15,y:-10});
assert.equal(balloon.attachedTo.angle,0);
assert.equal(balloon.attachedTo.mode,'balloon');
assert.equal(balloon.attachedTo.stringLength,64,'Frozen /D+/g ID parsing quirk must remain: prop-99 falls back to numeric 1.');
assert.equal(balloon.attachedTo.phase,.83);
assert.equal(balloon.body.isStatic,true);
assert.equal(balloon.body.collisionFilter.mask,0);
assert.ok(calls.some(c=>c[0]==='sync'&&c[1]==='prop-99'));

function runLiftScenario({count,upwardSpeed=0,scale=1,anchorIsTorso=false,now=1000}){
  props.clear();calls.length=0;puppets.clear();
  const torso={id:'torso',position:{x:400,y:300},velocity:{x:0,y:-upwardSpeed}};
  const anchorBody=anchorIsTorso?torso:{id:'arm',position:{x:380,y:280},velocity:{x:0,y:0}};
  puppets.set(0,{torso});
  let subject;
  for(let i=0;i<count;i++){
    const p={
      id:'b'+i,type:'balloon',body:{id:'body'+i},_renderScale:i===0?scale:1,
      attachedTo:{mode:'balloon',slot:0,part:'faL',body:anchorBody,offset:{x:4,y:-6},phase:i===0?.83:i*.2}
    };
    props.set(p.id,p);
    if(i===0) subject=p;
  }
  lift.driveAttachedBalloon(subject,now);
  return {calls:[...calls],subject,torso,anchorBody};
}

const bases=new Map([[1,.0034],[2,.0045],[3,.0062],[4,.0115],[5,.0133],[8,.0187]]);
for(const [count,baseLift] of bases){
  const r=runLiftScenario({count,now:0});
  const forces=r.calls.filter(c=>c[0]==='force');
  assert.equal(forces.length,2,`Non-torso attachment should split force at count ${count}.`);
  const localShare=count>=4?.64:.76;
  const expectedSway=Math.sin(.83)*.00032;
  assert.ok(Math.abs(forces[0][3].x-expectedSway)<1e-12);
  assert.ok(Math.abs(forces[0][3].y-(-baseLift*localShare))<1e-12,`Local lift curve changed at ${count} balloons.`);
  assert.ok(Math.abs(forces[1][3].y-(-baseLift*(1-localShare)))<1e-12,`Torso lift split changed at ${count} balloons.`);
}

let r=runLiftScenario({count:4,upwardSpeed:13,scale:2,now:500});
let forces=r.calls.filter(c=>c[0]==='force');
const fadedLift=.0115*4*.55;
assert.ok(Math.abs(forces[0][3].y-(-fadedLift*.64))<1e-12,'Upward-speed fade, 2x balloon area scaling, or four-balloon local share changed.');
assert.ok(Math.abs(forces[1][3].y-(-fadedLift*.36))<1e-12);

r=runLiftScenario({count:1,scale:.1,anchorIsTorso:true,now:0});
forces=r.calls.filter(c=>c[0]==='force');
assert.equal(forces.length,1,'Torso-tied balloon must apply all lift locally without a duplicate torso force.');
assert.ok(Math.abs(forces[0][3].y-(-.0034*.35*.35))<1e-12,'Minimum balloon scale must remain .35.');

const unattached={type:'balloon',attachedTo:null};
const before=calls.length;
lift.driveAttachedBalloon(unattached,0);
lift.driveAttachedBalloon({type:'ball',attachedTo:{mode:'balloon',body:{}}},0);
lift.driveAttachedBalloon({type:'balloon',attachedTo:{mode:'pump',body:{}}},0);
assert.equal(calls.length,before,'Non balloon-tie states must be ignored.');

console.log('Balloon lift candidate preserves V1 tie cleanup/metadata, frozen ID phase quirk, 1–4 take-off curve, >4 lift ramp, speed fade, sway and torso force sharing.');
