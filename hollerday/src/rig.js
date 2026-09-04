import { initialisePuppetBehaviour, serialisePuppetBehaviour } from "./behaviour.js";

const { Bodies, Body, Composite, Constraint, Vector } = Matter;

// This is the frozen Puppetalk 1 physical rig, expressed explicitly instead of
// being inferred by patches. Hands, feet, shoulders and pelvis are control
// points on these ten bodies; they are not extra masses.
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
  pelvis: { body: "torso", local: { x: 0, y: 38 } },
  leftShoulder: { body: "torso", local: { x: -24, y: -27 } },
  rightShoulder: { body: "torso", local: { x: 24, y: -27 } },
  leftHand: { body: "lowerArmL", local: { x: 0, y: 23 } },
  rightHand: { body: "lowerArmR", local: { x: 0, y: 23 } },
  leftFoot: { body: "lowerLegL", local: { x: 0, y: 25 } },
  rightFoot: { body: "lowerLegR", local: { x: 0, y: 25 } },
});

function worldPoint(body, local) {
  const rotated = Vector.rotate(local, body.angle);
  return { x: body.position.x + rotated.x, y: body.position.y + rotated.y };
}

function standardOptions(group) {
  return {
    collisionFilter: { group },
    frictionAir: .04,
    restitution: .08,
    friction: .8,
  };
}

// Puppetalk 1 created these at .97/.13, then its stability layer clamped every
// body-to-body constraint to .90 stiffness and at least .20 damping. Hollerday
// records the final effective values directly.
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
  const opt = standardOptions(group);

  const parts = {
    torso: Bodies.rectangle(x, y, 48, 78, { ...opt, chamfer: { radius: 13 }, density: .0022 }),
    head: Bodies.circle(x, y - 65, 26, { ...opt, density: .0018 }),
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
    joint(parts.torso, { x: 0, y: -39 }, parts.head, { x: 0, y: 24 }),
    joint(parts.torso, { x: -24, y: -27 }, parts.upperArmL, { x: 0, y: -25 }),
    joint(parts.upperArmL, { x: 0, y: 25 }, parts.lowerArmL, { x: 0, y: -23 }),
    joint(parts.torso, { x: 24, y: -27 }, parts.upperArmR, { x: 0, y: -25 }),
    joint(parts.upperArmR, { x: 0, y: 25 }, parts.lowerArmR, { x: 0, y: -23 }),
    joint(parts.torso, { x: -14, y: 38 }, parts.upperLegL, { x: 0, y: -27 }),
    joint(parts.upperLegL, { x: 0, y: 27 }, parts.lowerLegL, { x: 0, y: -25 }),
    joint(parts.torso, { x: 14, y: 38 }, parts.upperLegR, { x: 0, y: -27 }),
    joint(parts.upperLegR, { x: 0, y: 27 }, parts.lowerLegR, { x: 0, y: -25 }),
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

export function getControlPoint(puppet, name) {
  const spec = CONTROL_POINTS[name];
  if (!spec) return null;
  const body = puppet.parts[spec.body];
  if (!body) return null;
  return {
    name,
    body,
    localPoint: spec.local,
    point: worldPoint(body, spec.local),
  };
}

export function findGrabBody(puppet, point) {
  let nearest = null;
  let best = Infinity;

  for (const name of Object.keys(CONTROL_POINTS)) {
    const candidate = getControlPoint(puppet, name);
    if (!candidate) continue;
    const distance = Vector.magnitude(Vector.sub(candidate.point, point));
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }

  return best <= 72 ? nearest : null;
}

export function createGrabConstraint(world, body, point, localPoint = null) {
  const attachment = localPoint || Vector.rotate(Vector.sub(point, body.position), -body.angle);
  const constraint = Constraint.create({
    pointA: { x: point.x, y: point.y },
    bodyB: body,
    pointB: { x: attachment.x, y: attachment.y },
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
