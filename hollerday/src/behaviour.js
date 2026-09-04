import { WORLD } from "./config.js";

const { Body, Vector } = Matter;

const POSES = Object.freeze({
  stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13],
});

const RECOVERY_LAYOUT = Object.freeze({
  torso: [0, 0, 0],
  head: [0, -65, 0],
  upperArmL: [-37, -17, .12],
  lowerArmL: [-42, 30, .05],
  upperArmR: [37, -17, -.12],
  lowerArmR: [42, 30, -.05],
  upperLegL: [-14, 65, .04],
  lowerLegL: [-14, 118, .02],
  upperLegR: [14, 65, -.04],
  lowerLegR: [14, 118, -.02],
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

function servo(body, target, strength = .006, factor = 1) {
  if (!body) return;
  const correction = angleDelta(target, body.angle) * strength - body.angularVelocity * strength * .72;
  body.torque += clamp(correction, -.028, .028) * factor;
}

function worldPoint(body, local) {
  const r = Vector.rotate(local, body.angle);
  return { x: body.position.x + r.x, y: body.position.y + r.y };
}

function pullPoint(body, point, target, stiffness, damping = .0038) {
  if (!body || !point) return;
  const mass = Math.max(.2, body.mass || 1);
  let fx = ((target.x - point.x) * stiffness - body.velocity.x * damping) * mass;
  let fy = ((target.y - point.y) * stiffness - body.velocity.y * damping) * mass;
  const magnitude = Math.hypot(fx, fy);
  const maxForce = .032;
  if (magnitude > maxForce) {
    fx *= maxForce / magnitude;
    fy *= maxForce / magnitude;
  }
  Body.applyForce(body, point, { x: fx, y: fy });
}

function armHeld(puppet, side) {
  return puppet.grabbedParts.has(side === "left" ? "leftHand" : "rightHand") ||
    puppet.grabbedParts.has(side === "left" ? "leftShoulder" : "rightShoulder");
}

function legHeld(puppet, side) {
  return puppet.grabbedParts.has(side === "left" ? "leftFoot" : "rightFoot") ||
    puppet.grabbedParts.has("pelvis");
}

function poseRamp(puppet, now) {
  const started = puppet.behaviour.poseRampStartedAt;
  if (!started) return 1;
  const ramp = smoothstep((now - started) / 520);
  if (ramp >= .999) puppet.behaviour.poseRampStartedAt = 0;
  return .30 + .70 * ramp;
}

function applyTorsoAnchor(puppet, ramp) {
  const torso = puppet.parts.torso;
  const target = puppet.behaviour.anchor;
  const limbGrab = [...puppet.grabbedParts].some(name => name !== "torso" && name !== "pelvis");
  const anchorPull = limbGrab ? .000034 : .000075;

  Body.applyForce(torso, torso.position, {
    x: ((target.x - torso.position.x) * anchorPull - torso.velocity.x * .0022) * ramp,
    y: ((target.y - torso.position.y) * anchorPull - torso.velocity.y * .0022) * ramp,
  });
}

function applyPose(puppet, now) {
  const q = POSES[puppet.behaviour.pose] || POSES.stand;
  const base = q[8];
  const ramp = poseRamp(puppet, now);
  const p = puppet.parts;
  const torsoHeld = puppet.grabbedParts.has("torso") || puppet.grabbedParts.has("pelvis");
  const headHeld = puppet.grabbedParts.has("head");
  const leftArmHeld = armHeld(puppet, "left");
  const rightArmHeld = armHeld(puppet, "right");
  const leftLegHeld = legHeld(puppet, "left");
  const rightLegHeld = legHeld(puppet, "right");

  applyTorsoAnchor(puppet, ramp);

  servo(p.torso, base, .008, ramp * (torsoHeld ? .62 : 1));
  servo(p.head, base * .35, .0045, ramp * (headHeld ? .62 : 1));
  servo(p.upperArmL, base + q[0], .006, ramp * (leftArmHeld ? .62 : 1));
  servo(p.lowerArmL, base + q[1], .005, ramp * (leftArmHeld ? .62 : 1));
  servo(p.upperArmR, base + q[2], .006, ramp * (rightArmHeld ? .62 : 1));
  servo(p.lowerArmR, base + q[3], .005, ramp * (rightArmHeld ? .62 : 1));
  servo(p.upperLegL, base + q[4], .006, ramp * (leftLegHeld ? .72 : 1));
  servo(p.lowerLegL, base + q[5], .005, ramp * (leftLegHeld ? .72 : 1));
  servo(p.upperLegR, base + q[6], .006, ramp * (rightLegHeld ? .72 : 1));
  servo(p.lowerLegR, base + q[7], .005, ramp * (rightLegHeld ? .72 : 1));

  // Final Puppetalk 1 tuning used a positional cue as well as servo angles so
  // these two poses read clearly instead of merely rotating the arm vaguely.
  if (puppet.behaviour.pose === "point" && !leftArmHeld) {
    const hand = worldPoint(p.lowerArmL, { x: 0, y: 23 });
    pullPoint(p.lowerArmL, hand, { x: p.torso.position.x - 112, y: p.torso.position.y - 27 }, .00025, .0038);
  }

  if (puppet.behaviour.pose === "cheer") {
    if (!leftArmHeld) {
      const hand = worldPoint(p.lowerArmL, { x: 0, y: 23 });
      pullPoint(p.lowerArmL, hand, { x: p.torso.position.x - 44, y: p.torso.position.y - 124 }, .000265, .0039);
    }
    if (!rightArmHeld) {
      const hand = worldPoint(p.lowerArmR, { x: 0, y: 23 });
      pullPoint(p.lowerArmR, hand, { x: p.torso.position.x + 44, y: p.torso.position.y - 124 }, .000265, .0039);
    }
  }
}

function beginRecovery(puppet, now) {
  puppet.behaviour.mode = "recovering";
  puppet.behaviour.pose = "stand";
  puppet.behaviour.recover = {
    startedAt: now,
    x: clamp(puppet.parts.torso.position.x, 70, WORLD.width - 70),
    torsoY: WORLD.floorY - 145,
  };
}

function guidedRecover(puppet, now) {
  const state = puppet.behaviour.recover;
  if (!state) return false;
  const age = now - state.startedAt;
  const engage = smoothstep(age / 280);
  const finish = smoothstep(age / 1250);
  let maxError = 0;

  for (const [name, [ox, oy, targetAngle]] of Object.entries(RECOVERY_LAYOUT)) {
    const body = puppet.parts[name];
    if (!body) continue;
    const tx = state.x + ox;
    const ty = state.torsoY + oy;
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
      const p = constraint.pointA || { x: 0, y: 0 };
      if (Math.abs(p.x) > 20 && p.y < -15) limit = 2.35;
      else if (Math.abs(p.x) > 9 && p.y > 28) limit = 1.75;
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
    beginRecovery(puppet, now);
    return true;
  }

  if (action === "pose" && POSES[poseName]) {
    puppet.behaviour.mode = "active";
    puppet.behaviour.pose = poseName;
    puppet.behaviour.recover = null;
    puppet.behaviour.poseRampStartedAt = now;
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
  if (!puppet?.behaviour || !point) return;
  if (partName === "torso") {
    puppet.behaviour.anchor.x = point.x;
    puppet.behaviour.anchor.y = point.y;
    return;
  }
  if (partName === "pelvis") {
    const torso = puppet.parts.torso;
    const offset = Vector.rotate({ x: 0, y: 38 }, torso.angle);
    puppet.behaviour.anchor.x = point.x - offset.x;
    puppet.behaviour.anchor.y = point.y - offset.y;
  }
}

export function stepPuppetBehaviour(puppet) {
  const state = puppet?.behaviour;
  if (!state || state.mode === "limp") return;
  const now = performance.now();
  if (state.mode === "recovering") {
    guidedRecover(puppet, now);
    return;
  }
  applyPose(puppet, now);
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
      const f = 7.2 / speed;
      Body.setVelocity(body, { x: body.velocity.x * f, y: body.velocity.y * f });
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
