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

function worldPoint(body, local) {
  const rotated = Vector.rotate(local, body.angle);
  return { x: body.position.x + rotated.x, y: body.position.y + rotated.y };
}

function springPull(body, point, target, stiffness, damping = .003) {
  if (!body || !point) return;
  const mass = Math.max(.2, body.mass || 1);
  Body.applyForce(body, point, {
    x: ((target.x - point.x) * stiffness - body.velocity.x * damping) * mass,
    y: ((target.y - point.y) * stiffness - body.velocity.y * damping) * mass,
  });
}

function servo(body, target, strength = .006) {
  if (!body) return;
  const correction = angleDelta(target, body.angle) * strength - body.angularVelocity * strength * .72;
  body.torque += clamp(correction, -.028, .028);
}

function grabBody(puppet, part) {
  const p = puppet.parts;
  if (part === "head") return p.head;
  if (part === "leftHand") return p.lowerArmL;
  if (part === "rightHand") return p.lowerArmR;
  if (part === "leftFoot") return p.lowerLegL;
  if (part === "rightFoot") return p.lowerLegR;
  return p.torso;
}

function grabWorldPoint(puppet, part) {
  const p = puppet.parts;
  if (part === "pelvis") return worldPoint(p.torso, { x: 0, y: 34 });
  if (part === "leftShoulder") return worldPoint(p.torso, { x: -24, y: -27 });
  if (part === "rightShoulder") return worldPoint(p.torso, { x: 24, y: -27 });
  if (part === "leftHand") return worldPoint(p.lowerArmL, { x: 0, y: 23 });
  if (part === "rightHand") return worldPoint(p.lowerArmR, { x: 0, y: 23 });
  if (part === "leftFoot") return worldPoint(p.lowerLegL, { x: 0, y: 25 });
  if (part === "rightFoot") return worldPoint(p.lowerLegR, { x: 0, y: 25 });
  return grabBody(puppet, part).position;
}

function antiTangleTarget(puppet, part, desired, age) {
  if (!(part.includes("Hand") || part.includes("Foot"))) return desired;
  const t = puppet.parts.torso.position;
  let clear = desired;
  if (part === "leftHand") clear = { x: t.x - 54, y: t.y + 4 };
  if (part === "rightHand") clear = { x: t.x + 54, y: t.y + 4 };
  if (part === "leftFoot") clear = { x: t.x - 23, y: t.y + 132 };
  if (part === "rightFoot") clear = { x: t.x + 23, y: t.y + 132 };
  const fade = 1 - clamp(age / 120, 0, 1);
  const amount = .10 * fade;
  return {
    x: desired.x + (clear.x - desired.x) * amount,
    y: desired.y + (clear.y - desired.y) * amount,
  };
}

function rootFollow(part) {
  if (part === "torso") return 1;
  if (part === "pelvis") return .92;
  if (part.includes("Shoulder")) return .78;
  if (part === "head") return .66;
  if (part.includes("Hand")) return .40;
  return .27;
}

function rootSlack(part) {
  if (part === "torso" || part === "pelvis") return { free: 0, ramp: 1 };
  if (part.includes("Shoulder")) return { free: 24, ramp: 48 };
  if (part === "head") return { free: 36, ramp: 64 };
  if (part.includes("Hand")) return { free: 58, ramp: 82 };
  return { free: 48, ramp: 76 };
}

function followAfterSlack(part, dx, dy) {
  if (part === "torso" || part === "pelvis") return 1;
  const slack = rootSlack(part);
  const travel = Math.hypot(dx, dy);
  const t = clamp((travel - slack.free) / slack.ramp, 0, 1);
  const eased = t * t * (3 - 2 * t);
  return rootFollow(part) * eased;
}

function drivePuppet(puppet) {
  const p = puppet.parts;
  const state = puppet.behaviour;
  const t = p.torso;
  const floorY = WORLD.floorY;
  const crouched = state.pose === "crouch";
  const standingY = floorY - (crouched ? 112 : 145);

  if (state.lastPose !== state.pose || state.lastPoseVersion !== state.poseVersion) {
    state.lastPose = state.pose;
    state.lastPoseVersion = state.poseVersion;
    state.pins = { head: null, leftHand: null, rightHand: null, leftFoot: null, rightFoot: null };
  }

  const grabs = [...state.grabs.values()].slice(0, 2);
  const activeParts = new Set(grabs.map(grab => grab.part));
  puppet.grabbedParts = activeParts;

  for (const key of [...state.sessions.keys()]) {
    if (!grabs.some(grab => grab.pointerId === key)) state.sessions.delete(key);
  }

  const now = performance.now();
  const prepared = [];
  let rootSum = 0;
  let rootWeight = 0;
  let torsoDesired = null;

  for (const grab of grabs) {
    const desired = {
      x: clamp(grab.x, 20, WORLD.width - 20),
      y: clamp(grab.y, 30, WORLD.height - 24),
    };
    let session = state.sessions.get(grab.pointerId);
    if (!session) {
      session = {
        startDesired: { x: desired.x, y: desired.y },
        startRootX: state.targetX,
        startTorsoY: t.position.y,
        startedAt: now,
      };
      state.sessions.set(grab.pointerId, session);
    }

    const age = now - session.startedAt;
    const guided = antiTangleTarget(puppet, grab.part, desired, age);
    const dx = desired.x - session.startDesired.x;
    const dy = desired.y - session.startDesired.y;
    const follow = followAfterSlack(grab.part, dx, dy);
    const baseFollow = rootFollow(grab.part);
    const followBlend = baseFollow > 0 ? clamp(follow / baseFollow, 0, 1) : 1;
    const rootX = grab.part === "torso" || grab.part === "pelvis"
      ? desired.x
      : session.startRootX + dx * follow;
    const weight = grab.part === "torso" ? 2 : grab.part === "pelvis" ? 1.7 : 1;
    rootSum += clamp(rootX, 70, WORLD.width - 70) * weight;
    rootWeight += weight;
    if (grab.part === "torso" || grab.part === "pelvis") torsoDesired = desired;
    prepared.push({ grab, desired, guided, session, followBlend });
  }

  if (rootWeight) state.targetX = clamp(rootSum / rootWeight, 70, WORLD.width - 70);
  const anchorX = clamp(state.targetX, 70, WORLD.width - 70);
  const coreGrab = grabs.some(grab => ["torso", "pelvis", "leftShoulder", "rightShoulder"].includes(grab.part));
  const limbGrab = grabs.some(grab => !["torso", "pelvis", "leftShoulder", "rightShoulder"].includes(grab.part));

  for (const item of prepared) {
    const part = item.grab.part;
    const body = grabBody(puppet, part);
    const point = grabWorldPoint(puppet, part);
    const twoFingerScale = grabs.length > 1 ? .86 : 1;
    const strength = (
      state.mode === "limp" ? .00017 :
      part === "head" ? .00022 :
      part === "torso" || part === "pelvis" ? .00019 :
      part.includes("Shoulder") ? .0002 : .00019
    ) * twoFingerScale;

    springPull(body, point, item.guided, strength, .0026);

    if (!['torso', 'pelvis'].includes(part)) {
      const followY = part.includes("Shoulder") ? .68 : part === "head" ? .7 : part.includes("Hand") ? .38 : .28;
      const bodyTargetY = item.session.startTorsoY + (item.desired.y - item.session.startDesired.y) * followY * item.followBlend;
      springPull(t, t.position, { x: anchorX, y: bodyTargetY }, (.000052 + .000036 * item.followBlend) / grabs.length, .0045);
    }

    if (["head", "leftHand", "rightHand", "leftFoot", "rightFoot"].includes(part)) {
      state.pins[part] = { x: item.desired.x - anchorX, y: item.desired.y - standingY };
    }
  }

  if (state.mode === "limp") return;

  if (!coreGrab) {
    springPull(t, t.position, { x: anchorX, y: standingY }, limbGrab ? .00011 : .00015, .0049);
  } else if (torsoDesired) {
    springPull(t, t.position, torsoDesired, .000075, .0042);
  }

  const legSpread = crouched ? 22 : 16;
  const thighY = standingY + (crouched ? 48 : 61);
  const shinY = standingY + (crouched ? 88 : 112);
  const footY = floorY - 2;

  if (!activeParts.has("leftFoot") && !state.pins.leftFoot) {
    springPull(p.upperLegL, p.upperLegL.position, { x: anchorX - 13, y: thighY }, .000078, .0055);
    springPull(p.lowerLegL, p.lowerLegL.position, { x: anchorX - legSpread, y: shinY }, .0001, .0057);
    springPull(p.lowerLegL, grabWorldPoint(puppet, "leftFoot"), { x: anchorX - legSpread, y: footY }, .00017, .0059);
  }
  if (!activeParts.has("rightFoot") && !state.pins.rightFoot) {
    springPull(p.upperLegR, p.upperLegR.position, { x: anchorX + 13, y: thighY }, .000078, .0055);
    springPull(p.lowerLegR, p.lowerLegR.position, { x: anchorX + legSpread, y: shinY }, .0001, .0057);
    springPull(p.lowerLegR, grabWorldPoint(puppet, "rightFoot"), { x: anchorX + legSpread, y: footY }, .00017, .0059);
  }

  for (const part of ["head", "leftHand", "rightHand", "leftFoot", "rightFoot"]) {
    const pin = state.pins[part];
    if (!pin || activeParts.has(part)) continue;
    const body = grabBody(puppet, part);
    const point = grabWorldPoint(puppet, part);
    const strength = part === "head" ? .00017 : part.includes("Foot") ? .000145 : .00013;
    springPull(body, point, { x: anchorX + pin.x, y: standingY + pin.y }, strength, .0044);
  }

  if (!state.pins.head && !activeParts.has("head")) {
    springPull(p.head, p.head.position, { x: anchorX, y: standingY - 65 }, .000095, .0046);
  }

  if (state.pose === "stand") {
    if (!activeParts.has("leftHand") && !state.pins.leftHand) {
      springPull(p.lowerArmL, grabWorldPoint(puppet, "leftHand"), { x: anchorX - 42, y: standingY + 53 }, .000085, .0056);
    }
    if (!activeParts.has("rightHand") && !state.pins.rightHand) {
      springPull(p.lowerArmR, grabWorldPoint(puppet, "rightHand"), { x: anchorX + 42, y: standingY + 53 }, .000085, .0056);
    }
  }

  if (state.pose === "point" && !activeParts.has("leftHand") && !activeParts.has("leftShoulder")) {
    springPull(p.lowerArmL, grabWorldPoint(puppet, "leftHand"), { x: t.position.x - 112, y: t.position.y - 27 }, .00025, .0038);
  }
  if (state.pose === "cheer") {
    if (!activeParts.has("leftHand") && !activeParts.has("leftShoulder")) {
      springPull(p.lowerArmL, grabWorldPoint(puppet, "leftHand"), { x: t.position.x - 44, y: t.position.y - 124 }, .000265, .0039);
    }
    if (!activeParts.has("rightHand") && !activeParts.has("rightShoulder")) {
      springPull(p.lowerArmR, grabWorldPoint(puppet, "rightHand"), { x: t.position.x + 44, y: t.position.y - 124 }, .000265, .0039);
    }
  }

  const leftFoot = grabWorldPoint(puppet, "leftFoot");
  const rightFoot = grabWorldPoint(puppet, "rightFoot");
  const q = POSES[state.pose] || POSES.stand;
  const base = q[8];
  const midFootX = (leftFoot.x + rightFoot.x) * .5;
  const balanceLean = clamp((midFootX - t.position.x) * .0045 - t.velocity.x * .014, -.24, .24);
  const muscle = limbGrab ? .86 : coreGrab ? .9 : 1;

  servo(t, base + balanceLean, .018 * muscle);
  servo(p.head, base * .2, .011 * muscle);
  const limbs = [p.upperArmL, p.lowerArmL, p.upperArmR, p.lowerArmR, p.upperLegL, p.lowerLegL, p.upperLegR, p.lowerLegR];
  limbs.forEach((body, index) => {
    const strength = index < 4 ? (index % 2 ? .0062 : .0072) : (index % 2 ? .014 : .0155);
    servo(body, base + q[index], strength * muscle);
  });
}

function beginRecovery(puppet, now) {
  const state = puppet.behaviour;
  state.mode = "recovering";
  state.pose = "stand";
  state.poseVersion += 1;
  state.grabs.clear();
  state.sessions.clear();
  puppet.grabbedParts = new Set();
  state.recover = {
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
    puppet.behaviour.poseVersion += 1;
    puppet.behaviour.targetX = puppet.parts.torso.position.x;
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
  puppet.behaviour = {
    mode: "active",
    pose: "stand",
    poseVersion: 0,
    lastPose: "stand",
    lastPoseVersion: -1,
    targetX: puppet.parts.torso.position.x,
    grabs: new Map(),
    sessions: new Map(),
    pins: { head: null, leftHand: null, rightHand: null, leftFoot: null, rightFoot: null },
    recover: null,
    heat: 0,
  };
  return puppet;
}

export function beginPuppetGrab(puppet, pointerId, part, point) {
  if (!puppet?.behaviour || !part || !point) return false;
  if (!puppet.behaviour.grabs.has(pointerId) && puppet.behaviour.grabs.size >= 2) return false;
  puppet.behaviour.grabs.set(pointerId, { pointerId, part, x: point.x, y: point.y });
  return true;
}

export function movePuppetGrab(puppet, pointerId, point) {
  const grab = puppet?.behaviour?.grabs.get(pointerId);
  if (!grab || !point) return false;
  grab.x = point.x;
  grab.y = point.y;
  return true;
}

export function endPuppetGrab(puppet, pointerId) {
  if (!puppet?.behaviour) return false;
  puppet.behaviour.grabs.delete(pointerId);
  puppet.behaviour.sessions.delete(pointerId);
  return true;
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
    puppet.behaviour.poseVersion += 1;
    puppet.behaviour.recover = null;
    return true;
  }
  return false;
}

export function stepPuppetBehaviour(puppet) {
  if (!puppet?.behaviour) return;
  if (puppet.behaviour.mode === "recovering") {
    guidedRecover(puppet, performance.now());
    return;
  }
  drivePuppet(puppet);
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
