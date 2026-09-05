import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const frozen=fs.readFileSync('translation/generated/app-final.js','utf8');
const startMarker='  function installDartImpacts(){';
const endMarker='\n\n  function gripRecord(slot,hand)';
const start=frozen.indexOf(startMarker);
const end=frozen.indexOf(endMarker,start);
assert.ok(start>=0 && end>start,'Could not isolate frozen V1 dart impact installer.');
const frozenFunction=frozen.slice(start,end).replace(/^  /gm,'');

const frozenBuilder=new Function(
  'Matter','engine','propForBody','puppetPartForBody','attachPropToBody',
  `${frozenFunction}\nreturn {installDartImpacts};`
);

const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync('translation/props/dart-impacts.js','utf8'),context,{filename:'dart-impacts.js'});
const candidateApi=context.PuppetalkDartImpacts;
assert.equal(typeof candidateApi?.create,'function','Translated dart impact candidate failed to load.');

function makeHarness(){
  const registrations=[];
  const attachments=[];
  const bodyProps=new Map();
  const bodyTargets=new Map();
  const engine={world:{}};
  const Matter={Events:{on(target,event,handler){
    assert.equal(target,engine,'Dart impacts registered on the wrong engine.');
    registrations.push({event,handler});
  }}};
  const propForBody=body=>bodyProps.get(body)||null;
  const puppetPartForBody=body=>bodyTargets.get(body)||null;
  const attachPropToBody=(prop,target)=>{
    attachments.push({prop:prop.id,target:{slot:target.slot,part:target.part}});
    prop.attachedTo={slot:target.slot,part:target.part,body:target.body};
    return true;
  };
  return {
    deps:{Matter,engine,propForBody,puppetPartForBody,attachPropToBody},
    registrations,attachments,bodyProps,bodyTargets,
    fire(pairs){
      const registration=registrations.find(item=>item.event==='collisionStart');
      assert.ok(registration,'Missing collisionStart registration.');
      registration.handler({pairs});
    }
  };
}

function normalize(value){ return JSON.parse(JSON.stringify(value)); }
function run(factory,scenario){
  const h=makeHarness();
  const api=factory(h.deps);
  assert.equal(typeof api?.installDartImpacts,'function','Dart installer was not created.');
  api.installDartImpacts();
  const result=scenario(h);
  return normalize({registrations:h.registrations.map(item=>item.event),attachments:h.attachments,result});
}

const frozenFactory=deps=>frozenBuilder(
  deps.Matter,deps.engine,deps.propForBody,deps.puppetPartForBody,deps.attachPropToBody
);
const candidateFactory=deps=>candidateApi.create(deps);

function collisionScenario({reverse=false,type='dart',propVelocity={x:3,y:0},otherVelocity={x:0,y:0},heldBy=null,contest=null,attachedTo=null,target=true}={}){
  return h=>{
    const propBody={velocity:{...propVelocity}};
    const other={velocity:{...otherVelocity}};
    const prop={id:'dart-a',type,body:propBody,heldBy,contest,attachedTo};
    h.bodyProps.set(propBody,prop);
    if(target) h.bodyTargets.set(other,{slot:2,part:'uaL',body:other});
    h.fire([reverse?{bodyA:other,bodyB:propBody}:{bodyA:propBody,bodyB:other}]);
    return {attached:!!prop.attachedTo};
  };
}

const scenarios={
  forwardBodyOrder:collisionScenario(),
  reverseBodyOrder:collisionScenario({reverse:true}),
  exactThreshold:collisionScenario({propVelocity:{x:2.15,y:0}}),
  belowThreshold:collisionScenario({propVelocity:{x:2.149,y:0}}),
  movingTargetRelativeSpeed:collisionScenario({propVelocity:{x:4,y:2},otherVelocity:{x:2.5,y:1}}),
  heldDartIgnored:collisionScenario({heldBy:{slot:1,hand:'left'}}),
  contestedDartIgnored:collisionScenario({contest:{slot:2,hand:'right'}}),
  attachedDartIgnored:collisionScenario({attachedTo:{slot:0,part:'torso'}}),
  nonDartIgnored:collisionScenario({type:'ball'}),
  nonPuppetIgnored:collisionScenario({target:false})
};

for(const [name,scenario] of Object.entries(scenarios)){
  const expected=run(frozenFactory,scenario);
  const actual=run(candidateFactory,scenario);
  assert.deepEqual(actual,expected,`Translated dart impacts diverged from frozen V1 in ${name}.`);
}

const probe=run(candidateFactory,()=>null);
assert.deepEqual(probe.registrations,['collisionStart'],'Dart impact listener registration changed.');
console.log(`Translated dart impacts match frozen V1 across ${Object.keys(scenarios).length} collision scenarios.`);
