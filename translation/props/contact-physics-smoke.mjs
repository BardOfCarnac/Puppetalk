import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const frozen=fs.readFileSync('translation/generated/app-final.js','utf8');
const startMarker='  function installPropContactPhysics(){';
const endMarker='\n\n  resize();';
const start=frozen.indexOf(startMarker);
const end=frozen.indexOf(endMarker,start);
assert.ok(start>=0 && end>start,'Could not isolate frozen V1 prop contact physics.');
const frozenFunction=frozen.slice(start,end).replace(/^  /gm,'');

const frozenBuilder=new Function(
  'Matter','engine','propForBody','puppetPartForBody','puppets','handBody','closestPointOnBody','tieBalloonToBody','performance','Vector','Body','clamp',
  `${frozenFunction}\nreturn {installPropContactPhysics};`
);

const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync('translation/props/contact-physics.js','utf8'),context,{filename:'contact-physics.js'});
const candidateApi=context.PuppetalkPropContactPhysics;
assert.equal(typeof candidateApi?.create,'function','Translated prop contact candidate failed to load.');

function makeHarness(){
  const registrations=[];
  const ties=[];
  const velocityCalls=[];
  const angularCalls=[];
  const bodyProps=new Map();
  const bodyTargets=new Map();
  const puppets=new Map();
  let currentNow=1000;
  const engine={world:{}};

  const Matter={Events:{on(target,event,handler){
    assert.equal(target,engine,'Contact physics registered on the wrong engine.');
    registrations.push({event,handler});
  }}};
  const propForBody=body=>bodyProps.get(body)||null;
  const puppetPartForBody=body=>bodyTargets.get(body)||null;
  const handBody=(holder,hand)=>holder?.hands?.[hand]||null;
  const closestPointOnBody=(body,point)=>({x:(body.position?.x||0)+(point?.x||0)*.01,y:(body.position?.y||0)+(point?.y||0)*.01});
  const tieBalloonToBody=(prop,target)=>{
    ties.push({prop:prop.id,target:{slot:target.slot,part:target.part,point:{...target.point}}});
    prop.attachedTo=target;
  };
  const performance={now:()=>currentNow};
  const Vector={rotate(point,angle){
    const c=Math.cos(angle),s=Math.sin(angle);
    return {x:point.x*c-point.y*s,y:point.x*s+point.y*c};
  }};
  const Body={
    setVelocity(body,value){ velocityCalls.push({x:value.x,y:value.y}); body.velocity={...value}; },
    setAngularVelocity(body,value){ angularCalls.push(value); body.angularVelocity=value; }
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  return {
    deps:{Matter,engine,propForBody,puppetPartForBody,puppets,handBody,closestPointOnBody,tieBalloonToBody,performance,Vector,Body,clamp},
    registrations,ties,velocityCalls,angularCalls,bodyProps,bodyTargets,puppets,
    setNow:value=>{currentNow=value;},
    fire(event,pairs){
      const registration=registrations.find(item=>item.event===event);
      assert.ok(registration,`Missing ${event} registration.`);
      registration.handler({pairs});
    }
  };
}

function normalize(value){
  return JSON.parse(JSON.stringify(value));
}

function run(factory,scenario){
  const h=makeHarness();
  const api=factory(h.deps);
  assert.equal(typeof api?.installPropContactPhysics,'function','Contact installer was not created.');
  api.installPropContactPhysics();
  const result=scenario(h);
  return normalize({
    registrations:h.registrations.map(item=>item.event),
    ties:h.ties,
    velocityCalls:h.velocityCalls,
    angularCalls:h.angularCalls,
    result
  });
}

const frozenFactory=deps=>frozenBuilder(
  deps.Matter,deps.engine,deps.propForBody,deps.puppetPartForBody,deps.puppets,deps.handBody,
  deps.closestPointOnBody,deps.tieBalloonToBody,deps.performance,deps.Vector,deps.Body,deps.clamp
);
const candidateFactory=deps=>candidateApi.create(deps);

const scenarios={
  balloonAttach(h){
    const propBody={position:{x:30,y:40}};
    const limb={position:{x:100,y:200}};
    const prop={id:'balloon-a',type:'balloon',body:propBody,attachedTo:null,contest:null,heldBy:null};
    h.bodyProps.set(propBody,prop);
    h.bodyTargets.set(limb,{slot:2,part:'uaL',body:limb});
    h.fire('collisionStart',[{bodyA:propBody,bodyB:limb}]);
    return {attached:!!prop.attachedTo};
  },
  balloonHeldBySameHand(h){
    const propBody={position:{x:5,y:6}};
    const hand={position:{x:10,y:11}};
    const prop={id:'balloon-held',type:'balloon',body:propBody,attachedTo:null,contest:null,heldBy:{slot:1,hand:'left'}};
    h.puppets.set(1,{hands:{left:hand}});
    h.bodyProps.set(propBody,prop);
    h.bodyTargets.set(hand,{slot:1,part:'faL2',body:hand});
    h.fire('collisionStart',[{bodyA:hand,bodyB:propBody}]);
    return {attached:!!prop.attachedTo};
  },
  balloonHeldTouchesOtherPart(h){
    const propBody={position:{x:12,y:8}};
    const heldHand={position:{x:20,y:20}};
    const torso={position:{x:70,y:80}};
    const prop={id:'balloon-other',type:'balloon',body:propBody,attachedTo:null,contest:null,heldBy:{slot:1,hand:'left'}};
    h.puppets.set(1,{hands:{left:heldHand}});
    h.bodyProps.set(propBody,prop);
    h.bodyTargets.set(torso,{slot:1,part:'torso',body:torso});
    h.fire('collisionStart',[{bodyA:torso,bodyB:propBody}]);
    return {attached:!!prop.attachedTo};
  },
  ballKick(h){
    h.setNow(1000);
    const ballBody={velocity:{x:1,y:0},angularVelocity:.1};
    const shin={position:{x:0,y:0},angle:0,velocity:{x:4,y:-2},angularVelocity:.5};
    const prop={id:'ball',type:'ball',body:ballBody,heldBy:null,attachedTo:null,_lastKickAt:0};
    h.bodyProps.set(ballBody,prop);
    h.bodyTargets.set(shin,{slot:0,part:'shL',body:shin});
    h.fire('collisionActive',[{bodyA:shin,bodyB:ballBody}]);
    return {_lastKickAt:prop._lastKickAt,velocity:ballBody.velocity,angularVelocity:ballBody.angularVelocity};
  },
  cappedKick(h){
    h.setNow(2000);
    const ballBody={velocity:{x:12,y:9},angularVelocity:.3};
    const shin={position:{x:0,y:0},angle:.4,velocity:{x:20,y:18},angularVelocity:2};
    const prop={id:'fast-ball',type:'ball',body:ballBody,heldBy:null,attachedTo:null,_lastKickAt:0};
    h.bodyProps.set(ballBody,prop);
    h.bodyTargets.set(shin,{slot:0,part:'shR',body:shin});
    h.fire('collisionActive',[{bodyA:ballBody,bodyB:shin}]);
    return {_lastKickAt:prop._lastKickAt,velocity:ballBody.velocity,angularVelocity:ballBody.angularVelocity};
  },
  slowFootDoesNothing(h){
    h.setNow(3000);
    const ballBody={velocity:{x:2,y:1},angularVelocity:.2};
    const shin={position:{x:0,y:0},angle:0,velocity:{x:.2,y:.1},angularVelocity:0};
    const prop={id:'slow-ball',type:'ball',body:ballBody,heldBy:null,attachedTo:null,_lastKickAt:0};
    h.bodyProps.set(ballBody,prop);
    h.bodyTargets.set(shin,{slot:0,part:'shL',body:shin});
    h.fire('collisionActive',[{bodyA:ballBody,bodyB:shin}]);
    return {_lastKickAt:prop._lastKickAt,velocity:ballBody.velocity,angularVelocity:ballBody.angularVelocity};
  },
  kickCooldown(h){
    h.setNow(3100);
    const ballBody={velocity:{x:0,y:0},angularVelocity:0};
    const shin={position:{x:0,y:0},angle:0,velocity:{x:5,y:0},angularVelocity:0};
    const prop={id:'cooldown-ball',type:'ball',body:ballBody,heldBy:null,attachedTo:null,_lastKickAt:3000};
    h.bodyProps.set(ballBody,prop);
    h.bodyTargets.set(shin,{slot:0,part:'shR',body:shin});
    h.fire('collisionActive',[{bodyA:ballBody,bodyB:shin}]);
    return {_lastKickAt:prop._lastKickAt,velocity:ballBody.velocity,angularVelocity:ballBody.angularVelocity};
  }
};

for(const [name,scenario] of Object.entries(scenarios)){
  const expected=run(frozenFactory,scenario);
  const actual=run(candidateFactory,scenario);
  assert.deepEqual(actual,expected,`Translated prop contact physics diverged from frozen V1 in ${name}.`);
}

const registrationProbe=run(candidateFactory,()=>null);
assert.deepEqual(registrationProbe.registrations,['collisionStart','collisionActive'],'Prop collision listener registration order changed.');

console.log(`Translated prop contact physics matches frozen V1 across ${Object.keys(scenarios).length} collision scenarios.`);
