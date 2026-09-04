import { WORLD } from "./config.js";

const { Body, Vector } = Matter;

const TAU = Math.PI * 2;
const STAND_PELVIS_Y = 470;

const CANONICAL_OFFSETS = Object.freeze({
  head: [0, -118],
  torso: [0, -58],
  pelvis: [0, 0],
  upperArmL: [-43, -68],
  lowerArmL: [-43, -18],
  handL: [-43, 19],
  upperArmR: [43, -68],
  lowerArmR: [43, -18],
  handR: [43, 19],
  upperLegL: [-16, 47],
  lowerLegL: [-16, 104],
  footL: [-20, 142],
  upperLegR: [16, 47],
  lowerLegR: [16, 104],
  footR: [20, 142],
});

const BASE_ANGLES = Object.freeze({
  head: 0,
  torso: 0,
  pelvis: 0,
  upperArmL: 0.08,
  lowerArmL: 0.02,
  handL: 0,
  upperArmR: -0.08,
  lowerArmR: -0.02,
  handR: 0,
  upperLegL: 0.03,
  lowerLegL: -0.02,
  footL: 0,
  upperLegR: -0.03,
  lowerLegR: 0.02,
  footR: 0,
});

export const POSES = Object.freeze({
  stand: {
    pelvisY: STAND_PELVIS_Y,
    angles: { ...BASE_ANGLES },
  },
  point: {
    pelvisY: STAND_PELVIS_Y,
    angles: {
      ...BASE_ANGLES,
      upperArmR: -Math.PI / 2,
      lowerArmR: -Math.PI / 2,
      handR: -Math.PI / 2,
    },
  },
  cheer: {
    pelvisY: STAND_PELVIS_Y,
    angles: {
      ...BASE_ANGLES,
      upperArmL: 2.45,
      lowerArmL: 2.9,
      handL: 2.9,
      upperArmR: -2.45,
      lowerArmR: -2.9,
      handR: -2.9,
    },
  },
  shrug: {
    pelvisY: STAND_PELVIS_Y,
    angles: {
      ...BASE_ANGLES,
      upperArmL: 1.18,
      lowerArmL: 2.28,
      handL: 2.1,
      upperArmR: -1.18,
      lowerArmR: -2.28,
      handR: -2.1,
    },
  },
  crouch: {
    pelvisY: 525,
    angles: {
      ...BASE_ANGLES,
      upperLegL: 0.46,
      lowerLegL: -0.62,
      footL: 0.05,
      upperLegR: -0.46,
      lowerLegR: 0.62,
      footR: -0.05,
      torso: 0.04,
    },
  },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleError(target, current) {
  let error = (target - current + Math.PI) % TAU - Math.PI;
  if (error < -Math.PI) error += TAU;
  return error;
}

function applyAngleMuscle(body, target, strength = 1) {
  if (!body) return;
  const error = angleError(target, body.angle);
  const control = clamp(error * 0.035 - body.angularVelocity * 0.08, -0.12, 0.12);
  body.torque += control * body.mass * strength;
}

function applySupport(puppet, targetY) {
  const pelvis = puppet.parts.pelvis;
  if (!pelvis || puppet.grabbedParts.has("pelvis") || puppet.grabbedParts.has("torso")) return;

  const errorY = targetY - pelvis.position.y;
  const accelerationY = clamp(
    errorY * 0.000035 - pelvis.velocity.y * 0.00012 - 0.001,
    -0.005,
    0.004
  );
  Body.applyForce(pelvis, pelvis.position, { x: 0, y: pelvis.mass * accelerationY });
}

function applyPose(puppet, pose) {
  applySupport(puppet, pose.pelvisY);
  for (const [name, target] of Object.entries(pose.angles)) {
    if (puppet.grabbedParts.has(name)) continue;
    applyAngleMuscle(puppet.parts[name], target, name === "torso" || name === "pelvis" ? 1.35 : 1);
  }
}

function applyRecoverySpring(body, target) {
  const delta = Vector.sub(target, body.position);
  const accelerationX = clamp(delta.x * 0.000025 - body.velocity.x * 0.00018, -0.004, 0.004);
  const accelerationY = clamp(delta.y * 0.000025 - body.velocity.y * 0.00018 - 0.001, -0.0045, 0.0045);
  Body.applyForce(body, body.position, {
    x: body.mass * accelerationX,
    y: body.mass * accelerationY,
  });
}

function stepRecovery(puppet, dtMs) {
  const state = puppet.behaviour;
  state.recoveryElapsed += dtMs;
  const rootX = clamp(state.recoveryAnchorX, 80, WORLD.width - 80);
  let totalError = 0;
  let count = 0;

  for (const [name, offset] of Object.entries(CANONICAL_OFFSETS)) {
    const body = puppet.parts[name];
    if (!body) continue;
    const target = { x: rootX + offset[0], y: STAND_PELVIS_Y + offset[1] };
    totalError += Vector.magnitude(Vector.sub(target, body.position));
    count += 1;
    applyRecoverySpring(body, target);
    applyAngleMuscle(body, BASE_ANGLES[name] ?? 0, 1.45);
  }

  const averageError = count ? totalError / count : 0;
  if ((state.recoveryElapsed > 900 && averageError < 24) || state.recoveryElapsed > 2400) {
    state.mode = "active";
    state.pose = "stand";
    state.recoveryElapsed = 0;
  }
}

export function initialisePuppetBehaviour(puppet) {
  puppet.grabbedParts = new Set();
  puppet.grabCounts = new Map();
  puppet.behaviour = {
    mode: "active",
    pose: "stand",
    recoveryElapsed: 0,
    recoveryAnchorX: puppet.parts.pelvis.position.x,
  };
  return puppet;
}

export function setPuppetAction(puppet, action, poseName = null) {
  if (!puppet?.behaviour) return false;

  if (action === "limp") {
    puppet.behaviour.mode = "limp";
    puppet.behaviour.recoveryElapsed = 0;
    return true;
  }

  if (action === "recover") {
    puppet.behaviour.mode = "recovering";
    puppet.behaviour.pose = "stand";
    puppet.behaviour.recoveryElapsed = 0;
    puppet.behaviour.recoveryAnchorX = puppet.parts.pelvis.position.x;
    return true;
  }

  if (action === "pose" && POSES[poseName]) {
    puppet.behaviour.mode = "active";
    puppet.behaviour.pose = poseName;
    puppet.behaviour.recoveryElapsed = 0;
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

export function stepPuppetBehaviour(puppet, dtMs) {
  const state = puppet?.behaviour;
  if (!state || state.mode === "limp") return;
  if (state.mode === "recovering") {
    stepRecovery(puppet, dtMs);
    return;
  }
  applyPose(puppet, POSES[state.pose] || POSES.stand);
}

export function serialisePuppetBehaviour(puppet) {
  return {
    mode: puppet?.behaviour?.mode || "limp",
    pose: puppet?.behaviour?.pose || "stand",
  };
}
