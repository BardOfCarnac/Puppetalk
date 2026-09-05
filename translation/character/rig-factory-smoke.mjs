import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/rig-factory.js','utf8'),context,{filename:'rig-factory.js'});
const api=context.window.PuppetalkRigFactory;
assert.ok(api?.create,'Rig factory did not install.');

const plain=value=>JSON.parse(JSON.stringify(value));
const bodyCalls=[];
const constraintCalls=[];
const compositeAdds=[];
let nextGroupArgs=[];
let lookCalls=[];

const Bodies={
  rectangle(x,y,w,h,options){
    const id=`body-${bodyCalls.length}`;
    const snapshot={id,x,y,w,h,options:plain(options)};
    bodyCalls.push(snapshot);
    return {id,position:{x,y},angle:0,plugin:{puppetalkPart:'legacy-canonical-marker'}};
  }
};
const Body={nextGroup(nonColliding){nextGroupArgs.push(nonColliding);return -17;}};
const Constraint={
  create(options){
    const id=`constraint-${constraintCalls.length}`;
    constraintCalls.push({
      id,
      bodyA:options.bodyA.id,
      pointA:plain(options.pointA),
      bodyB:options.bodyB.id,
      pointB:plain(options.pointB),
      length:options.length,
      stiffness:options.stiffness,
      damping:options.damping
    });
    return {id,...options};
  }
};
const engine={world:{id:'world'}};
const Composite={add(world,items){compositeAdds.push({world,items:[...items]});}};
const puppets=new Map();
const NAMES=['Ada','Bo','Cy'];
const COLORS=['#111111','#222222','#333333'];
const defaultLook=slot=>{lookCalls.push(slot);return {slot,headStyle:'spikes'};};
const W=1000,H=800,slot=2;
const x=W*(.16+slot*.135);
const y=Math.min(H-170,H*.62);
const getDimensions=()=>({W,H});

const factory=api.create({Bodies,Body,Composite,Constraint,engine,puppets,getDimensions,NAMES,COLORS,defaultLook});
assert.ok(factory?.makePuppet,'Rig factory did not expose makePuppet.');

const p=factory.makePuppet(slot);
assert.equal(puppets.get(slot),p,'makePuppet must register its result by slot.');
assert.deepEqual(nextGroupArgs,[true],'V1 uses one non-colliding Matter group per puppet.');
assert.deepEqual(lookCalls,[slot],'defaultLook must be resolved once for the new puppet.');
assert.equal(bodyCalls.length,21,'Frozen segmented puppet must create exactly 21 bodies.');
assert.equal(constraintCalls.length,20,'Frozen segmented puppet must create 11 seams plus 9 anatomical joints.');
assert.equal(compositeAdds.length,1,'Rig must be added to the Matter world in one composite add.');

const canonicalExpected=[
  [x,y,48,26,.0022,7],
  [x,y-53,44,24,.00068,11],
  [x-37,y-30,16,26,null,null],
  [x-42,y+18,15,25,null,null],
  [x+37,y-30,16,26,null,null],
  [x+42,y+18,15,25,null,null],
  [x-14,y+50.5,19,29,null,null],
  [x-14,y+104.5,17,27,null,null],
  [x+14,y+50.5,19,29,null,null],
  [x+14,y+104.5,17,27,null,null]
];
for(let i=0;i<canonicalExpected.length;i++){
  const [ex,ey,w,h,density,radius]=canonicalExpected[i];
  const call=bodyCalls[i];
  assert.deepEqual([call.x,call.y,call.w,call.h],[ex,ey,w,h],`Canonical body ${i} creation order/geometry drifted.`);
  assert.equal(call.options.collisionFilter.group,-17);
  assert.equal(call.options.frictionAir,.04);
  assert.equal(call.options.restitution,.08);
  assert.equal(call.options.friction,.8);
  if(density!==null) assert.equal(call.options.density,density,`Canonical body ${i} density drifted.`);
  else assert.ok(!('density' in call.options),`Canonical body ${i} unexpectedly gained a density override.`);
  if(radius!==null) assert.deepEqual(call.options.chamfer,{radius},`Canonical body ${i} chamfer drifted.`);
  else assert.ok(!('chamfer' in call.options),`Canonical body ${i} unexpectedly gained a chamfer.`);
}

const hiddenExpected=[
  ['torso','top',x,y-26,48,26],
  ['torso','bottom',x,y+26,48,26],
  ['head','top',x,y-77,44,24],
  ['uaL','distal',x-37,y-4,16,26],
  ['faL','distal',x-42,y+42.5,15,24],
  ['uaR','distal',x+37,y-4,16,26],
  ['faR','distal',x+42,y+42.5,15,24],
  ['thL','distal',x-14,y+79.5,19,29],
  ['shL','distal',x-14,y+131.5,17,27],
  ['thR','distal',x+14,y+79.5,19,29],
  ['shR','distal',x+14,y+131.5,17,27]
];
for(let i=0;i<hiddenExpected.length;i++){
  const [part,segment,ex,ey,w,h]=hiddenExpected[i];
  const call=bodyCalls[10+i];
  const body=p.bodies[10+i];
  assert.deepEqual([call.x,call.y,call.w,call.h],[ex,ey,w,h],`Hidden segment ${part}/${segment} geometry or order drifted.`);
  assert.equal(body.plugin.puppetalkSegmentPart,part);
  assert.equal(body.plugin.puppetalkSegment,segment);
  assert.equal(body.plugin.puppetalkSlot,slot);
  assert.ok(!('puppetalkPart' in body.plugin),'Hidden segments must remove the canonical stability marker.');
}

const seamNames=['torsoUpper','torsoLower','headMiddle','leftUpperArm','leftForearm','rightUpperArm','rightForearm','leftThigh','leftShin','rightThigh','rightShin'];
const jointNames=['neck','leftShoulder','leftElbow','rightShoulder','rightElbow','leftHip','leftKnee','rightHip','rightKnee'];
assert.deepEqual(Object.keys(p.seams),seamNames,'Seam insertion order/names drifted.');
assert.deepEqual(Object.keys(p.joints),jointNames,'Joint insertion order/names drifted.');
assert.deepEqual(constraintCalls.slice(0,11).map(item=>item.stiffness),Array(11).fill(.995),'All segmented seams must retain .995 stiffness.');
assert.deepEqual(constraintCalls.slice(11).map(item=>item.stiffness),Array(9).fill(.97),'Anatomical joints must retain default .97 stiffness.');
for(const c of constraintCalls){
  assert.equal(c.length,1,`${c.id} length drifted.`);
  assert.equal(c.damping,.13,`${c.id} damping drifted.`);
}

assert.deepEqual(plain(p.seamMeta),{
  torsoUpper:{radius:29,part:'torso'},torsoLower:{radius:29,part:'torso'},headMiddle:{radius:27,part:'head'},
  leftUpperArm:{radius:13,part:'uaL'},leftForearm:{radius:13,part:'faL'},rightUpperArm:{radius:13,part:'uaR'},rightForearm:{radius:13,part:'faR'},
  leftThigh:{radius:14,part:'thL'},leftShin:{radius:14,part:'shL'},rightThigh:{radius:14,part:'thR'},rightShin:{radius:14,part:'shR'}
});
assert.equal(p.slot,slot);
assert.equal(p.name,'Cy');
assert.equal(p.color,'#333333');
assert.deepEqual(plain(p.look),{slot,headStyle:'spikes'});
assert.equal(p.bodies.length,21);
assert.equal(p.constraints.length,20);
assert.equal(p.brokenSeams.size,0);
assert.equal(p.severedJoints.size,0);
assert.equal(p.recoverVersion,0);
assert.equal(p.repairRequested,false);
assert.deepEqual(plain(p.target),{x:x/W,y:y/H});
assert.deepEqual(plain(p.grabTarget),{x:x/W,y:y/H});
assert.equal(p.grabPart,'torso');
assert.equal(p.grabbing,false);
assert.equal(p.pose,'stand');
assert.equal(p.rag,false);
assert.equal(p.mouth,0);

const added=compositeAdds[0];
assert.equal(added.world,engine.world);
assert.deepEqual(added.items.slice(0,21).map(item=>item.id),Array.from({length:21},(_,i)=>`body-${i}`),'Matter body add order drifted.');
assert.deepEqual(added.items.slice(21,30).map(item=>item.id),Array.from({length:9},(_,i)=>`constraint-${11+i}`),'Anatomical joints must be added before seams.');
assert.deepEqual(added.items.slice(30).map(item=>item.id),Array.from({length:11},(_,i)=>`constraint-${i}`),'Seams must follow anatomical joints in Composite.add.');

const beforeBodies=bodyCalls.length,beforeConstraints=constraintCalls.length,beforeAdds=compositeAdds.length;
assert.equal(factory.makePuppet(slot),p,'Existing slot must return the existing puppet.');
assert.equal(bodyCalls.length,beforeBodies,'Existing slot must not construct more bodies.');
assert.equal(constraintCalls.length,beforeConstraints,'Existing slot must not construct more constraints.');
assert.equal(compositeAdds.length,beforeAdds,'Existing slot must not re-add the rig to Matter.');

console.log('Rig factory candidate exactly preserves V1 body order, segmentation, constraints and initial state.');