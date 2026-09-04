import { WORLD } from "./config.js";

const { Body, Composite, Vector } = Matter;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const POSES=Object.freeze({
  stand:[.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:[1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:[2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:[1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch:[.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13],
});
const MANUAL_PIN_HOLD_MS=170,MANUAL_PIN_FADE_MS=920;

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
function springPull(body,point,target,stiffness,damping=.0048,cap=.032){if(!body||!point||!target||stiffness<=0)return;const mass=Math.max(.2,body.mass||1);let fx=((target.x-point.x)*stiffness-body.velocity.x*damping)*mass,fy=((target.y-point.y)*stiffness-body.velocity.y*damping)*mass;const mag=Math.hypot(fx,fy);if(mag>cap){fx*=cap/mag;fy*=cap/mag;}Body.applyForce(body,point,{x:fx,y:fy});}
function servo(body,target,strength=.014){if(!body)return;body.torque+=clamp(angleDelta(target,body.angle||0)*strength-(body.angularVelocity||0)*strength*.82,-.034,.034);}
function pinInfluence(pin,now){if(!pin)return 0;if(!Number.isFinite(pin.releasedAt))return 1;const age=now-pin.releasedAt;if(age<=MANUAL_PIN_HOLD_MS)return 1;const t=clamp((age-MANUAL_PIN_HOLD_MS)/MANUAL_PIN_FADE_MS,0,1);return 1-(t*t*(3-2*t));}

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
  if(!puppet.brokenSeams?.size&&!puppet.severedJoints?.size){puppet.repairRequested=false;puppet.segmentRepairAnchor=null;}
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
function driveRepairLayout(puppet,anchor,engage=.9){
  if(!anchor)return;
  for(const [name,[ox,oy,targetAngle]] of Object.entries(SEGMENT_RECOVERY)){
    const body=puppet.parts[name];if(!body)continue;
    const target={x:anchor.x+ox,y:anchor.torsoY+oy};
    springPull(body,body.position,target,.00014+.00010*engage,.0062,.034);servo(body,targetAngle,.010+.008*engage);
  }
}
function driveSegmentRecovery(puppet){
  const state=puppet.behaviour,recover=state?.recover;if(!recover)return;
  puppet.segmentRepairAnchor={x:recover.x,torsoY:recover.torsoY};
  const engage=clamp((performance.now()-recover.startedAt)/320,0,1);
  driveRepairLayout(puppet,puppet.segmentRepairAnchor,engage);
  requestConnectionRepair(puppet);driveConnectionRepair(puppet);
}

function driveDistalPose(puppet,state){
  const p=puppet.parts,q=POSES[state.pose]||POSES.stand,base=q[8];
  const entries=[
    ["upperArmL2","leftUpperArm",0,["leftHand","leftShoulder"]],["lowerArmL2","leftForearm",1,["leftHand","leftShoulder"]],
    ["upperArmR2","rightUpperArm",2,["rightHand","rightShoulder"]],["lowerArmR2","rightForearm",3,["rightHand","rightShoulder"]],
    ["upperLegL2","leftThigh",4,["leftFoot","pelvis"]],["lowerLegL2","leftShin",5,["leftFoot","pelvis"]],
    ["upperLegR2","rightThigh",6,["rightFoot","pelvis"]],["lowerLegR2","rightShin",7,["rightFoot","pelvis"]],
  ];
  for(const [bodyName,seam,index,heldParts] of entries){
    const body=p[bodyName];if(!body||broken(puppet,seam)||heldParts.some(part=>activeGrab(state,part)))continue;servo(body,base+q[index],.016);
  }
  if(p.headTop&&!broken(puppet,"headMiddle")&&!activeGrab(state,"head"))servo(p.headTop,base*.2,.013);
  if(p.torsoTop&&!broken(puppet,"torsoUpper"))servo(p.torsoTop,base,.014);
  if(p.torsoBottom&&!broken(puppet,"torsoLower"))servo(p.torsoBottom,base,.014);
}

export function driveSegmentedCompatibility(puppet){
  if(!puppet?.parts?.torsoTop)return;
  stabiliseIntactSeams(puppet);
  const state=puppet.behaviour||{},p=puppet.parts,now=performance.now();
  if(state.mode==="recovering"){driveSegmentRecovery(puppet);return;}
  if(puppet.repairRequested){driveRepairLayout(puppet,puppet.segmentRepairAnchor,.88);driveConnectionRepair(puppet);}
  if(state.mode==="limp")return;

  const standingY=WORLD.floorY-(state.pose==="crouch"?112:145),anchorX=clamp(Number(state.targetX)||p.torso.position.x,70,WORLD.width-70),crouched=state.pose==="crouch";
  const legSpread=crouched?22:12,wholeThighY=standingY+(crouched?48:61),wholeShinY=standingY+(crouched?88:112),thighY=wholeThighY-14.5,shinY=wholeShinY-13.5,footY=WORLD.floorY-2;

  driveDistalPose(puppet,state);

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

  for(const [part,bodyName,localY] of [["leftHand","lowerArmL2",12],["rightHand","lowerArmR2",12],["leftFoot","lowerLegL2",13.5],["rightFoot","lowerLegR2",13.5]]){
    const grab=activeGrab(state,part),body=p[bodyName];if(!grab||!body)continue;springPull(body,worldPoint(body,{x:0,y:localY}),{x:grab.x,y:grab.y},.00024,.0030,.030);
  }

  for(const [part,bodyName,localY] of [["leftHand","lowerArmL2",12],["rightHand","lowerArmR2",12],["leftFoot","lowerLegL2",13.5],["rightFoot","lowerLegR2",13.5]]){
    if(activeGrab(state,part))continue;const pin=state.pins?.[part],influence=pinInfluence(pin,now),body=p[bodyName];if(!pin||!body||influence<=.001)continue;springPull(body,worldPoint(body,{x:0,y:localY}),{x:anchorX+pin.x,y:standingY+pin.y},.00016*influence,.0044,.023);
  }

  const targets={point:{leftHand:{x:p.torso.position.x-112,y:p.torso.position.y-27}},cheer:{leftHand:{x:p.torso.position.x-44,y:p.torso.position.y-124},rightHand:{x:p.torso.position.x+44,y:p.torso.position.y-124}}};
  for(const [part,target] of Object.entries(targets[state.pose]||{})){
    const side=part==="leftHand"?"L":"R",seam=side==="L"?"leftForearm":"rightForearm",body=p[`lowerArm${side}2`];if(!body||broken(puppet,seam)||activeGrab(state,part)||state.pins?.[part])continue;springPull(body,worldPoint(body,{x:0,y:12}),target,state.pose==="cheer"?.000265:.00025,.0039,.030);
  }
}

export function connectionDamageState(puppet){return{brokenSeams:[...(puppet?.brokenSeams||[])],severedJoints:[...(puppet?.severedJoints||[])]};}
