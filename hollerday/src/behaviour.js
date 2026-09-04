import { WORLD } from "./config.js";

const { Body, Vector } = Matter;

// These are the pose values from the frozen Puppetalk build.
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

function worldPoint(body, local) {
  const rotated = Vector.rotate(local, body.angle);
  return { x: body.position.x + rotated.x, y: body.position.y + rotated.y };
}

function springPull(body, point, target, stiffness, damping = .003, factor = 1) {
  if (!body || !point) return;
  const mass = Math.max(.2, body.mass || 1);
  Body.applyForce(body, point, {
    x: ((target.x - point.x) * stiffness - body.velocity.x * damping) * mass * factor,
    y: ((target.y - point.y) * stiffness - body.velocity.y * damping) * mass * factor,
  });
}

function servo(body, target, strength = .006, factor = 1) {
  if (!body) return;
  const correction = angleDelta(target, body.angle) * strength - body.angularVelocity * strength * .72;
  body.torque += clamp(correction, -.028, .028) * factor;
}

function poseRamp(puppet, now) {
  const started = puppet.behaviour.poseRampStartedAt;
  if (!started) return 1;
  const raw = smoothstep((now - started) / 520);
  if (raw >= .999) puppet.behaviour.poseRampStartedAt = 0;
  return .30 + .70 * raw;
}

function active(puppet, name) {
  return puppet.grabbedParts.has(name);
}

function armHeld(puppet, side) {
  return active(puppet, side === "left" ? "leftHand" : "rightHand") ||
    active(puppet, side === "left" ? "leftShoulder" : "rightShoulder");
}

function legHeld(puppet, side) {
  return active(puppet, side === "left" ? "leftFoot" : "rightFoot") || active(puppet, "pelvis");
}

// This is the important part that was missing from the first Hollerday port.
// The frozen build did not merely rotate joints into a standing pose: it held the
// torso at a floor-relative standing height, supported the whole leg chain, pinned
// the virtual feet to the floor, held the head up and leaned the torso over the
// midpoint of the feet. These springs are what actually make the ragdoll stand.
function applyFrozenPoseController(puppet, now) {
  const p = puppet.parts;
  const q = POSES[puppet.behaviour.pose] || POSES.stand;
  const base = q[8];
  const ramp = poseRamp(puppet, now);
  const crouched = puppet.behaviour.pose === "crouch";
  const floorY = WORLD.floorY;
  const standingY = floorY - (crouched ? 112 : 145);
  const anchorX = clamp(puppet.behaviour.anchorX, 70, WORLD.width - 70);

  const coreGrab = active(puppet, "torso") || active(puppet, "pelvis") ||
    active(puppet, "leftShoulder") || active(puppet, "rightShoulder");
  const limbGrab = [...puppet.grabbedParts].some(name =>
    !["torso", "pelvis", "leftShoulder", "rightShoulder"].includes(name)
  );

  // Frozen boot.js: .00015 ordinary stand, .00011 while another limb is held.
  if (!coreGrab) {
    springPull(
      p.torso,
      p.torso.position,
      { x: anchorX, y: standingY },
      limbGrab ? .00011 : .00015,
      .0049,
      ramp
    );
  }

  const legSpread = crouched ? 22 : 16;
  const thighY = standingY + (crouched ? 48 : 61);
  const shinY = standingY + (crouched ? 88 : 112);
  const footY = floorY - 2;

  if (!legHeld(puppet, "left")) {
    springPull(p.upperLegL, p.upperLegL.position, { x: anchorX - 13, y: thighY }, .000078, .0055, ramp);
    springPull(p.lowerLegL, p.lowerLegL.position, { x: anchorX - legSpread, y: shinY }, .0001, .0057, ramp);
    springPull(
      p.lowerLegL,
      worldPoint(p.lowerLegL, { x: 0, y: 25 }),
      { x: anchorX - legSpread, y: footY },
      .00017,
      .0059,
      ramp
    );
  }

  if (!legHeld(puppet, "right")) {
    springPull(p.upperLegR, p.upperLegR.position, { x: anchorX + 13, y: thighY }, .000078, .0055, ramp);
    springPull(p.lowerLegR, p.lowerLegR.position, { x: anchorX + legSpread, y: shinY }, .0001, .0057, ramp);
    springPull(
      p.lowerLegR,
      worldPoint(p.lowerLegR, { x: 0, y: 25 }),
      { x: anchorX + legSpread, y: footY },
      .00017,
      .0059,
      ramp
    );
  }

  if (!active(puppet, "head")) {
    springPull(p.head, p.head.position, { x: anchorX, y: standingY - 65 }, .000095, .0046, ramp);
  }

  // The final compatibility pass also settled neutral hands rather than letting
  // the hidden arm mass torque them upward in Stand.
  if (puppet.behaviour.pose === "stand") {
    if (!armHeld(puppet, "left")) {
      springPull(
        p.lowerArmL,
        worldPoint(p.lowerArmL, { x: 0, y: 23 }),
        { x: anchorX - 42, y: standingY + 53 },
        .000085,
        .0056,
        ramp
      );
    }
    if (!armHeld(puppet, "right")) {
      springPull(
        p.lowerArmR,
        worldPoint(p.lowerArmR, { x: 0, y: 23 }),
        { x: anchorX + 42, y: standingY + 53 },
        .000085,
        .0056,
        ramp
      );
    }
  }

  // Readable pose pulls from the final pose-tuning pass.
  if (puppet.behaviour.pose === "point" && !armHeld(puppet, "left")) {
    springPull(
      p.lowerArmL,
      worldPoint(p.lowerArmL, { x: 0, y: 23 }),
      { x: p.torso.position.x - 112, y: p.torso.position.y - 27 },
      .00025,
      .0038,
      ramp
    );
  }

  if (puppet.behaviour.pose === "cheer") {
    if (!armHeld(puppet, "left")) {
      springPull(
        p.lowerArmL,
        worldPoint(p.lowerArmL, { x: 0, y: 23 }),
        { x: p.torso.position.x - 44, y: p.torso.position.y - 124 },
        .000265,
        .0039,
        ramp
      );
    }
    if (!armHeld(puppet, "right")) {
      springPull(
        p.lowerArmR,
        worldPoint(p.lowerArmR, { x: 0, y: 23 }),
        { x: p.torso.position.x + 44, y: p.torso.position.y - 124 },
        .000265,
        .0039,
        ramp
      );
    }
  }

  const leftFoot = worldPoint(p.lowerLegL, { x: 0, y: 25 });
  const rightFoot = worldPoint(p.lowerLegR, { x: 0, y: 25 });
  const midFootX = (leftFoot.x + rightFoot.x) * .5;
  const balanceLean = clamp((midFootX - p.torso.position.x) * .0045 - p.torso.velocity.x * .014, -.24, .24);
  const muscle = limbGrab ? .86 : coreGrab ? .9 : 1;

  // These are the final frozen strengths, not the much weaker original app.js values.
  servo(p.torso, base + balanceLean, .018 * muscle, ramp);
  servo(p.head, base * .2, .011 * muscle, ramp);
  servo(p.upperArmL, base + q[0], .0072 * muscle, ramp * (armHeld(puppet, "left") ? .62 : 1));
  servo(p.lowerArmL, base + q[1], .0062 * muscle, ramp * (armHeld(puppet, "left") ? .62 : 1));
  servo(p.upperArmR, base + q[2], .0072 * muscle, ramp * (armHeld(puppet, "right") ? .62 : 1));
  servo(p.lowerArmR, base + q[3], .0062 * muscle, ramp * (armHeld(puppet, "right") ? .62 : 1));
  servo(p.upperLegL, base + q[4], .0155 * muscle, ramp * (legHeld(puppet, "left") ? .72 : 1));
  servo(p.lowerLegL, base + q[5], .014 * muscle, ramp * (legHeld(puppet, "left") ? .72 : 1));
  servo(p.upperLegR, base + q[6], .0155 * muscle, ramp * (legHeld(puppet, "right") ? .72 : 1));
  servo(p.lowerLegR, base + q[7], .014 * muscle, ramp * (legHeld(puppet, "right") ? .72 : 1));
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
    puppet.behaviour.anchorX = clamp(puppet.parts.torso.position.x, 70, WORLD.width - 70);
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
    anchorX: clamp(puppet.parts.torso.position.x, 70, WORLD.width - 70),
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
    // Stand deliberately does not untangle, but it does always stand at the
    // floor-relative standing height. Only horizontal position is inherited.
    if (poseName === "stand") {
      puppet.behaviour.anchorX = clamp(puppet.parts.torso.position.x, 70, WORLD.width - 70);
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
    puppet.behaviour.anchorX = clamp(point.x, 70, WORLD.width - 70);
    return;
  }
  if (partName === "pelvis") {
    const torso = puppet.parts.torso;
    const offset = Vector.rotate({ x: 0, y: 38 }, torso.angle);
    puppet.behaviour.anchorX = clamp(point.x - offset.x, 70, WORLD.width - 70);
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
  applyFrozenPoseController(puppet, now);
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
