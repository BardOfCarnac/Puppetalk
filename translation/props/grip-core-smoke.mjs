import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const frozen=fs.readFileSync('translation/generated/app-final.js','utf8');
const startMarker='  function gripRecord(slot,hand){';
const endMarker='\n  function propHandIsClose(slot,hand,prop){';
const start=frozen.indexOf(startMarker);
const end=frozen.indexOf(endMarker,start);
assert.ok(start>=0 && end>start,'Could not isolate frozen V1 prop grip core.');
const frozenBlock=frozen.slice(start,end).replace(/^  /gm,'');

const frozenBuilder=new Function(
  'propGrips','gripKey','Composite','engine','puppets','handBody','propGripLocalPoint','Constraint',
  `${frozenBlock}\nreturn {gripRecord,freePropHand,clearPropGrip,makePropGrip,cancelPropContest,promotePropContest,releasePropHolder,beginPropHold,beginPropContest};`
);

const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync('translation/props/grip-core.js','utf8'),context,{filename:'grip-core.js'});
const candidateApi=context.PuppetalkPropGripCore;
assert.equal(typeof candidateApi?.create,'function','Translated prop grip candidate failed to load.');

function makeHarness(){
  const propGrips=new Map();
  const puppets=new Map();
  const calls=[];
  let nextConstraint=1;
  const engine={world:{id:'world'}};
  const gripKey=(slot,hand)=>`${slot}:${hand}`;
  const handBody=(p,hand)=>{
    calls.push(['handBody',p?.slot??null,hand]);
    return p?.hands?.[hand] || null;
  };
  const propGripLocalPoint=hand=>{
    calls.push(['propGripLocalPoint',hand]);
    return hand==='leftFoot'||hand==='rightFoot'?{x:0,y:13.5}:{x:0,y:12};
  };
  const normalizeConstraintOptions=options=>({
    bodyA:options.bodyA?.id??null,
    pointA:options.pointA?{...options.pointA}:null,
    bodyB:options.bodyB?.id??null,
    pointB:options.pointB?{...options.pointB}:null,
    length:options.length,
    stiffness:options.stiffness,
    damping:options.damping
  });
  const Constraint={create(options){
    calls.push(['Constraint.create',normalizeConstraintOptions(options)]);
    return {
      id:`constraint-${nextConstraint++}`,
      bodyA:options.bodyA,
      pointA:options.pointA,
      bodyB:options.bodyB,
      pointB:options.pointB,
      length:options.length,
      stiffness:options.stiffness,
      damping:options.damping
    };
  }};
  const Composite={
    add(world,constraint){calls.push(['Composite.add',world?.id??null,constraint?.id??null]);},
    remove(world,constraint){calls.push(['Composite.remove',world?.id??null,constraint?.id??null]);}
  };
  return {deps:{propGrips,gripKey,Composite,engine,puppets,handBody,propGripLocalPoint,Constraint},propGrips,puppets,calls,Constraint};
}

function constraintSummary(constraint){
  return constraint?{id:constraint.id,stiffness:constraint.stiffness,damping:constraint.damping,length:constraint.length}:null;
}
function gripsSummary(propGrips){
  return [...propGrips.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,grip])=>({
    key,propId:grip.propId,role:grip.role,constraint:constraintSummary(grip.constraint)
  }));
}
function propSummary(prop){
  const contest=prop?.contest;
  return {
    heldBy:prop?.heldBy??null,
    contest:contest?{
      slot:contest.slot,hand:contest.hand,score:contest.score,lastTapAt:contest.lastTapAt,lastUpdateAt:contest.lastUpdateAt,
      constraint:constraintSummary(contest.constraint)
    }:null,
    throwerSlot:prop?._throwerSlot,
    depth:prop?._depth,
    depthAssistUntil:prop?._depthAssistUntil,
    assistPrevScreen:prop?._assistPrevScreen??null,
    cutArmed:prop?._cutArmed,
    thrownAt:prop?._thrownAt,
    frisbeePrev:prop?._frisbeePrev??null,
    isSensor:prop?.body?.isSensor
  };
}
function normalize(value){return JSON.parse(JSON.stringify(value));}
function run(factory,scenario){
  const h=makeHarness();
  const api=factory(h.deps);
  assert.ok(api && typeof api.makePropGrip==='function','Grip core was not created.');
  const result=scenario(api,h);
  return normalize({result,calls:h.calls,grips:gripsSummary(h.propGrips)});
}
const frozenFactory=deps=>frozenBuilder(deps.propGrips,deps.gripKey,deps.Composite,deps.engine,deps.puppets,deps.handBody,deps.propGripLocalPoint,deps.Constraint);
const candidateFactory=deps=>candidateApi.create(deps);

function addPuppet(h,slot=1){
  const puppet={slot,hands:{left:{id:`p${slot}-left`},right:{id:`p${slot}-right`},leftFoot:{id:`p${slot}-leftFoot`},rightFoot:{id:`p${slot}-rightFoot`}}};
  h.puppets.set(slot,puppet);
  return puppet;
}
function addGrip(h,{slot=1,hand='left',propId='old',role='holder',stiffness=.88}={}){
  const constraint={id:`seed-${slot}-${hand}-${propId}`,stiffness,damping:.19,length:3};
  const grip={propId,constraint,role};
  h.propGrips.set(`${slot}:${hand}`,grip);
  return grip;
}
function makeProp(id='prop-a',type='ball'){
  return {id,type,body:{id:`${id}-body`,isSensor:true},gripPoint:null,heldBy:null,contest:null,_throwerSlot:7,_depth:.4,_depthAssistUntil:999,_assistPrevScreen:{x:1,y:2}};
}

const scenarios={
  handAvailability(api,h){
    const empty=api.freePropHand(1,'left');
    addGrip(h,{slot:1,hand:'left',propId:'mine'});
    const same=api.freePropHand(1,'left','mine');
    const other=api.freePropHand(1,'left','theirs');
    return {empty,same,other,record:constraintSummary(api.gripRecord(1,'left')?.constraint)};
  },
  clearMissing(api){
    return {returned:api.clearPropGrip(2,'right')};
  },
  clearExisting(api,h){
    const seeded=addGrip(h,{slot:2,hand:'right',propId:'seed'});
    const returned=api.clearPropGrip(2,'right');
    return {returned:{propId:returned?.propId,role:returned?.role,constraint:constraintSummary(returned?.constraint)},seededStillSame:returned===seeded};
  },
  makeGripMissingPuppet(api){
    const prop=makeProp('missing-puppet');
    return {returned:api.makePropGrip(prop,4,'left',.5,'holder')};
  },
  makeGripOccupied(api,h){
    addPuppet(h,1);
    addGrip(h,{slot:1,hand:'left',propId:'other'});
    const prop=makeProp('wanted');
    return {returned:api.makePropGrip(prop,1,'left',.5,'holder')};
  },
  makeGripDefaultPoint(api,h){
    addPuppet(h,1);
    const prop=makeProp('fresh');
    const returned=api.makePropGrip(prop,1,'left',.44,'holder');
    return {returned:{propId:returned?.propId,role:returned?.role,constraint:constraintSummary(returned?.constraint)}};
  },
  makeGripCustomPoint(api,h){
    addPuppet(h,3);
    const prop=makeProp('custom');
    prop.gripPoint={x:7,y:-2};
    const returned=api.makePropGrip(prop,3,'leftFoot',.17,'contest');
    return {returned:{propId:returned?.propId,role:returned?.role,constraint:constraintSummary(returned?.constraint)}};
  },
  cancelNoContest(api){
    const prop=makeProp('none');
    return {returned:api.cancelPropContest(prop),prop:propSummary(prop)};
  },
  cancelContestAndRestoreHolder(api,h){
    const prop=makeProp('contest');
    const holder=addGrip(h,{slot:1,hand:'left',propId:prop.id,role:'holder',stiffness:.31});
    const tug=addGrip(h,{slot:2,hand:'right',propId:prop.id,role:'contest',stiffness:.17});
    prop.heldBy={slot:1,hand:'left'};
    prop.contest={slot:2,hand:'right',constraint:tug.constraint,score:.4,lastTapAt:10,lastUpdateAt:11};
    const returned=api.cancelPropContest(prop);
    return {returned,prop:propSummary(prop),holder:constraintSummary(holder.constraint)};
  },
  promoteNoContest(api){
    const prop=makeProp('no-promotion');
    return {returned:api.promotePropContest(prop),prop:propSummary(prop)};
  },
  promoteContest(api,h){
    const prop=makeProp('promotion');
    addGrip(h,{slot:1,hand:'left',propId:prop.id,role:'holder',stiffness:.88});
    const tug=addGrip(h,{slot:2,hand:'right',propId:prop.id,role:'contest',stiffness:.17});
    prop.heldBy={slot:1,hand:'left'};
    prop.contest={slot:2,hand:'right',constraint:tug.constraint,score:1,lastTapAt:20,lastUpdateAt:21};
    const returned=api.promotePropContest(prop);
    return {returned,prop:propSummary(prop)};
  },
  releaseNoHolder(api){
    const prop=makeProp('loose');
    return {returned:api.releasePropHolder(prop,true),prop:propSummary(prop)};
  },
  releaseCancelsContest(api,h){
    const prop=makeProp('release-cancel');
    addGrip(h,{slot:1,hand:'left',propId:prop.id,role:'holder'});
    const tug=addGrip(h,{slot:2,hand:'right',propId:prop.id,role:'contest',stiffness:.17});
    prop.heldBy={slot:1,hand:'left'};
    prop.contest={slot:2,hand:'right',constraint:tug.constraint,score:.5,lastTapAt:30,lastUpdateAt:31};
    const returned=api.releasePropHolder(prop,false);
    return {returned,prop:propSummary(prop)};
  },
  releasePromotesContest(api,h){
    const prop=makeProp('release-promote');
    addGrip(h,{slot:1,hand:'left',propId:prop.id,role:'holder'});
    const tug=addGrip(h,{slot:2,hand:'right',propId:prop.id,role:'contest',stiffness:.17});
    prop.heldBy={slot:1,hand:'left'};
    prop.contest={slot:2,hand:'right',constraint:tug.constraint,score:.7,lastTapAt:40,lastUpdateAt:41};
    const returned=api.releasePropHolder(prop,true);
    return {returned,prop:propSummary(prop)};
  },
  beginHoldBall(api,h){
    addPuppet(h,1);
    const prop=makeProp('ball-hold','ball');
    const returned=api.beginPropHold(prop,1,'right');
    return {returned,prop:propSummary(prop)};
  },
  beginHoldFrisbee(api,h){
    addPuppet(h,1);
    const prop=makeProp('frisbee-hold','frisbee');
    prop._cutArmed=true; prop._thrownAt=123; prop._frisbeePrev={x:9,y:8}; prop.body.isSensor=true;
    const returned=api.beginPropHold(prop,1,'left');
    return {returned,prop:propSummary(prop)};
  },
  beginHoldFailsButResetsAssist(api,h){
    addPuppet(h,1);
    addGrip(h,{slot:1,hand:'left',propId:'occupied'});
    const prop=makeProp('blocked','ball');
    const returned=api.beginPropHold(prop,1,'left');
    return {returned,prop:propSummary(prop)};
  },
  beginContest(api,h){
    addPuppet(h,5);
    const prop=makeProp('tugged','ball');
    const returned=api.beginPropContest(prop,5,'right',4567);
    return {returned,prop:propSummary(prop)};
  },
  beginContestFails(api,h){
    addPuppet(h,5);
    addGrip(h,{slot:5,hand:'right',propId:'occupied'});
    const prop=makeProp('blocked-tug','ball');
    const returned=api.beginPropContest(prop,5,'right',4567);
    return {returned,prop:propSummary(prop)};
  }
};

for(const [name,scenario] of Object.entries(scenarios)){
  const expected=run(frozenFactory,scenario);
  const actual=run(candidateFactory,scenario);
  assert.deepEqual(actual,expected,`Translated prop grip core diverged from frozen V1 in ${name}.`);
}

console.log(`Translated prop grip core matches frozen V1 across ${Object.keys(scenarios).length} scenarios.`);
