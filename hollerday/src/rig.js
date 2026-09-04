import { initialisePuppetBehaviour, serialisePuppetBehaviour } from "./behaviour.js";

const { Bodies, Body, Composite, Constraint, Vector, Bounds } = Matter;

export const PART_META = Object.freeze({
  head: { shape: "circle", r: 26 },
  torso: { shape: "rect", w: 50, h: 90 },
  pelvis: { shape: "rect", w: 54, h: 32 },
  upperArmL: { shape: "rect", w: 16, h: 58 },
  lowerArmL: { shape: "rect", w: 14, h: 55 },
  handL: { shape: "circle", r: 11 },
  upperArmR: { shape: "rect", w: 16, h: 58 },
  lowerArmR: { shape: "rect", w: 14, h: 55 },
  handR: { shape: "circle", r: 11 },
  upperLegL: { shape: "rect", w: 20, h: 62 },
  lowerLegL: { shape: "rect", w: 18, h: 62 },
  footL: { shape: "rect", w: 28, h: 14 },
  upperLegR: { shape: "rect", w: 20, h: 62 },
  lowerLegR: { shape: "rect", w: 18, h: 62 },
  footR: { shape: "rect", w: 28, h: 14 },
});

const LINKS = [
  ["head", "torso"], ["torso", "pelvis"],
  ["torso", "upperArmL"], ["upperArmL", "lowerArmL"], ["lowerArmL", "handL"],
  ["torso", "upperArmR"], ["upperArmR", "lowerArmR"], ["lowerArmR", "handR"],
  ["pelvis", "upperLegL"], ["upperLegL", "lowerLegL"], ["lowerLegL", "footL"],
  ["pelvis", "upperLegR"], ["upperLegR", "lowerLegR"], ["lowerLegR", "footR"],
];

function bodyOptions(group, density = .001) {
  return {
    collisionFilter: { group },
    friction: .8,
    frictionAir: .04,
    restitution: .08,
    density,
  };
}

function joint(bodyA, pointA, bodyB, pointB) {
  return Constraint.create({
    bodyA,
    pointA,
    bodyB,
    pointB,
    length: 1,
    stiffness: .90,
    damping: .20,
  });
}

export function createPuppet(world, { id, ownerPlayerId, profile, x = 500, y = 470 }) {
  const group = Body.nextGroup(true);
  const standard = bodyOptions(group);
  const torsoOptions = bodyOptions(group, .0022);
  const headOptions = bodyOptions(group, .0018);
  const pelvisOptions = bodyOptions(group, .0020);
  const lightOptions = bodyOptions(group, .0009);

  const parts = {
    head: Bodies.circle(x, y - 118, 26, headOptions),
    torso: Bodies.rectangle(x, y - 58, 50, 90, { ...torsoOptions, chamfer: { radius: 13 } }),
    pelvis: Bodies.rectangle(x, y, 54, 32, pelvisOptions),
    upperArmL: Bodies.rectangle(x - 43, y - 68, 16, 58, standard),
    lowerArmL: Bodies.rectangle(x - 43, y - 18, 14, 55, standard),
    handL: Bodies.circle(x - 43, y + 19, 11, lightOptions),
    upperArmR: Bodies.rectangle(x + 43, y - 68, 16, 58, standard),
    lowerArmR: Bodies.rectangle(x + 43, y - 18, 14, 55, standard),
    handR: Bodies.circle(x + 43, y + 19, 11, lightOptions),
    upperLegL: Bodies.rectangle(x - 16, y + 47, 20, 62, standard),
    lowerLegL: Bodies.rectangle(x - 16, y + 104, 18, 62, standard),
    footL: Bodies.rectangle(x - 20, y + 142, 28, 14, lightOptions),
    upperLegR: Bodies.rectangle(x + 16, y + 47, 20, 62, standard),
    lowerLegR: Bodies.rectangle(x + 16, y + 104, 18, 62, standard),
    footR: Bodies.rectangle(x + 20, y + 142, 28, 14, lightOptions),
  };

  const joints = [
    joint(parts.head, { x: 0, y: 24 }, parts.torso, { x: 0, y: -43 }),
    joint(parts.torso, { x: 0, y: 43 }, parts.pelvis, { x: 0, y: -14 }),
    joint(parts.torso, { x: -24, y: -31 }, parts.upperArmL, { x: 0, y: -28 }),
    joint(parts.upperArmL, { x: 0, y: 28 }, parts.lowerArmL, { x: 0, y: -27 }),
    joint(parts.lowerArmL, { x: 0, y: 27 }, parts.handL, { x: 0, y: -9 }),
    joint(parts.torso, { x: 24, y: -31 }, parts.upperArmR, { x: 0, y: -28 }),
    joint(parts.upperArmR, { x: 0, y: 28 }, parts.lowerArmR, { x: 0, y: -27 }),
    joint(parts.lowerArmR, { x: 0, y: 27 }, parts.handR, { x: 0, y: -9 }),
    joint(parts.pelvis, { x: -16, y: 14 }, parts.upperLegL, { x: 0, y: -30 }),
    joint(parts.upperLegL, { x: 0, y: 30 }, parts.lowerLegL, { x: 0, y: -30 }),
    joint(parts.lowerLegL, { x: 0, y: 30 }, parts.footL, { x: 4, y: -6 }),
    joint(parts.pelvis, { x: 16, y: 14 }, parts.upperLegR, { x: 0, y: -30 }),
    joint(parts.upperLegR, { x: 0, y: 30 }, parts.lowerLegR, { x: 0, y: -30 }),
    joint(parts.lowerLegR, { x: 0, y: 30 }, parts.footR, { x: -4, y: -6 }),
  ];

  Composite.add(world, [...Object.values(parts), ...joints]);
  return initialisePuppetBehaviour({ id, ownerPlayerId, profile, parts, joints });
}

export function destroyPuppet(world, puppet) {
  Composite.remove(world, [...Object.values(puppet.parts), ...puppet.joints], true);
}

export function serializePuppet(puppet) {
  const parts = {};
  for (const [name, body] of Object.entries(puppet.parts)) {
    parts[name] = { x: body.position.x, y: body.position.y, angle: body.angle };
  }
  return {
    id: puppet.id,
    ownerPlayerId: puppet.ownerPlayerId,
    profile: puppet.profile,
    behaviour: serialisePuppetBehaviour(puppet),
    parts,
  };
}

export function findGrabBody(puppet, point) {
  let nearest = null;
  let best = Infinity;
  for (const [name, body] of Object.entries(puppet.parts)) {
    const inside = Bounds.contains(body.bounds, point);
    const distance = Vector.magnitude(Vector.sub(body.position, point));
    const score = inside ? distance * .25 : distance;
    if (score < best) {
      best = score;
      nearest = { name, body };
    }
  }
  return best <= 72 ? nearest : null;
}

export function createGrabConstraint(world, body, point) {
  const localPoint = Vector.rotate(Vector.sub(point, body.position), -body.angle);
  const constraint = Constraint.create({
    pointA: { x: point.x, y: point.y },
    bodyB: body,
    pointB: localPoint,
    length: 0,
    stiffness: .22,
    damping: .18,
  });
  Composite.add(world, constraint);
  return constraint;
}

export function moveGrabConstraint(constraint, point) {
  constraint.pointA.x = point.x;
  constraint.pointA.y = point.y;
}

export function removeGrabConstraint(world, constraint) {
  Composite.remove(world, constraint, true);
}

function partPoint(cameraApi, part) {
  return cameraApi.worldToScreen(part.x, part.y);
}

export function drawPuppet(ctx, puppet, cameraApi) {
  const scale = cameraApi.camera.scale;
  const colour = puppet.profile?.colour || "#b83324";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1d1711";
  ctx.lineWidth = Math.max(2, 8 * scale);
  for (const [a, b] of LINKS) {
    const pa = puppet.parts[a];
    const pb = puppet.parts[b];
    if (!pa || !pb) continue;
    const sa = partPoint(cameraApi, pa);
    const sb = partPoint(cameraApi, pb);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }

  for (const [name, state] of Object.entries(puppet.parts)) {
    const meta = PART_META[name];
    if (!meta) continue;
    const p = partPoint(cameraApi, state);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(state.angle);
    ctx.fillStyle = colour;
    ctx.strokeStyle = "#1d1711";
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.beginPath();
    if (meta.shape === "circle") {
      ctx.arc(0, 0, meta.r * scale, 0, Math.PI * 2);
    } else {
      ctx.rect(-meta.w * scale / 2, -meta.h * scale / 2, meta.w * scale, meta.h * scale);
    }
    ctx.fill();
    ctx.stroke();

    if (name === "head") {
      ctx.fillStyle = "#1d1711";
      const r = meta.r * scale;
      ctx.beginPath();
      ctx.arc(-r * .31, -r * .1, Math.max(1.2, r * .07), 0, Math.PI * 2);
      ctx.arc(r * .31, -r * .1, Math.max(1.2, r * .07), 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, r * .06);
      ctx.beginPath();
      ctx.moveTo(-r * .24, r * .3);
      ctx.quadraticCurveTo(0, r * .42, r * .24, r * .3);
      ctx.stroke();
    }
    ctx.restore();
  }

  const head = puppet.parts.head;
  if (head) {
    const p = partPoint(cameraApi, head);
    ctx.font = `900 ${Math.max(10, 15 * scale)}px Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#1d1711";
    ctx.fillText(puppet.profile?.name || "Puppet", p.x, p.y - 36 * scale);
  }
  ctx.restore();
}
