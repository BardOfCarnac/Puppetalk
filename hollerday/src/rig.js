import { initialisePuppetBehaviour, serialisePuppetBehaviour, depthScale, depthShift } from "./behaviour.js";
import { connectionDamageState } from "./segmentation.js";

const { Bodies, Body, Composite, Constraint, Vector } = Matter;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const PART_META = Object.freeze({
  torso: { shape: "rect", w: 48, h: 78 },
  head: { shape: "circle", r: 26 },
  upperArmL: { shape: "rect", w: 16, h: 52 },
  lowerArmL: { shape: "rect", w: 15, h: 49 },
  upperArmR: { shape: "rect", w: 16, h: 52 },
  lowerArmR: { shape: "rect", w: 15, h: 49 },
  upperLegL: { shape: "rect", w: 19, h: 58 },
  lowerLegL: { shape: "rect", w: 17, h: 54 },
  upperLegR: { shape: "rect", w: 19, h: 58 },
  lowerLegR: { shape: "rect", w: 17, h: 54 },
});

const SEGMENT_META = Object.freeze({
  torsoTop:{w:48,h:26},torso:{w:48,h:26},torsoBottom:{w:48,h:26},
  head:{w:44,h:24},headTop:{w:44,h:24},
  upperArmL:{w:16,h:26},upperArmL2:{w:16,h:26},lowerArmL:{w:15,h:25},lowerArmL2:{w:15,h:24},
  upperArmR:{w:16,h:26},upperArmR2:{w:16,h:26},lowerArmR:{w:15,h:25},lowerArmR2:{w:15,h:24},
  upperLegL:{w:19,h:29},upperLegL2:{w:19,h:29},lowerLegL:{w:17,h:27},lowerLegL2:{w:17,h:27},
  upperLegR:{w:19,h:29},upperLegR2:{w:19,h:29},lowerLegR:{w:17,h:27},lowerLegR2:{w:17,h:27},
});

const LIMB_SEAMS = Object.freeze({
  upperArmL:["leftUpperArm","upperArmL","upperArmL2"],
  lowerArmL:["leftForearm","lowerArmL","lowerArmL2"],
  upperArmR:["rightUpperArm","upperArmR","upperArmR2"],
  lowerArmR:["rightForearm","lowerArmR","lowerArmR2"],
  upperLegL:["leftThigh","upperLegL","upperLegL2"],
  lowerLegL:["leftShin","lowerLegL","lowerLegL2"],
  upperLegR:["rightThigh","upperLegR","upperLegR2"],
  lowerLegR:["rightShin","lowerLegR","lowerLegR2"],
});

const LINKS = Object.freeze([
  ["torso","head","neck"],
  ["torso","upperArmL","leftShoulder"],["upperArmL","lowerArmL","leftElbow"],
  ["torso","upperArmR","rightShoulder"],["upperArmR","lowerArmR","rightElbow"],
  ["torso","upperLegL","leftHip"],["upperLegL","lowerLegL","leftKnee"],
  ["torso","upperLegR","rightHip"],["upperLegR","lowerLegR","rightKnee"],
]);

const EYES = Object.freeze({
  closed:[{d:"M6 5q6 5 13 0m24 0q7 5 13 0",w:4.2}],dots:[{d:"M12 6h.01M50 6h.01",w:7}],happy:[{d:"M6 7q6-6 13 0m24 0q7-6 13 0",w:4.2}],mismatch:[{d:"M6 5q6 5 13 0m24 1q7 1.5 13 0",w:4.2}],sleepy:[{d:"M6 6q7 1.5 13 0m24 0q7 1.5 13 0",w:4.2}],unevenDots:[{d:"M12 4.5h.01M50 7.5h.01",w:7}],wink:[{d:"M6 5q6 5 13 0",w:4.2},{d:"M50 6h.01",w:7}],winkRight:[{d:"M12 6h.01",w:7},{d:"M43 5q7 5 13 0",w:4.2}],
});
const NOSES = Object.freeze({angular:"M13 6 7 26l8 2.5",bow:"M13 5c-5.5 8-8 16-6 24",curve:"M12 6c-2.5 8-7 15-6 22q.5 5 6 4",hook:"M13 5 5.5 27q-1 6.5 5.5 5.5",long:"M15 3 4 30q-1.5 5.5 6 5",slant:"M13 5 6 29"});
const MOUTHS = Object.freeze({frown:{d:"M7 11q15-6.5 29-1",open:11},line:{d:"m8 10 28-2",open:12},pleased:{d:"M4 9q16 7 30-1l7-5",open:13},shy:{d:"M15 9.5q8 4 16-1",open:9},smile:{d:"M3 9q19 10 38-3",open:14},smirk:{d:"M9 10q14 4 26-4",open:12},soft:{d:"M6 9q16 6 32-2",open:12},wavy:{d:"M6 10q7-4 14 0 8 4.5 18-2",open:12}});
const MOUTH_CACHE = new Map();

function worldPoint(body, local) { const rotated=Vector.rotate(local,body.angle); return{x:body.position.x+rotated.x,y:body.position.y+rotated.y}; }
function standardOptions(group){return{collisionFilter:{group},frictionAir:.04,restitution:.08,friction:.8};}
function joint(bodyA,pointA,bodyB,pointB,stiffness=.90,damping=.20){return Constraint.create({bodyA,pointA,bodyB,pointB,length:1,stiffness,damping});}

export function createPuppet(world,{id,ownerPlayerId,profile,x=500,y=475}){
  const group=Body.nextGroup(true),opt=standardOptions(group);
  const parts={
    torso:Bodies.rectangle(x,y,48,26,{...opt,chamfer:{radius:7},density:.0022}),
    head:Bodies.rectangle(x,y-53,44,24,{...opt,chamfer:{radius:11},density:.00068,frictionAir:.06}),
    upperArmL:Bodies.rectangle(x-37,y-30,16,26,opt),lowerArmL:Bodies.rectangle(x-42,y+18,15,25,opt),
    upperArmR:Bodies.rectangle(x+37,y-30,16,26,opt),lowerArmR:Bodies.rectangle(x+42,y+18,15,25,opt),
    upperLegL:Bodies.rectangle(x-14,y+50.5,19,29,opt),lowerLegL:Bodies.rectangle(x-14,y+104.5,17,27,opt),
    upperLegR:Bodies.rectangle(x+14,y+50.5,19,29,opt),lowerLegR:Bodies.rectangle(x+14,y+104.5,17,27,opt),
    torsoTop:Bodies.rectangle(x,y-26,48,26,{...opt,chamfer:{radius:7},density:.0022}),
    torsoBottom:Bodies.rectangle(x,y+26,48,26,{...opt,chamfer:{radius:7},density:.0022}),
    headTop:Bodies.rectangle(x,y-77,44,24,{...opt,chamfer:{radius:11},density:.00068,frictionAir:.06}),
    upperArmL2:Bodies.rectangle(x-37,y-4,16,26,opt),lowerArmL2:Bodies.rectangle(x-42,y+42.5,15,24,opt),
    upperArmR2:Bodies.rectangle(x+37,y-4,16,26,opt),lowerArmR2:Bodies.rectangle(x+42,y+42.5,15,24,opt),
    upperLegL2:Bodies.rectangle(x-14,y+79.5,19,29,opt),lowerLegL2:Bodies.rectangle(x-14,y+131.5,17,27,opt),
    upperLegR2:Bodies.rectangle(x+14,y+79.5,19,29,opt),lowerLegR2:Bodies.rectangle(x+14,y+131.5,17,27,opt),
  };
  for(const [name,body] of Object.entries(parts)){body.plugin=body.plugin||{};body.plugin.hollerdayPart=name;}

  const seams={
    torsoUpper:joint(parts.torsoTop,{x:0,y:13},parts.torso,{x:0,y:-13},.995),torsoLower:joint(parts.torso,{x:0,y:13},parts.torsoBottom,{x:0,y:-13},.995),headMiddle:joint(parts.head,{x:0,y:-12},parts.headTop,{x:0,y:12},.995),
    leftUpperArm:joint(parts.upperArmL,{x:0,y:13},parts.upperArmL2,{x:0,y:-13},.995),leftForearm:joint(parts.lowerArmL,{x:0,y:12},parts.lowerArmL2,{x:0,y:-12},.995),
    rightUpperArm:joint(parts.upperArmR,{x:0,y:13},parts.upperArmR2,{x:0,y:-13},.995),rightForearm:joint(parts.lowerArmR,{x:0,y:12},parts.lowerArmR2,{x:0,y:-12},.995),
    leftThigh:joint(parts.upperLegL,{x:0,y:14.5},parts.upperLegL2,{x:0,y:-14.5},.995),leftShin:joint(parts.lowerLegL,{x:0,y:13.5},parts.lowerLegL2,{x:0,y:-13.5},.995),
    rightThigh:joint(parts.upperLegR,{x:0,y:14.5},parts.upperLegR2,{x:0,y:-14.5},.995),rightShin:joint(parts.lowerLegR,{x:0,y:13.5},parts.lowerLegR2,{x:0,y:-13.5},.995),
  };
  const seamMeta={torsoUpper:{radius:29,part:"torso"},torsoLower:{radius:29,part:"torso"},headMiddle:{radius:27,part:"head"},leftUpperArm:{radius:13,part:"upperArmL"},leftForearm:{radius:13,part:"lowerArmL"},rightUpperArm:{radius:13,part:"upperArmR"},rightForearm:{radius:13,part:"lowerArmR"},leftThigh:{radius:14,part:"upperLegL"},leftShin:{radius:14,part:"lowerLegL"},rightThigh:{radius:14,part:"upperLegR"},rightShin:{radius:14,part:"lowerLegR"}};
  const jointMap={
    neck:joint(parts.torsoTop,{x:0,y:-13},parts.head,{x:0,y:12}),
    leftShoulder:joint(parts.torsoTop,{x:-24,y:-1},parts.upperArmL,{x:0,y:-13}),leftElbow:joint(parts.upperArmL2,{x:0,y:13},parts.lowerArmL,{x:0,y:-12}),
    rightShoulder:joint(parts.torsoTop,{x:24,y:-1},parts.upperArmR,{x:0,y:-13}),rightElbow:joint(parts.upperArmR2,{x:0,y:13},parts.lowerArmR,{x:0,y:-12}),
    leftHip:joint(parts.torsoBottom,{x:-14,y:12},parts.upperLegL,{x:0,y:-14.5}),leftKnee:joint(parts.upperLegL2,{x:0,y:14.5},parts.lowerLegL,{x:0,y:-13.5}),
    rightHip:joint(parts.torsoBottom,{x:14,y:12},parts.upperLegR,{x:0,y:-14.5}),rightKnee:joint(parts.upperLegR2,{x:0,y:14.5},parts.lowerLegR,{x:0,y:-13.5}),
  };
  const joints=Object.values(jointMap),constraints=[...joints,...Object.values(seams)];
  Composite.add(world,[...Object.values(parts),...constraints]);
  return initialisePuppetBehaviour({id,ownerPlayerId,profile,parts,joints,jointMap,seams,seamMeta,brokenSeams:new Set(),severedJoints:new Set(),repairRequested:false,world});
}

export function destroyPuppet(world,puppet){Composite.remove(world,[...Object.values(puppet.parts),...Object.values(puppet.jointMap||{}),...Object.values(puppet.seams||{})],true);}
export function serializePuppet(puppet){const parts={};for(const[name,body]of Object.entries(puppet.parts))parts[name]={x:body.position.x,y:body.position.y,angle:body.angle};return{id:puppet.id,ownerPlayerId:puppet.ownerPlayerId,profile:puppet.profile,behaviour:serialisePuppetBehaviour(puppet),damage:connectionDamageState(puppet),parts};}

function controlSpec(puppet,name){
  const p=puppet.parts;
  if(name==="torso")return{body:p.torso,local:{x:0,y:0}};
  if(name==="head")return{body:p.head,local:{x:0,y:0}};
  if(name==="pelvis")return{body:p.torso,local:{x:0,y:34}};
  if(name==="leftShoulder")return{body:p.torso,local:{x:-24,y:-27}};
  if(name==="rightShoulder")return{body:p.torso,local:{x:24,y:-27}};
  if(name==="leftHand")return{body:p.lowerArmL2||p.lowerArmL,local:{x:0,y:p.lowerArmL2?12:23}};
  if(name==="rightHand")return{body:p.lowerArmR2||p.lowerArmR,local:{x:0,y:p.lowerArmR2?12:23}};
  if(name==="leftFoot")return{body:p.lowerLegL2||p.lowerLegL,local:{x:0,y:p.lowerLegL2?13.5:25}};
  if(name==="rightFoot")return{body:p.lowerLegR2||p.lowerLegR,local:{x:0,y:p.lowerLegR2?13.5:25}};
  return null;
}
const CONTROL_NAMES=["torso","head","pelvis","leftShoulder","rightShoulder","leftHand","rightHand","leftFoot","rightFoot"];
export function getControlPoint(puppet,name){const spec=controlSpec(puppet,name);if(!spec?.body)return null;return{name,body:spec.body,localPoint:spec.local,point:worldPoint(spec.body,spec.local)};}

function inverseProjectedPoint(puppet,point){const state=puppet.behaviour||{},depth=Number(state.depth)||0;if(Math.abs(depth)<.0001)return point;const center=puppet.parts.torso.position,scale=depthScale(depth),shift=depthShift(depth);return{x:center.x+(point.x-center.x)/scale,y:center.y+(point.y-shift-center.y)/scale};}
export function findGrabBody(puppet,point){const physicalPoint=inverseProjectedPoint(puppet,point);let nearest=null,best=Infinity;for(const name of CONTROL_NAMES){const candidate=getControlPoint(puppet,name);if(!candidate)continue;const distance=Vector.magnitude(Vector.sub(candidate.point,physicalPoint));if(distance<best){best=distance;nearest=candidate;}}return best<=72?nearest:null;}
export function createGrabConstraint(){return null;}export function moveGrabConstraint(){}export function removeGrabConstraint(){}

function projectState(puppet,state){const depth=Number(puppet.behaviour?.depth)||0;if(Math.abs(depth)<.0001)return state;const torso=puppet.parts.torso,scale=depthScale(depth),shift=depthShift(depth);return{...state,x:torso.x+(state.x-torso.x)*scale,y:torso.y+(state.y-torso.y)*scale+shift};}
function partPoint(cameraApi,puppet,part){const projected=projectState(puppet,part);return cameraApi.worldToScreen(projected.x,projected.y);}
function averageAngle(a=0,b=0){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d< -Math.PI)d+=Math.PI*2;return a+d*.5;}
function combinedState(a,b){if(!b)return a;if(!a)return b;return{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,angle:averageAngle(a.angle||0,b.angle||0)};}
function virtualState(puppet,name){const p=puppet.parts;if(name==="head"&&p.headTop)return combinedState(p.head,p.headTop);const seam=LIMB_SEAMS[name];if(seam&&p[seam[2]])return combinedState(p[seam[1]],p[seam[2]]);return p[name];}

function headPath(ctx,style,r){const p=(x,y)=>[x*r,y*r];ctx.beginPath();if(style==="smooth")ctx.arc(0,0,r,0,Math.PI*2);else if(style==="burst"){ctx.moveTo(...p(-.76,.68));[[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...p(...q)));ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));}else{const maps={spikes:[[-.82,.58],[-.72,-.58],[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56],[.82,.58]],tallSpikes:[[-.78,.62],[-.68,-.48],[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48],[.78,.62]],fringe:[[-.84,.62],[-.74,-.50],[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50],[.84,.62]],scallop:[[-.84,.62],[-.72,-.48],[-.55,-.82],[-.34,-.68],[-.16,-1.00],[.04,-.72],[.24,-1.00],[.43,-.68],[.65,-.86],[.76,-.48],[.84,.62]],tufts:[[-.83,.62],[-.67,-.55],[-.50,-1.00],[-.25,-.68],[-.05,-1.18],[.15,-.68],[.48,-1.08],[.68,-.52],[.83,.62]],swept:[[-.84,.60],[-.64,-.55],[-.36,-.90],[.03,-.72],[.25,-1.18],[.32,-.82],[.69,-.98],[.68,-.55],[.84,.60]]};const points=maps[style]||maps.spikes;ctx.moveTo(...p(...points[0]));for(let i=1;i<points.length;i++)ctx.lineTo(...p(...points[i]));ctx.bezierCurveTo(...p(.72,.96),...p(.30,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.72,.96),...p(...points[0]));}ctx.closePath();}
function drawEyes(ctx,name,r){const parts=EYES[name]||EYES.dots,s=r*2/100;ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);ctx.strokeStyle="#08090a";ctx.lineCap="round";ctx.lineJoin="round";for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}ctx.restore();}
function drawNose(ctx,name,r){const d=NOSES[name]||NOSES.curve,s=r*2/100;ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle="#08090a";ctx.lineWidth=4.4;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(new Path2D(d));ctx.restore();}
function mouthSamples(name){name=MOUTHS[name]?name:"line";if(MOUTH_CACHE.has(name))return MOUTH_CACHE.get(name);const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",MOUTHS[name].d);const len=path.getTotalLength(),pts=[];for(let i=0;i<=36;i++){const t=i/36,q=path.getPointAtLength(len*t);pts.push({x:q.x,y:q.y,t});}MOUTH_CACHE.set(name,pts);return pts;}
function drawMouth(ctx,name,state,r){name=MOUTHS[name]?name:"line";const def=MOUTHS[name],pts=mouthSamples(name),s=r*2/100,sv=clamp(Number(state)||0,0,2);ctx.save();ctx.translate(-20*s,13*s);ctx.scale(s,s);ctx.lineCap="round";ctx.lineJoin="round";if(sv<=0){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle="#08090a";ctx.lineWidth=4.6;ctx.stroke();}else{const amount=def.open*(sv===1?.38:1),up=[],lo=[];for(const p of pts){const taper=Math.pow(Math.sin(Math.PI*p.t),.68),spread=amount*taper;up.push({x:p.x,y:p.y-spread*.30});lo.push({x:p.x,y:p.y+spread*.72});}ctx.beginPath();ctx.moveTo(up[0].x,up[0].y);for(let i=1;i<up.length;i++)ctx.lineTo(up[i].x,up[i].y);for(let i=lo.length-1;i>=0;i--)ctx.lineTo(lo[i].x,lo[i].y);ctx.closePath();ctx.fillStyle="#08090a";ctx.fill();}ctx.restore();}
function drawExtra(ctx,name,r){ctx.save();ctx.strokeStyle="#08090a";ctx.fillStyle="#08090a";ctx.lineWidth=Math.max(1.5,r*.075);ctx.lineCap="round";ctx.lineJoin="round";if(name==="glasses"){ctx.beginPath();ctx.arc(-r*.34,-r*.08,r*.23,0,Math.PI*2);ctx.arc(r*.34,-r*.08,r*.23,0,Math.PI*2);ctx.moveTo(-r*.11,-r*.08);ctx.lineTo(r*.11,-r*.08);ctx.stroke();}else if(name==="moustache"){ctx.beginPath();ctx.moveTo(0,r*.16);ctx.quadraticCurveTo(-r*.18,r*.05,-r*.42,r*.22);ctx.quadraticCurveTo(-r*.18,r*.30,0,r*.20);ctx.quadraticCurveTo(r*.18,r*.30,r*.42,r*.22);ctx.quadraticCurveTo(r*.18,r*.05,0,r*.16);ctx.fill();}else if(name==="freckles"){for(const x of[-.42,-.28,.28,.42]){ctx.beginPath();ctx.arc(r*x,r*.14,Math.max(1,r*.035),0,Math.PI*2);ctx.fill();}}else if(name==="eyepatch"){ctx.beginPath();ctx.arc(r*.32,-r*.10,r*.18,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-r*.65,-r*.42);ctx.lineTo(r*.64,r*.08);ctx.stroke();}ctx.restore();}
function drawHead(ctx,puppet,state,cameraApi,colour,visualScale){const p=partPoint(cameraApi,puppet,state),scale=cameraApi.camera.scale*visualScale,r=26*scale,profile=puppet.profile||{};ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.angle);ctx.fillStyle=colour;ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(1.5,2.5*scale);headPath(ctx,profile.headStyle||"spikes",r);ctx.fill();ctx.stroke();drawEyes(ctx,profile.eyes||"dots",r);drawNose(ctx,profile.nose||"curve",r);drawMouth(ctx,profile.mouth||"line",puppet.behaviour?.mouth||0,r);drawExtra(ctx,profile.extra||"none",r);ctx.restore();}
function drawRectState(ctx,puppet,state,meta,cameraApi,colour,scale){if(!state||!meta)return;const p=partPoint(cameraApi,puppet,state);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.angle||0);ctx.fillStyle=colour;ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(1.5,2.5*scale);ctx.beginPath();ctx.rect(-meta.w*scale/2,-meta.h*scale/2,meta.w*scale,meta.h*scale);ctx.fill();ctx.stroke();ctx.restore();}

export function drawPuppet(ctx,puppet,cameraApi){
  const visualScale=depthScale(Number(puppet.behaviour?.depth)||0),scale=cameraApi.camera.scale*visualScale,colour=puppet.profile?.colour||puppet.profile?.color||"#b83324",broken=new Set(puppet.damage?.brokenSeams||[]),severed=new Set(puppet.damage?.severedJoints||[]);
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(2,8*scale);
  for(const[a,b,jointName]of LINKS){if(severed.has(jointName))continue;const pa=virtualState(puppet,a),pb=virtualState(puppet,b);if(!pa||!pb)continue;const sa=partPoint(cameraApi,puppet,pa),sb=partPoint(cameraApi,puppet,pb);ctx.beginPath();ctx.moveTo(sa.x,sa.y);ctx.lineTo(sb.x,sb.y);ctx.stroke();}

  if(puppet.parts.torsoTop){
    if(broken.has("torsoUpper")||broken.has("torsoLower")){for(const name of["torsoTop","torso","torsoBottom"])drawRectState(ctx,puppet,puppet.parts[name],SEGMENT_META[name],cameraApi,colour,scale);}else drawRectState(ctx,puppet,puppet.parts.torso,PART_META.torso,cameraApi,colour,scale);
  }else drawRectState(ctx,puppet,puppet.parts.torso,PART_META.torso,cameraApi,colour,scale);

  for(const[name,[seam,near,far]]of Object.entries(LIMB_SEAMS)){
    if(!puppet.parts[name])continue;
    if(puppet.parts[far]&&broken.has(seam)){drawRectState(ctx,puppet,puppet.parts[near],SEGMENT_META[near],cameraApi,colour,scale);drawRectState(ctx,puppet,puppet.parts[far],SEGMENT_META[far],cameraApi,colour,scale);}else drawRectState(ctx,puppet,virtualState(puppet,name),PART_META[name],cameraApi,colour,scale);
  }

  let headState=virtualState(puppet,"head");
  if(puppet.parts.headTop&&broken.has("headMiddle")){drawRectState(ctx,puppet,puppet.parts.head,SEGMENT_META.head,cameraApi,colour,scale);drawRectState(ctx,puppet,puppet.parts.headTop,SEGMENT_META.headTop,cameraApi,colour,scale);headState=null;}else if(headState)drawHead(ctx,puppet,headState,cameraApi,colour,visualScale);
  const labelState=headState||puppet.parts.headTop||puppet.parts.head;if(labelState){const p=partPoint(cameraApi,puppet,labelState);ctx.font=`900 ${Math.max(10,15*scale)}px Nunito, sans-serif`;ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillStyle="#1d1711";ctx.fillText(puppet.profile?.name||"Puppet",p.x,p.y-38*scale);}
  ctx.restore();
}
