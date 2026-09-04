import assert from "node:assert/strict";

function makeBody(x = 0, y = 0) {
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
    angle: 0,
    mass: 1,
    torque: 0,
  };
}

globalThis.Matter = {
  Body: {
    applyForce() {},
    setVelocity(body, velocity) { body.velocity = { ...velocity }; },
    setAngularVelocity(body, velocity) { body.angularVelocity = velocity; },
  },
  Vector: {
    rotate(point, angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
    },
    sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
    magnitude(point) { return Math.hypot(point.x, point.y); },
  },
};

const behaviour = await import("./src/behaviour.js");

const puppet = {
  parts: {
    torso: makeBody(500, 475),
    head: makeBody(500, 410),
    upperArmL: makeBody(463, 458),
    lowerArmL: makeBody(458, 505),
    upperArmR: makeBody(537, 458),
    lowerArmR: makeBody(542, 505),
    upperLegL: makeBody(486, 540),
    lowerLegL: makeBody(486, 593),
    upperLegR: makeBody(514, 540),
    lowerLegR: makeBody(514, 593),
  },
  joints: [],
};

behaviour.initialisePuppetBehaviour(puppet);
behaviour.stepPuppetBehaviour(puppet);
assert.equal(puppet.behaviour.mode, "active");
assert.equal(puppet.behaviour.pose, "stand");

puppet.behaviour.pins.leftHand = { x: -90, y: -40, releasedAt: null };
assert.equal(behaviour.beginPuppetGrab(puppet, 1, "leftHand", { x: 410, y: 435 }), true);
assert.equal(behaviour.endPuppetGrab(puppet, 1), true);
assert.ok(Number.isFinite(puppet.behaviour.pins.leftHand.releasedAt), "released manual placement should start a fade timer");

puppet.behaviour.pins.leftHand.releasedAt = performance.now() - 2500;
behaviour.stepPuppetBehaviour(puppet);
assert.equal(puppet.behaviour.pins.leftHand, null, "released manual placement must not become a permanent pin");

behaviour.setPuppetAction(puppet, "limp");
assert.equal(puppet.behaviour.mode, "limp");
assert.equal(puppet.behaviour.recover, null, "Limp must not invoke Recover");

behaviour.setPuppetAction(puppet, "pose", "stand");
assert.equal(puppet.behaviour.mode, "active");
assert.equal(puppet.behaviour.pose, "stand");
assert.equal(puppet.behaviour.recover, null, "Stand must not secretly invoke Recover");

puppet.behaviour.pins.head = { x: 20, y: 10, releasedAt: null };
behaviour.setPuppetAction(puppet, "recover");
assert.equal(puppet.behaviour.mode, "recovering");
assert.equal(puppet.behaviour.pins.head, null, "Recover should deliberately discard manual placement memory while untangling");

console.log("Hollerday behaviour semantics smoke passed.");
