const { Body, Composite, Vector } = Matter;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function worldPoint(body,local={x:0,y:0}){
  if(!body)return null;
  const r=Vector.rotate(local,body.angle||0);
  return{x:body.position.x+r.x,y:body.position.y+r.y};
}

function connectionPoints(constraint){
  if(!constraint?.bodyA||!constraint?.bodyB)return null;
  const a=worldPoint(constraint.bodyA,constraint.pointA||{x:0,y:0});
  const b=worldPoint(constraint.bodyB,constraint.pointB||{x:0,y:0});
  return a&&b?{a,b}:null;
}

function cutPoint(constraint){
  const points=connectionPoints(constraint);
  return points?{x:(points.a.x+points.b.x)*.5,y:(points.a.y+points.b.y)*.5}:null;
}

function segmentDistance(point,a,b){
  const abx=b.x-a.x,aby=b.y-a.y,d=abx*abx+aby*aby;
  if(d<1e-6)return Math.hypot(point.x-a.x,point.y-a.y);
  const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);
  return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));
}

function angleDelta(target,current){
  let d=target-current;
  while(d>Math.PI)d-=Math.PI*2;
  while(d< -Math.PI)d+=Math.PI*2;
  return d;
}

export function cutCandidateAlongPath(puppet,previous,current){
  if(!puppet||!previous||!current)return null;
  let best=null;
  for(const [name,constraint] of Object.entries(puppet.jointMap||{})){
    if(puppet.severedJoints?.has(name))continue;
    const point=cutPoint(constraint);if(!point)continue;
    const distance=segmentDistance(point,previous,current);
    if(distance<=13&&(!best||distance<best.distance))best={kind:"joint",name,distance};
  }
  for(const [name,constraint] of Object.entries(puppet.seams||{})){
    if(puppet.brokenSeams?.has(name))continue;
    const point=cutPoint(constraint);if(!point)continue;
    const distance=segmentDistance(point,previous,current);
    const radius=puppet.seamMeta?.[name]?.radius||14;
    if(distance<=radius&&(!best||distance<best.distance))best={kind:"seam",name,distance};
  }
  return best;
}

export function severCandidate(puppet,candidate){
  if(!puppet?.world||!candidate)return false;
  if(candidate.kind==="seam"){
    const constraint=puppet.seams?.[candidate.name];
    if(!constraint||puppet.brokenSeams?.has(candidate.name))return false;
    Composite.remove(puppet.world,constraint,true);
    puppet.brokenSeams.add(candidate.name);
  }else{
    const constraint=puppet.jointMap?.[candidate.name];
    if(!constraint||puppet.severedJoints?.has(candidate.name))return false;
    Composite.remove(puppet.world,constraint,true);
    puppet.severedJoints.add(candidate.name);
  }
  puppet.repairRequested=false;
  return true;
}

export function requestConnectionRepair(puppet){
  if(!puppet)return;
  puppet.repairRequested=true;
}

export function driveConnectionRepair(puppet){
  if(!puppet?.repairRequested||!puppet.world)return;

  for(const name of [...(puppet.brokenSeams||[])]){
    const constraint=puppet.seams?.[name];
    const points=connectionPoints(constraint);
    if(!constraint||!points)continue;
    const dx=points.b.x-points.a.x,dy=points.b.y-points.a.y,gap=Math.hypot(dx,dy);
    if(gap<20){
      Composite.add(puppet.world,constraint);
      puppet.brokenSeams.delete(name);
      continue;
    }
    const pull=Math.min(.00032,.00011+gap*.0000024);
    const ma=Math.max(.2,constraint.bodyA.mass||1),mb=Math.max(.2,constraint.bodyB.mass||1);
    Body.applyForce(constraint.bodyA,points.a,{x:dx*pull*ma,y:dy*pull*ma});
    Body.applyForce(constraint.bodyB,points.b,{x:-dx*pull*mb,y:-dy*pull*mb});
    const rel=angleDelta(constraint.bodyB.angle||0,constraint.bodyA.angle||0);
    constraint.bodyA.torque+=clamp(rel*.0025,-.012,.012);
    constraint.bodyB.torque-=clamp(rel*.0025,-.012,.012);
  }

  for(const name of [...(puppet.severedJoints||[])]){
    const constraint=puppet.jointMap?.[name];
    const points=connectionPoints(constraint);
    if(!constraint||!points)continue;
    if(Math.hypot(points.a.x-points.b.x,points.a.y-points.b.y)>34)continue;
    Composite.add(puppet.world,constraint);
    puppet.severedJoints.delete(name);
  }

  if(!puppet.brokenSeams?.size&&!puppet.severedJoints?.size)puppet.repairRequested=false;
}

export function stabiliseIntactSeams(puppet){
  if(!puppet?.seams)return;
  for(const [name,constraint] of Object.entries(puppet.seams)){
    if(!constraint?.bodyA||!constraint?.bodyB||puppet.brokenSeams?.has(name))continue;
    constraint.stiffness=.999;
    constraint.damping=Math.max(.28,constraint.damping||0);
    const a=constraint.bodyA,b=constraint.bodyB;
    const delta=angleDelta(b.angle||0,a.angle||0);
    const relativeSpin=(b.angularVelocity||0)-(a.angularVelocity||0);
    const correction=clamp(delta*.040+relativeSpin*.012,-.075,.075);
    a.torque+=correction;
    b.torque-=correction;
  }
}

export function connectionDamageState(puppet){
  return{
    brokenSeams:[...(puppet?.brokenSeams||[])],
    severedJoints:[...(puppet?.severedJoints||[])],
  };
}
