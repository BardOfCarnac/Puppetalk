import { WORLD } from "./config.js";

const { Body, Vector } = Matter;

const POSE_VALUES = Object.freeze({
  stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13],
});

const RECOVERY_OFFSETS = Object.freeze({
  head: [0,-118,0],
  torso: [0,-58,0],
  pelvis: [0,0,0],
  upperArmL: [-43,-68,.12],
  lowerArmL: [-43,-18,.05],
  handL: [-43,19,.05],
  upperArmR: [43,-68,-.12],
  lowerArmR: [43,-18,-.05],
  handR: [43,19,-.05],
  upperLegL: [-16,47,.04],
  lowerLegL: [-16,104,.02],
  footL: [-20,142,.02],
  upperLegR: [16,47,-.04],
  lowerLegR: [16,104,-.02],
  footR: [20,142,-.02],
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function angleDelta(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function scaleVelocity(body, factor) {
  Body.setVelocity(body, { x: body.velocity.x * factor, y: body.velocity.y * factor });
  Body.setAngularVelocity(body, body.angularVelocity * factor);
}

function servo(body, target, strength = .006, ramp = 1) {
  if (!body) return;
  const correction = angleDelta(target, body.angle) * strength - body.angularVelocity * strength * .72;
  body.torque += clamp(correction, -.028, .028) * ramp;
}

function readablePull(body, target, stiffness, damping = .0038) {
  if (!body) return;
  const mass = Math.max(.2, body.mass || 1);
  let fx = ((target.x - body.position.x) * stiffness - body.velocity.x * damping) * mass;
  let fy = ((target.y - body.position.y) * stiffness - body.velocity.y * damping) * mass;
  const magnitude = Math.hypot(fx, fy);
  const maxForce = .032;
  if (magnitude > maxForce) {
    fx *= maxForce / magnitude;
    fy *= maxForce / magnitude;
  }
  Body.applyForce(body, body.position, { x: fx, y: fy });
}

function limbGrabbed(puppet, side, kind) {
  const grabbed = puppet.grabbedParts;
  if (kind === "arm") {
    return grabbed.has(side === "left" ? "handL" : "handR") ||
      grabbed.has(side === "left" ? "lowerArmL" : "lowerArmR") ||
      grabbed.has(side === "left" ? "upperArmL" : "upperArmR");
  }
  return grabbed.has(side === "left" ? "footL" : "footR") ||
    grabbed.has(side === "left" ? "lowerLegL" : "lowerLegR") ||
    grabbed.has(side === "left" ? "upperLegL" : "upperLegR") ||
    grabbed.has("pelvis");
}

function poseRamp(puppet, now) {
  const started = puppet.behaviour.poseRampStartedAt;
  if (!started) return 1;
  const ramp = smoothstep((now - started) / 520);
  if (ramp >= .999) puppet.behaviour.poseRampStartedAt = 0;
  return .30 + .70 * ramp;
}

function applyHistoricTorsoAnchor(puppet, ramp) {
  const torso = puppet.parts.torso;
  if (!torso) return;

  const anyLimbGrab = [...puppet.grabbedParts].some(name => name !== "torso" && name !== "pelvis");
  const anchorPull = anyLimbGrab ? .000034 : .000075;
  const target = puppet.behaviour.anchor;

  Body.applyForce(torso, torso.position, {
    x: ((target.x - torso.position.x) * anchorPull - torso.velocity.x * .0022) * ramp,
    y: ((target.y - torso.position.y) * anchorPull - torso.velocity.y * .0022) * ramp,
  });
}

function applyHistoricPose(puppet, now) {
  const q = POSE_VALUES[puppet.behaviour.pose] || POSE_VALUES.stand;
  const base = q[8];
  const ramp = poseRamp(puppet, now);
  const p = puppet.parts;

  applyHistoricTorsoAnchor(puppet, ramp);

  const torsoHeld = puppet.grabbedParts.has("torso") || puppet.grabbedParts.has("pelvis");
  const headHeld = puppet.grabbedParts.has("head");
  const leftArmHeld = limbGrabbed(puppet, "left", "arm");
  const rightArmHeld = limbGrabbed(puppet, "right", "arm");
  const leftLegHeld = limbGrabbed(puppet, "left", "leg");
  const rightLegHeld = limbGrabbed(puppet, "right", "leg");

  servo(p.torso, base, .008 * (torsoHeld ? .62 : 1), ramp);
  servo(p.pelvis, base, .007 * (torsoHeld ? .62 : 1), ramp);
  servo(p.head, base * .35, .0045 * (headHeld ? .62 : 1), ramp);

  servo(p.upperArmL, base + q[0], .006 * (leftArmHeld ? .62 : 1), ramp);
  servo(p.lowerArmL, base + q[1], .005 * (leftArmHeld ? .62 : 1), ramp);
  servo(p.handL, base + q[1], .0035 * (leftArmHeld ? .62 : 1), ramp);
  servo(p.upperArmR, base + q[2], .006 * (rightArmHeld ? .62 : 1), ramp);
  servo(p.lowerArmR, base + q[3], .005 * (rightArmHeld ? .62 : 1), ramp);
  servo(p.handR, base + q[3], .0035 * (rightArmHeld ? .62 : 1), ramp);
  servo(p.upperLegL, base + q[4], .006 * (leftLegHeld ? .72 : 1), ramp);
  servo(p.lowerLegL, base + q[5], .005 * (leftLegHeld ? .72 : 1), ramp);
  servo(p.footL, base + q[5], .0035 * (leftLegHeld ? .72 : 1), ramp);
  servo(p.upperLegR, base + q[6], .006 * (rightLegHeld ? .72 : 1), ramp);
  servo(p.lowerLegR, base + q[7], .005 * (rightLegHeld ? .72 : 1), ramp);
  servo(p.footR, base + q[7], .0035 * (rightLegHeld ? .72 : 1), ramp);

  // Puppetalk 1 needed these positional cues as well as angular servos for readable poses.
  if (puppet.behaviour.pose === "point" && !leftArmHeld) {
    readablePull(p.handL, { x: p.torso.position.x - 112, y: p.torso.position.y - 27 }, .00025, .0038);
  }

  if (puppet.behaviour.pose === "cheer") {
    if (!leftArmHeld) {
      readablePull(p.handL, { x: p.torso.position.x - 44, y: p.torso.position.y - 124 }, .000265, .0039);
    }
    if (!rightArmHeld) {
      readablePull(p.handR, { x: p.torso.position.x + 44, y: p.torso.position.y - 124 }, .000265, .0039);
    }
  }
}

function startRecovery(puppet, now) {
  puppet.behaviour.recover = {
    startedAt: now,
    x: clamp(puppet.parts.pelvis.position.x, 70, WORLD.width - 70),
    pelvisY: 470,
  };
  puppet.behaviour.mode = "recovering";
  puppet.behaviour.pose = "stand";
}

function guidedRecover(puppet, now) {
  const recover = puppet.behaviour.recover;
  if (!recover) return false;

  const age = now - recover.startedAt;
  const engage = smoothstep(age / 280);
  const finish = smoothstep(age / 1250);
  let maxError = 0;

  for (const [name, [ox, oy, targetAngle]] of Object.entries(RECOVERY_OFFSETS)) {
    const body = puppet.parts[name];
    if (!body) continue;
    const tx = recover.x + ox;
    const ty = recover.pelvisY + oy;
    const dx = tx - body.position.x;
    const dy = ty - body.position.y;
    maxError = Math.max(maxError, Math.hypot(dx, dy));

    const mass = Math.max(.2, body.mass || 1);
    const stiffness = (.00007 + .00012 * engage) * (name === "torso" ? 1.15 : 1);
    const damping = .0045 + .0032 * engage;
    let fx = (dx * stiffness - body.velocity.x * damping) * mass;
    let fy = (dy * stiffness - body.velocity.y * damping) * mass;
    const magnitude = Math.hypot(fx, fy);
    if (magnitude > .032) {
      fx *= .032 / magnitude;
      fy *= .032 / magnitude;
    }
    Body.applyForce(body, body.position, { x: fx, y: fy });

    const turn = angleDelta(targetAngle, body.angle);
    body.torque += clamp(turn * (.006 + .010 * engage) - body.angularVelocity * (.016 + .012 * engage), -.032, .032);

    if (age < 360) scaleVelocity(body, .90 + .07 * finish);
  }

  if ((age > 1250 && maxError < 24) || age > 1850) {
    puppet.behaviour.recover = null;
    puppet.behaviour.mode = "active";
    puppet.behaviour.pose = "stand";
    puppet.behaviour.anchor.x = puppet.parts.torso.position.x;
    puppet.behaviour.anchor.y = puppet.parts.torso.position.y;
    puppet.behaviour.poseRampStartedAt = now;
    return false;
  }
  return true;
}

function enforceJointLimits(puppet) {
  if (puppet.behaviour.mode === "limp") return;
  for (const constraint of puppet.joints) {
    const a = constraint.bodyA;
    const b = constraint.bodyB;
    if (!a || !b) continue;

    let limit = 2.25;
    if (a.circleRadius || b.circleRadius) limit = 1.0;
    else {
      const pointA = constraint.pointA || { x: 0, y: 0 };
      if (Math.abs(pointA.x) > 20 && pointA.y < -15) limit = 2.35;
      else if (Math.abs(pointA.x) > 9 && pointA.y > 28) limit = 1.75;
    }

    const rel = angleDelta(b.angle, a.angle);
    const excess = Math.abs(rel) - limit;
    if (excess <= 0) continue;

    const sign = Math.sign(rel) || 1;
    const correction = Math.min(.075, excess * .06);
    Body.setAngularVelocity(b, b.angularVelocity - sign * correction);
    Body.setAngularVelocity(a, a.angularVelocity + sign * correction * .35);

    if (excess > .48) {
      const extra = Math.min(.11, (excess - .48) * .11 + .035);
      Body.setAngularVelocity(b, (b.angularVelocity - sign * extra) * .62);
      Body.setAngularVelocity(a, (a.angularVelocity + sign * extra * .24) * .78);
    }
  }
}

export function initialisePuppetBehaviour(puppet) {
  puppet.grabbedParts = new Set();
  puppet.grabCounts = new Map();
  puppet.behaviour = {
    mode: "active",
    pose: "stand",
    anchor: {
      x: puppet.parts.torso.position.x,
      y: puppet.parts.torso.position.y,
    },
    poseRampStartedAt: performance.now(),
    recover: null,
    heat: 0,
  };
  return puppet;
}

export function setPuppetAction(puppet, action, poseName = null) {
  if (!puppet?.behaviour) return false;
  const now = performance.now();

  if (action === "limp") {
    puppet.behaviour.mode = "limp";
    puppet.behaviour.recover = null;
    return true;
  }

  if (action === "recover") {
    startRecovery(puppet, now);
    return true;
  }

  if (action === "pose" && POSE_VALUES[poseName]) {
    puppet.behaviour.mode = "active";
    puppet.behaviour.pose = poseName;
    puppet.behaviour.recover = null;
    puppet.behaviour.poseRampStartedAt = now;
    // Stand from limp retains the current arrangement, but stands from where it is.
    if (poseName === "stand") {
      puppet.behaviour.anchor.x = puppet.parts.torso.position.x;
      puppet.behaviour.anchor.y = puppet.parts.torso.position.y;
    }
    return true;
  }

  return false;
}

export function setPuppetGrabbed(puppet, partName, grabbed) {
  if (!puppet?.grabbedParts || !puppet?.grabCounts || !partName) return;
  const current = puppet.grabCounts.get(partName) || 0;
  const next = grabbed ? current + 1 : Math.max(0, current - 1);
  if (next > 0) {
    puppet.grabCounts.set(partName, next);
    puppet.grabbedParts.add(partName);
  } else {
    puppet.grabCounts.delete(partName);
    puppet.grabbedParts.delete(partName);
  }
}

export function setPuppetAnchorFromGrab(puppet, partName, point) {
  if (!puppet?.behaviour || !point || (partName !== "torso" && partName !== "pelvis")) return;
  const grabbedBody = puppet.parts[partName];
  const torso = puppet.parts.torso;
  if (!grabbedBody || !torso) return;
  const offset = Vector.sub(grabbedBody.position, torso.position);
  puppet.behaviour.anchor.x = point.x - offset.x;
  puppet.behaviour.anchor.y = point.y - offset.y;
}

export function stepPuppetBehaviour(puppet) {
  const state = puppet?.behaviour;
  if (!state || state.mode === "limp") return;
  const now = performance.now();
  if (state.mode === "recovering") {
    guidedRecover(puppet, now);
    return;
  }
  applyHistoricPose(puppet, now);
}

export function stabilisePuppet(puppet) {
  if (!puppet?.behaviour) return;
  enforceJointLimits(puppet);

  let hottestSpeed = 0;
  let hottestAngular = 0;
  for (const body of Object.values(puppet.parts)) {
    hottestSpeed = Math.max(hottestSpeed, Math.hypot(body.velocity.x, body.velocity.y));
    hottestAngular = Math.max(hottestAngular, Math.abs(body.angularVelocity));
  }

  const runaway = hottestSpeed > 9 || hottestAngular > .24;
  puppet.behaviour.heat = runaway ? puppet.behaviour.heat + 1 : Math.max(0, puppet.behaviour.heat - 1);

  for (const body of Object.values(puppet.parts)) {
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > 7.2) {
      const factor = 7.2 / speed;
      Body.setVelocity(body, { x: body.velocity.x * factor, y: body.velocity.y * factor });
    }
    if (Math.abs(body.angularVelocity) > .18) {
      Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * .18);
    }
  }

  if (puppet.behaviour.heat >= 3) {
    for (const body of Object.values(puppet.parts)) scaleVelocity(body, .22);
    puppet.behaviour.heat = 0;
  }
}

export function serialisePuppetBehaviour(puppet) {
  return {
    mode: puppet?.behaviour?.mode || "limp",
    pose: puppet?.behaviour?.pose || "stand",
  };
}
