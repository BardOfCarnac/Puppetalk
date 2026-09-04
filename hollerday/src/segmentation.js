import { WORLD } from "./config.js";

const { Body, Composite, Vector } = Matter;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const SEGMENT_RECOVERY=Object.freeze({
  torso:[0,0,0],torsoTop:[0,-26,0],torsoBottom:[0,26,0],
  head:[0,-53,0],headTop:[0,-77,0],
  upperArmL:[-37,-30,.12],upperArmL2:[-37,-4,.12],lowerArmL:[-42,18,.05],lowerArmL2:[-42,42.5,.05],
  upperArmR:[37,-30,-.12],upperArmR2:[37,-4,-.12],lowerArmR:[42,18,-.05],lowerArmR2:[42,42.5,-.05],
  upperLegL:[-14,50.5,.04],upperLegL2:[-14,79.5,.04],lowerLegL:[-14,104.5,.02],lowerLegL2:[-14,131.5,.02],
  upperLegR:[14,50.5,-.04],upperLegR2:[14,79.5,-.04],lowerLegR:[14,104.5,-.02],lowerLegR2:[14,131.5,-.02],
});

function worldPoint(body,local={x:0,y:0}){if(!body)return null;const r=Vector.rotate(local,body.angle||0);return{x:body.position.x+r.x,y:body.position.y+r.y};}
function connectionPoints(constraint){if(!constraint?.bodyA||!constraint?.bodyB)return null;const a=worldPoint(constraint.bodyA,constraint.pointA||{x:0,y:0}),b=worldPoint(constraint.bodyB,constraint.pointB||{x:0,y:0});return a&&b?{a,b}:null;}
function cutPoint(constraint){const points=connectionPoints(constraint);return points?{x:(points.a.x+points.b.x)*.5,y:(points.a.y+points.b.y)*.5}:null;}
function segmentDistance(point,a,b){const abx=b.x-a.x,aby=b.y-a.y,d=abx*abx+aby*aby;if(d<1e-6)return Math.hypot(point.x-a.x,point.y-a.y);const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/d,0,1);return Math.hypot(point.x-(a.x+abx*t),point.y-(a.y+aby*t));}
function angleDelta(target,current){let d=target-current;while(d>Math.PI)d-=Math.PI*2;while(d< -Math.PI)d+=Math.PI*2;return d;}
function springPull(body,point,target,stiffness,damping=.0048,cap=.032){if(!body||!point||!target)return;const mass=Math.max(.2,body.mass||1);let fx=((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,fy=((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;const mag=Math.hypot(fx,fy);if(mag>cap){fx*=cap/mag;fy*=cap/mag;}Body.applyForce(body,point,{x:fx,y:fy});}
function servo(body,target,strength=.014){if(!body)return;body.torque+=clamp(angleDelta(target,body.angle||0)*strength-(body.angularVelocity||0)*strength*.82,-.034,.034);}

export function cutCandidateAlongPath(puppet,previous,current){
  if(!puppet||!previous||!current)return null;
  let best=null;
  for(const [name,constraint] of Object.entries(puppet.jointMap||{})){if(puppet.severedJoints?.has(name))continue;const point=cutPoint(constraint);if(!point)continue;const distance=segmentDistance(point,previous,current);if(distance<=13&&(!best||distance<best.distance))best={kind:"joint",name,distance};}
  for(const [name,constraint] of Object.entries(puppet.seams||{})){if(puppet.brokenSeams?.has(name))continue;const point=cutPoint(constraint);if(!point)continue;const distance=segmentDistance(point,previous,current),radius=puppet.seamMeta?.[name]?.radius||14;if(distance<=radius&&(!best||distance<best.distance))best={kind:"seam",name,distance};}
  return best;
}

export function severCandidate(puppet,candidate){
  if(!puppet?.world||!candidate)return false;
  if(candidate.kind==="seam"){
    const constraint=puppet.seams?.[candidate.name];if(!constraint||puppet.brokenSeams?.has(candidate.name))return false;Composite.remove(puppet.world,constraint,true);puppet.brokenSeams.add(candidate.name);
  }else{
    const constraint=puppet.jointMap?.[candidate.name];if(!constraint||puppet.severedJoints?.has(candidate.name))return false;Composite.remove(puppet.world,constraint,true);puppet.severedJoints.add(candidate.name);const index=puppet.joints?.indexOf(constraint)??-1;if(index>=0)puppet.joints.splice(index,1);
  }
  puppet.repairRequested=false;return true;
}

export function requestConnectionRepair(puppet){if(puppet)puppet.repairRequested=true;}

export function driveConnectionRepair(puppet){
  if(!puppet?.repairRequested||!puppet.world)return;
  for(const name of [...(puppet.brokenSeams||[])]){
    const constraint=puppet.seams?.[name],points=connectionPoints(constraint);if(!constraint||!points)continue;
    const dx=points.b.x-points.a.x,dy=points.b.y-points.a.y,gap=Math.hypot(dx,dy);
    if(gap<20){Composite.add(puppet.world,constraint);puppet.brokenSeams.delete(name);continue;}
    const pull=Math.min(.00032,.00011+gap*.0000024),ma=Math.max(.2,constraint.bodyA.mass||1),mb=Math.max(.2,constraint.bodyB.mass||1);
    Body.applyForce(constraint.bodyA,points.a,{x:dx*pull*ma,y:dy*pull*ma});Body.applyForce(constraint.bodyB,points.b,{x:-dx*pull*mb,y:-dy*pull*mb});
    const rel=angleDelta(constraint.bodyB.angle||0,constraint.bodyA.angle||0);constraint.bodyA.torque+=clamp(rel*.0025,-.012,.012);constraint.bodyB.torque-=clamp(rel*.0025,-.012,.012);
  }
  for(const name of [...(puppet.severedJoints||[])]){
    const constraint=puppet.jointMap?.[name],points=connectionPoints(constraint);if(!constraint||!points)continue;if(Math.hypot(points.a.x-points.b.x,points.a.y-points.b.y)>34)continue;Composite.add(puppet.world,constraint);puppet.severedJoints.delete(name);if(!puppet.joints.includes(constraint))puppet.joints.push(constraint);
  }
  if(!puppet.brokenSeams?.size&&!puppet.severedJoints?.size)puppet.repairRequested=false;
}

export function stabiliseIntactSeams(puppet){
  if(!puppet?.seams)return;
  for(const [name,constraint] of Object.entries(puppet.seams)){
    if(!constraint?.bodyA||!constraint?.bodyB||puppet.brokenSeams?.has(name))continue;
    constraint.stiffness=.999;constraint.damping=Math.max(.28,constraint.damping||0);
    const a=constraint.bodyA,b=constraint.bodyB,delta=angleDelta(b.angle||0,a.angle||0),relativeSpin=(b.angularVelocity||0)-(a.angularVelocity||0),correction=clamp(delta*.040+relativeSpin*.012,-.075,.075);a.torque+=correction;b.torque-=correction;
  }
}

function activeGrab(state,part){return state?.grabsArray?.find(grab=>grab.part===part)||null;}
function broken(puppet,name){return !!puppet.brokenSeams?.has(name);}

function driveSegmentRecovery(puppet){
  const state=puppet.behaviour,recover=state?.recover;if(!recover)return;
  const engage=clamp((performance.now()-recover.startedAt)/320,0,1);
  for(const [name,[ox,oy,targetAngle]] of Object.entries(SEGMENT_RECOVERY)){
    const body=puppet.parts[name];if(!body)continue;
    const target={x:recover.x+ox,y:recover.torsoY+oy};
    springPull(body,body.position,target,.00014+.00010*engage,.0062,.034);servo(body,targetAngle,.010+.008*engage);
  }
  requestConnectionRepair(puppet);driveConnectionRepair(puppet);
}

export function driveSegmentedCompatibility(puppet){
  if(!puppet?.parts?.torsoTop)return;
  stabiliseIntactSeams(puppet);
  const state=puppet.behaviour||{},p=puppet.parts;
  if(state.mode==="recovering"){driveSegmentRecovery(puppet);return;}
  if(state.mode==="limp")return;

  const standingY=WORLD.floorY-(state.pose==="crouch"?112:145),anchorX=clamp(Number(state.targetX)||p.torso.position.x,70,WORLD.width-70),crouched=state.pose==="crouch";
  const legSpread=crouched?22:12,wholeThighY=standingY+(crouched?48:61),wholeShinY=standingY+(crouched?88:112),thighY=wholeThighY-14.5,shinY=wholeShinY-13.5,footY=WORLD.floorY-2;

  for(const side of["L","R"]){
    const sign=side==="L"?-1:1,footPart=side==="L"?"leftFoot":"rightFoot",pin=state.pins?.[footPart];
    if(activeGrab(state,footPart)||pin)continue;
    const upper=p[`upperLeg${side}`],lower=p[`lowerLeg${side}`],distal=p[`lowerLeg${side}2`];
    springPull(upper,upper.position,{x:anchorX+sign*13,y:thighY},.00011,.0061,.022);
    springPull(lower,lower.position,{x:anchorX+sign*legSpread,y:shinY},.00014,.0062,.024);
    if(distal&&!broken(puppet,side==="L"?"leftShin":"rightShin"))springPull(distal,worldPoint(distal,{x:0,y:13.5}),{x:anchorX+sign*legSpread,y:footY},crouched?.00017:.00023,crouched?.0059:.0065,.025);
  }

  if(!activeGrab(state,"head")&&!state.pins?.head&&!broken(puppet,"headMiddle"))springPull(p.head,p.head.position,{x:anchorX,y:standingY-53},.00019,.0053,.020);

  if(state.pose==="stand"){
    for(const [side,part,seam] of [["L","leftHand","leftForearm"],["R","rightHand","rightForearm"]]){
      if(activeGrab(state,part)||state.pins?.[part]||broken(puppet,seam))continue;
      const distal=p[`lowerArm${side}2`],sign=side==="L"?-1:1;
      springPull(distal,worldPoint(distal,{x:0,y:12}),{x:anchorX+sign*34,y:standingY+50},.00012,.0062,.020);
    }
  }

  for(const [part,bodyName,seam,localY] of [["leftHand","lowerArmL2","leftForearm",12],["rightHand","lowerArmR2","rightForearm",12],["leftFoot","lowerLegL2","leftShin",13.5],["rightFoot","lowerLegR2","rightShin",13.5]]){
    const grab=activeGrab(state,part),body=p[bodyName];if(!grab||!body||!broken(puppet,seam))continue;springPull(body,worldPoint(body,{x:0,y:localY}),{x:grab.x,y:grab.y},.00024,.0030,.030);
  }

  const pose=state.pose;
  const targets={point:{leftHand:{x:p.torso.position.x-112,y:p.torso.position.y-27}},cheer:{leftHand:{x:p.torso.position.x-44,y:p.torso.position.y-124},rightHand:{x:p.torso.position.x+44,y:p.torso.position.y-124}}};
  for(const [part,target] of Object.entries(targets[pose]||{})){
    const side=part==="leftHand"?"L":"R",seam=side==="L"?"leftForearm":"rightForearm",body=p[`lowerArm${side}2`];if(!body||broken(puppet,seam)||activeGrab(state,part)||state.pins?.[part])continue;springPull(body,worldPoint(body,{x:0,y:12}),target,pose==="cheer"?.000265:.00025,.0039,.030);
  }
}

export function connectionDamageState(puppet){return{brokenSeams:[...(puppet?.brokenSeams||[])],severedJoints:[...(puppet?.severedJoints||[])]};}
