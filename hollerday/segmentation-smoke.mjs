import assert from "node:assert/strict";

const added=[];
const removed=[];
globalThis.Matter={
  Body:{applyForce(){},setVelocity(){},setAngularVelocity(){}},
  Composite:{add(world,item){added.push(item);},remove(world,item){removed.push(item);}},
  Vector:{rotate(point){return{...point};}},
};

const seg=await import("./src/segmentation.js");
const body=(x,y)=>({position:{x,y},angle:0,velocity:{x:0,y:0},angularVelocity:0,mass:1,torque:0});
const seam={bodyA:body(0,0),pointA:{x:0,y:0},bodyB:body(0,0),pointB:{x:0,y:0},stiffness:.995,damping:.2};
const joint={bodyA:body(50,0),pointA:{x:0,y:0},bodyB:body(50,0),pointB:{x:0,y:0},stiffness:.9,damping:.2};
const puppet={
  world:{},parts:{torso:body(0,0)},
  seams:{leftForearm:seam},seamMeta:{leftForearm:{radius:13}},brokenSeams:new Set(),
  jointMap:{leftElbow:joint},joints:[joint],severedJoints:new Set(),repairRequested:false,
};

let candidate=seg.cutCandidateAlongPath(puppet,{x:-10,y:0},{x:10,y:0});
assert.equal(candidate.kind,"seam");
assert.equal(candidate.name,"leftForearm");
assert.equal(seg.severCandidate(puppet,candidate),true);
assert.equal(puppet.brokenSeams.has("leftForearm"),true);
assert.equal(puppet.repairRequested,false,"ordinary cutting must not trigger recovery");

candidate=seg.cutCandidateAlongPath(puppet,{x:40,y:0},{x:60,y:0});
assert.equal(candidate.kind,"joint");
assert.equal(candidate.name,"leftElbow");
assert.equal(seg.severCandidate(puppet,candidate),true);
assert.equal(puppet.severedJoints.has("leftElbow"),true);
assert.equal(puppet.joints.includes(joint),false,"severed joints must stop participating in joint-limit control");

seg.requestConnectionRepair(puppet);
seg.driveConnectionRepair(puppet);
assert.equal(puppet.brokenSeams.size,0);
assert.equal(puppet.severedJoints.size,0);
assert.equal(puppet.joints.includes(joint),true);
assert.equal(puppet.repairRequested,false);
assert.ok(added.includes(seam)&&added.includes(joint));
assert.ok(removed.includes(seam)&&removed.includes(joint));

console.log("Hollerday segmentation smoke passed.");
