import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const frozen=fs.readFileSync('translation/generated/app-final.js','utf8');
const startMarker='  function localOffset(body,world){';
const endMarker='\n  function installDartImpacts(){';
const start=frozen.indexOf(startMarker);
const end=frozen.indexOf(endMarker,start);
assert.ok(start>=0 && end>start,'Could not isolate frozen V1 prop attachment core.');
const frozenBlock=frozen.slice(start,end).replace(/^  /gm,'');

const frozenBuilder=new Function(
  'Vector','Body','performance','cancelPropContest','releasePropHolder',
  `${frozenBlock}\nreturn {localOffset,worldOffset,attachPropToBody,detachPropAttachment,syncAttachedProp};`
);

const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync('translation/props/attachment-core.js','utf8'),context,{filename:'attachment-core.js'});
const candidateApi=context.PuppetalkPropAttachmentCore;
assert.equal(typeof candidateApi?.create,'function','Translated prop attachment candidate failed to load.');

function makeHarness(){
  const calls=[];
  let currentNow=1000;
  const Vector={rotate(point,angle){
    const c=Math.cos(angle),s=Math.sin(angle);
    return {x:point.x*c-point.y*s,y:point.x*s+point.y*c};
  }};
  const Body={
    setStatic(body,value){calls.push(['setStatic',value]);body.isStatic=value;},
    setVelocity(body,value){calls.push(['setVelocity',{...value}]);body.velocity={...value};},
    setPosition(body,value){calls.push(['setPosition',{...value}]);body.position={...value};},
    setAngle(body,value){calls.push(['setAngle',value]);body.angle=value;}
  };
  const performance={now:()=>currentNow};
  const cancelPropContest=prop=>{calls.push(['cancelPropContest',prop?.id||null]);if(prop) prop.contest=null;};
  const releasePropHolder=(prop,promote)=>{calls.push(['releasePropHolder',prop?.id||null,promote]);if(prop) prop.heldBy=null;};
  return {
    deps:{Vector,Body,performance,cancelPropContest,releasePropHolder},
    calls,
    setNow:value=>{currentNow=value;}
  };
}

function summarizeProp(prop){
  const a=prop?.attachedTo;
  return {
    heldBy:prop?.heldBy??null,
    contest:prop?.contest??null,
    attachedTo:a?{
      slot:a.slot,
      part:a.part,
      offset:a.offset?{...a.offset}:null,
      angle:a.angle,
      mode:a.mode,
      stringLength:a.stringLength,
      phase:a.phase,
      bodyPosition:a.body?.position?{...a.body.position}:null,
      bodyAngle:a.body?.angle,
      bodyVelocity:a.body?.velocity?{...a.body.velocity}:null
    }:null,
    body:prop?.body?{
      position:prop.body.position?{...prop.body.position}:null,
      angle:prop.body.angle,
      velocity:prop.body.velocity?{...prop.body.velocity}:null,
      isStatic:prop.body.isStatic,
      mask:prop.body.collisionFilter?.mask
    }:null
  };
}
function normalize(value){return JSON.parse(JSON.stringify(value));}
function run(factory,scenario){
  const h=makeHarness();
  const api=factory(h.deps);
  assert.ok(api && typeof api.attachPropToBody==='function','Attachment core was not created.');
  const result=scenario(api,h);
  return normalize({result,calls:h.calls});
}

const frozenFactory=deps=>frozenBuilder(deps.Vector,deps.Body,deps.performance,deps.cancelPropContest,deps.releasePropHolder);
const candidateFactory=deps=>candidateApi.create(deps);

const scenarios={
  offsetRoundTrip(api){
    const body={position:{x:70,y:45},angle:.63};
    const world={x:113,y:92};
    const local=api.localOffset(body,world);
    return {local,world:api.worldOffset(body,local)};
  },
  attachFresh(api){
    const targetBody={position:{x:100,y:50},angle:.4,velocity:{x:2,y:-1}};
    const prop={id:'dart-a',heldBy:null,contest:{slot:4},attachedTo:null,body:{position:{x:120,y:65},angle:.9,collisionFilter:{mask:123},velocity:{x:3,y:2}}};
    const returned=api.attachPropToBody(prop,{slot:2,part:'uaL',body:targetBody});
    return {returned,prop:summarizeProp(prop)};
  },
  attachHeld(api){
    const targetBody={position:{x:10,y:20},angle:-.3,velocity:{x:0,y:0}};
    const prop={id:'held-dart',heldBy:{slot:1,hand:'left'},contest:{slot:5},attachedTo:null,body:{position:{x:18,y:29},angle:.2,collisionFilter:{mask:999}}};
    const returned=api.attachPropToBody(prop,{slot:3,part:'torso',body:targetBody});
    return {returned,prop:summarizeProp(prop)};
  },
  attachRejectedExisting(api){
    const oldBody={position:{x:1,y:2},angle:0};
    const targetBody={position:{x:10,y:20},angle:0};
    const prop={id:'already',heldBy:{slot:1,hand:'right'},contest:{slot:2},attachedTo:{slot:0,part:'head',body:oldBody,offset:{x:0,y:0},angle:0},body:{position:{x:5,y:5},angle:0,collisionFilter:{mask:7}}};
    const returned=api.attachPropToBody(prop,{slot:3,part:'torso',body:targetBody});
    return {returned,prop:summarizeProp(prop)};
  },
  attachRejectedMissingTarget(api){
    const prop={id:'missing',heldBy:null,contest:{slot:2},attachedTo:null,body:{position:{x:5,y:5},angle:0,collisionFilter:{mask:7}}};
    const returned=api.attachPropToBody(prop,{slot:3,part:'torso',body:null});
    return {returned,prop:summarizeProp(prop)};
  },
  detachInheritedVelocity(api){
    const targetBody={position:{x:8,y:9},angle:.1,velocity:{x:-4,y:6}};
    const prop={id:'attached',heldBy:null,contest:null,attachedTo:{slot:1,part:'faR',body:targetBody,offset:{x:3,y:2},angle:.5},body:{position:{x:10,y:12},angle:.6,velocity:{x:1,y:1},isStatic:true,collisionFilter:{mask:0}}};
    const returned=api.detachPropAttachment(prop);
    return {returned,prop:summarizeProp(prop)};
  },
  detachMissingVelocity(api){
    const targetBody={position:{x:8,y:9},angle:.1};
    const prop={id:'attached-zero',attachedTo:{slot:1,part:'head',body:targetBody,offset:{x:0,y:0},angle:0},body:{position:{x:10,y:12},angle:.6,isStatic:true,collisionFilter:{mask:0}}};
    const returned=api.detachPropAttachment(prop);
    return {returned,prop:summarizeProp(prop)};
  },
  detachRejected(api){
    const prop={id:'loose',attachedTo:null,body:{position:{x:1,y:2},angle:0,collisionFilter:{mask:42}}};
    const returned=api.detachPropAttachment(prop);
    return {returned,prop:summarizeProp(prop)};
  },
  syncEmbedded(api){
    const targetBody={position:{x:100,y:80},angle:.5};
    const prop={id:'sync',attachedTo:{slot:0,part:'torso',body:targetBody,offset:{x:15,y:-4},angle:.27},body:{position:{x:0,y:0},angle:0,collisionFilter:{mask:0}}};
    const returned=api.syncAttachedProp(prop);
    return {returned,prop:summarizeProp(prop)};
  },
  syncBalloon(api,h){
    h.setNow(4321);
    const targetBody={position:{x:50,y:60},angle:-.2};
    const prop={id:'balloon',attachedTo:{slot:0,part:'head',body:targetBody,offset:{x:6,y:3},angle:0,mode:'balloon',stringLength:70,phase:1.2},body:{position:{x:0,y:0},angle:0,collisionFilter:{mask:0}}};
    const returned=api.syncAttachedProp(prop);
    return {returned,prop:summarizeProp(prop)};
  },
  syncBalloonDefaults(api,h){
    h.setNow(2222);
    const targetBody={position:{x:20,y:30},angle:.3};
    const prop={id:'balloon-default',attachedTo:{slot:0,part:'head',body:targetBody,offset:{x:1,y:2},angle:0,mode:'balloon'},body:{position:{x:0,y:0},angle:0,collisionFilter:{mask:0}}};
    api.syncAttachedProp(prop);
    return {prop:summarizeProp(prop)};
  },
  syncRejectedMissingBody(api){
    const prop={id:'orphan',attachedTo:{slot:0,part:'head',body:null,offset:{x:1,y:2}},body:{position:{x:7,y:8},angle:.4,collisionFilter:{mask:0}}};
    const returned=api.syncAttachedProp(prop);
    return {returned,prop:summarizeProp(prop)};
  }
};

for(const [name,scenario] of Object.entries(scenarios)){
  const expected=run(frozenFactory,scenario);
  const actual=run(candidateFactory,scenario);
  assert.deepEqual(actual,expected,`Translated prop attachment core diverged from frozen V1 in ${name}.`);
}

console.log(`Translated prop attachment core matches frozen V1 across ${Object.keys(scenarios).length} scenarios.`);
