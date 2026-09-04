import { initialisePuppetBehaviour, serialisePuppetBehaviour, depthScale, depthShift } from "./behaviour.js";

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

const LINKS = Object.freeze([
  ["torso", "head"],
  ["torso", "upperArmL"], ["upperArmL", "lowerArmL"],
  ["torso", "upperArmR"], ["upperArmR", "lowerArmR"],
  ["torso", "upperLegL"], ["upperLegL", "lowerLegL"],
  ["torso", "upperLegR"], ["upperLegR", "lowerLegR"],
]);

const CONTROL_POINTS = Object.freeze({
  torso: { body: "torso", local: { x: 0, y: 0 } },
  head: { body: "head", local: { x: 0, y: 0 } },
  pelvis: { body: "torso", local: { x: 0, y: 34 } },
  leftShoulder: { body: "torso", local: { x: -24, y: -27 } },
  rightShoulder: { body: "torso", local: { x: 24, y: -27 } },
  leftHand: { body: "lowerArmL", local: { x: 0, y: 23 } },
  rightHand: { body: "lowerArmR", local: { x: 0, y: 23 } },
  leftFoot: { body: "lowerLegL", local: { x: 0, y: 25 } },
  rightFoot: { body: "lowerLegR", local: { x: 0, y: 25 } },
});

const EYES = Object.freeze({
  closed:[{d:"M6 5q6 5 13 0m24 0q7 5 13 0",w:4.2}],
  dots:[{d:"M12 6h.01M50 6h.01",w:7}],
  happy:[{d:"M6 7q6-6 13 0m24 0q7-6 13 0",w:4.2}],
  mismatch:[{d:"M6 5q6 5 13 0m24 1q7 1.5 13 0",w:4.2}],
  sleepy:[{d:"M6 6q7 1.5 13 0m24 0q7 1.5 13 0",w:4.2}],
  unevenDots:[{d:"M12 4.5h.01M50 7.5h.01",w:7}],
  wink:[{d:"M6 5q6 5 13 0",w:4.2},{d:"M50 6h.01",w:7}],
  winkRight:[{d:"M12 6h.01",w:7},{d:"M43 5q7 5 13 0",w:4.2}],
});
const NOSES = Object.freeze({
  angular:"M13 6 7 26l8 2.5", bow:"M13 5c-5.5 8-8 16-6 24",
  curve:"M12 6c-2.5 8-7 15-6 22q.5 5 6 4", hook:"M13 5 5.5 27q-1 6.5 5.5 5.5",
  long:"M15 3 4 30q-1.5 5.5 6 5", slant:"M13 5 6 29",
});
const MOUTHS = Object.freeze({
  frown:{d:"M7 11q15-6.5 29-1",open:11}, line:{d:"m8 10 28-2",open:12},
  pleased:{d:"M4 9q16 7 30-1l7-5",open:13}, shy:{d:"M15 9.5q8 4 16-1",open:9},
  smile:{d:"M3 9q19 10 38-3",open:14}, smirk:{d:"M9 10q14 4 26-4",open:12},
  soft:{d:"M6 9q16 6 32-2",open:12}, wavy:{d:"M6 10q7-4 14 0 8 4.5 18-2",open:12},
});
const MOUTH_CACHE = new Map();

function worldPoint(body, local) {
  const rotated = Vector.rotate(local, body.angle);
  return { x: body.position.x + rotated.x, y: body.position.y + rotated.y };
}

function standardOptions(group) {
  return { collisionFilter: { group }, frictionAir: .04, restitution: .08, friction: .8 };
}

function joint(bodyA, pointA, bodyB, pointB) {
  return Constraint.create({ bodyA, pointA, bodyB, pointB, length: 1, stiffness: .90, damping: .20 });
}

export function createPuppet(world, { id, ownerPlayerId, profile, x = 500, y = 475 }) {
  const group = Body.nextGroup(true);
  const opt = standardOptions(group);
  const parts = {
    torso: Bodies.rectangle(x, y, 48, 78, { ...opt, chamfer: { radius: 13 }, density: .0022 }),
    // Final frozen boot tuning made the head deliberately light and slightly airier.
    head: Bodies.circle(x, y - 65, 26, { ...opt, density: .00068, frictionAir: .06 }),
    upperArmL: Bodies.rectangle(x - 37, y - 17, 16, 52, opt),
    lowerArmL: Bodies.rectangle(x - 42, y + 30, 15, 49, opt),
    upperArmR: Bodies.rectangle(x + 37, y - 17, 16, 52, opt),
    lowerArmR: Bodies.rectangle(x + 42, y + 30, 15, 49, opt),
    upperLegL: Bodies.rectangle(x - 14, y + 65, 19, 58, opt),
    lowerLegL: Bodies.rectangle(x - 14, y + 118, 17, 54, opt),
    upperLegR: Bodies.rectangle(x + 14, y + 65, 19, 58, opt),
    lowerLegR: Bodies.rectangle(x + 14, y + 118, 17, 54, opt),
  };
  const joints = [
    joint(parts.torso,{x:0,y:-39},parts.head,{x:0,y:24}),
    joint(parts.torso,{x:-24,y:-27},parts.upperArmL,{x:0,y:-25}),
    joint(parts.upperArmL,{x:0,y:25},parts.lowerArmL,{x:0,y:-23}),
    joint(parts.torso,{x:24,y:-27},parts.upperArmR,{x:0,y:-25}),
    joint(parts.upperArmR,{x:0,y:25},parts.lowerArmR,{x:0,y:-23}),
    joint(parts.torso,{x:-14,y:38},parts.upperLegL,{x:0,y:-27}),
    joint(parts.upperLegL,{x:0,y:27},parts.lowerLegL,{x:0,y:-25}),
    joint(parts.torso,{x:14,y:38},parts.upperLegR,{x:0,y:-27}),
    joint(parts.upperLegR,{x:0,y:27},parts.lowerLegR,{x:0,y:-25}),
  ];
  Composite.add(world,[...Object.values(parts),...joints]);
  return initialisePuppetBehaviour({ id, ownerPlayerId, profile, parts, joints });
}

export function destroyPuppet(world, puppet) {
  Composite.remove(world,[...Object.values(puppet.parts),...puppet.joints],true);
}

export function serializePuppet(puppet) {
  const parts = {};
  for (const [name, body] of Object.entries(puppet.parts)) parts[name] = { x:body.position.x,y:body.position.y,angle:body.angle };
  return { id:puppet.id,ownerPlayerId:puppet.ownerPlayerId,profile:puppet.profile,behaviour:serialisePuppetBehaviour(puppet),parts };
}

export function getControlPoint(puppet, name) {
  const spec = CONTROL_POINTS[name];
  if (!spec) return null;
  const body = puppet.parts[spec.body];
  if (!body) return null;
  return { name, body, localPoint:spec.local, point:worldPoint(body,spec.local) };
}

function inverseProjectedPoint(puppet, point) {
  const state = puppet.behaviour || {};
  const depth = Number(state.depth) || 0;
  if (Math.abs(depth) < .0001) return point;
  const center = puppet.parts.torso.position;
  const scale = depthScale(depth);
  const shift = depthShift(depth);
  return {
    x:center.x+(point.x-center.x)/scale,
    y:center.y+(point.y-shift-center.y)/scale,
  };
}

export function findGrabBody(puppet, point) {
  const physicalPoint = inverseProjectedPoint(puppet, point);
  let nearest = null;
  let best = Infinity;
  for (const name of Object.keys(CONTROL_POINTS)) {
    const candidate = getControlPoint(puppet,name);
    if (!candidate) continue;
    const distance = Vector.magnitude(Vector.sub(candidate.point,physicalPoint));
    if (distance < best) { best=distance; nearest=candidate; }
  }
  return best <= 72 ? nearest : null;
}

// Kept for API compatibility; Hollerday's canonical controller now uses the old
// force-target grab system rather than Matter mouse constraints.
export function createGrabConstraint() { return null; }
export function moveGrabConstraint() {}
export function removeGrabConstraint() {}

function projectState(puppet, state) {
  const depth = Number(puppet.behaviour?.depth) || 0;
  if (Math.abs(depth) < .0001) return state;
  const torso = puppet.parts.torso;
  const scale = depthScale(depth);
  const shift = depthShift(depth);
  return {
    ...state,
    x: torso.x + (state.x - torso.x) * scale,
    y: torso.y + (state.y - torso.y) * scale + shift,
  };
}

function partPoint(cameraApi, puppet, part) {
  const projected = projectState(puppet,part);
  return cameraApi.worldToScreen(projected.x,projected.y);
}

function headPath(ctx, style, r) {
  const p=(x,y)=>[x*r,y*r];
  ctx.beginPath();
  if (style === "smooth") ctx.arc(0,0,r,0,Math.PI*2);
  else if (style === "burst") {
    ctx.moveTo(...p(-.76,.68));
    [[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));
    ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));
  } else {
    const maps={
      spikes:[[-.82,.58],[-.72,-.58],[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56],[.82,.58]],
      tallSpikes:[[-.78,.62],[-.68,-.48],[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48],[.78,.62]],
      fringe:[[-.84,.62],[-.74,-.50],[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50],[.84,.62]],
      scallop:[[-.84,.62],[-.72,-.48],[-.55,-.82],[-.34,-.68],[-.16,-1.00],[.04,-.72],[.24,-1.00],[.43,-.68],[.65,-.86],[.76,-.48],[.84,.62]],
      tufts:[[-.83,.62],[-.67,-.55],[-.50,-1.00],[-.25,-.68],[-.05,-1.18],[.15,-.68],[.48,-1.08],[.68,-.52],[.83,.62]],
      swept:[[-.84,.60],[-.64,-.55],[-.36,-.90],[.03,-.72],[.25,-1.18],[.32,-.82],[.69,-.98],[.68,-.55],[.84,.60]],
    };
    const points=maps[style]||maps.spikes;
    ctx.moveTo(...p(...points[0]));
    for(let i=1;i<points.length;i++) ctx.lineTo(...p(...points[i]));
    ctx.bezierCurveTo(...p(.72,.96),...p(.30,1.06),...p(0,1.04));
    ctx.bezierCurveTo(...p(-.30,1.06),...p(-.72,.96),...p(...points[0]));
  }
  ctx.closePath();
}

function drawEyes(ctx,name,r) {
  const parts=EYES[name]||EYES.dots,s=r*2/100;
  ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);ctx.strokeStyle="#08090a";ctx.lineCap="round";ctx.lineJoin="round";
  for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}
  ctx.restore();
}

function drawNose(ctx,name,r) {
  const d=NOSES[name]||NOSES.curve,s=r*2/100;
  ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle="#08090a";ctx.lineWidth=4.4;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(new Path2D(d));ctx.restore();
}

function mouthSamples(name) {
  name=MOUTHS[name]?name:"line";
  if(MOUTH_CACHE.has(name)) return MOUTH_CACHE.get(name);
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",MOUTHS[name].d);
  const len=path.getTotalLength(),pts=[];
  for(let i=0;i<=36;i++){const t=i/36,q=path.getPointAtLength(len*t);pts.push({x:q.x,y:q.y,t});}
  MOUTH_CACHE.set(name,pts);return pts;
}

function drawMouth(ctx,name,state,r) {
  name=MOUTHS[name]?name:"line";
  const def=MOUTHS[name],pts=mouthSamples(name),s=r*2/100,sv=clamp(Number(state)||0,0,2);
  ctx.save();ctx.translate(-20*s,13*s);ctx.scale(s,s);ctx.lineCap="round";ctx.lineJoin="round";
  if(sv<=0){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle="#08090a";ctx.lineWidth=4.6;ctx.stroke();}
  else {const amount=def.open*(sv===1?.38:1),up=[],lo=[];for(const p of pts){const taper=Math.pow(Math.sin(Math.PI*p.t),.68),spread=amount*taper;up.push({x:p.x,y:p.y-spread*.30});lo.push({x:p.x,y:p.y+spread*.72});}ctx.beginPath();ctx.moveTo(up[0].x,up[0].y);for(let i=1;i<up.length;i++)ctx.lineTo(up[i].x,up[i].y);for(let i=lo.length-1;i>=0;i--)ctx.lineTo(lo[i].x,lo[i].y);ctx.closePath();ctx.fillStyle="#08090a";ctx.fill();}
  ctx.restore();
}

function drawExtra(ctx,name,r) {
  ctx.save();ctx.strokeStyle="#08090a";ctx.fillStyle="#08090a";ctx.lineWidth=Math.max(1.5,r*.075);ctx.lineCap="round";ctx.lineJoin="round";
  if(name==="glasses"){ctx.beginPath();ctx.arc(-r*.34,-r*.08,r*.23,0,Math.PI*2);ctx.arc(r*.34,-r*.08,r*.23,0,Math.PI*2);ctx.moveTo(-r*.11,-r*.08);ctx.lineTo(r*.11,-r*.08);ctx.stroke();}
  else if(name==="moustache"){ctx.beginPath();ctx.moveTo(0,r*.16);ctx.quadraticCurveTo(-r*.18,r*.05,-r*.42,r*.22);ctx.quadraticCurveTo(-r*.18,r*.30,0,r*.20);ctx.quadraticCurveTo(r*.18,r*.30,r*.42,r*.22);ctx.quadraticCurveTo(r*.18,r*.05,0,r*.16);ctx.fill();}
  else if(name==="freckles"){for(const x of [-.42,-.28,.28,.42]){ctx.beginPath();ctx.arc(r*x,r*.14,Math.max(1,r*.035),0,Math.PI*2);ctx.fill();}}
  else if(name==="eyepatch"){ctx.beginPath();ctx.arc(r*.32,-r*.10,r*.18,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-r*.65,-r*.42);ctx.lineTo(r*.64,r*.08);ctx.stroke();}
  ctx.restore();
}

function drawHead(ctx,puppet,state,cameraApi,colour,visualScale) {
  const p=partPoint(cameraApi,puppet,state);
  const scale=cameraApi.camera.scale*visualScale;
  const r=26*scale;
  const profile=puppet.profile||{};
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.angle);ctx.fillStyle=colour;ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(1.5,2.5*scale);
  headPath(ctx,profile.headStyle||"spikes",r);ctx.fill();ctx.stroke();
  drawEyes(ctx,profile.eyes||"dots",r);drawNose(ctx,profile.nose||"curve",r);drawMouth(ctx,profile.mouth||"line",puppet.behaviour?.mouth||0,r);drawExtra(ctx,profile.extra||"none",r);
  ctx.restore();
}

export function drawPuppet(ctx, puppet, cameraApi) {
  const visualScale=depthScale(Number(puppet.behaviour?.depth)||0);
  const scale=cameraApi.camera.scale*visualScale;
  const colour=puppet.profile?.colour||puppet.profile?.color||"#b83324";
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(2,8*scale);

  for(const [a,b] of LINKS){const pa=puppet.parts[a],pb=puppet.parts[b];if(!pa||!pb)continue;const sa=partPoint(cameraApi,puppet,pa),sb=partPoint(cameraApi,puppet,pb);ctx.beginPath();ctx.moveTo(sa.x,sa.y);ctx.lineTo(sb.x,sb.y);ctx.stroke();}

  for(const [name,state] of Object.entries(puppet.parts)){
    const meta=PART_META[name];if(!meta||name==="head")continue;
    const p=partPoint(cameraApi,puppet,state);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.angle);ctx.fillStyle=colour;ctx.strokeStyle="#1d1711";ctx.lineWidth=Math.max(1.5,2.5*scale);ctx.beginPath();ctx.rect(-meta.w*scale/2,-meta.h*scale/2,meta.w*scale,meta.h*scale);ctx.fill();ctx.stroke();ctx.restore();
  }

  if(puppet.parts.head) drawHead(ctx,puppet,puppet.parts.head,cameraApi,colour,visualScale);
  const head=puppet.parts.head;
  if(head){const p=partPoint(cameraApi,puppet,head);ctx.font=`900 ${Math.max(10,15*scale)}px Nunito, sans-serif`;ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillStyle="#1d1711";ctx.fillText(puppet.profile?.name||"Puppet",p.x,p.y-38*scale);}
  ctx.restore();
}
