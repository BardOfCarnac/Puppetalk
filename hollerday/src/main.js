import { WORLD, makeRoomCode, normaliseRoomCode, getStablePlayerId, getLocalProfile } from "./config.js";
import { createCamera } from "./camera.js";
import { createPuppet, serializePuppet, findGrabBody, drawPuppet } from "./rig.js";
import {
  setPuppetAction,
  beginPuppetGrab,
  movePuppetGrab,
  endPuppetGrab,
  stepPuppetBehaviour,
  stabilisePuppet,
} from "./behaviour-port.js";
import { HostTransport, ClientTransport } from "./network.js";

const { Engine, Bodies, Composite } = Matter;

const home = document.querySelector("#home");
const table = document.querySelector("#table");
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const startBtn = document.querySelector("#startBtn");
const joinBtn = document.querySelector("#joinBtn");
const roomInput = document.querySelector("#roomInput");
const homeStatus = document.querySelector("#homeStatus");
const roomBadge = document.querySelector("#roomBadge");
const connectionState = document.querySelector("#connectionState");
const leaveBtn = document.querySelector("#leaveBtn");
const puppetControls = document.querySelector("#puppetControls");

const playerId = getStablePlayerId();
const profile = getLocalProfile(playerId);
const cameraApi = createCamera(canvas);
window.addEventListener("resize", cameraApi.resize);

let mode = "home";
let roomCode = "";
let transport = null;
let engine = null;
let puppets = new Map();
let players = new Map();
let grabs = new Map();
let latestSnapshot = null;
let snapshotBuffer = [];
let localPuppetId = null;
let rafId = 0;
let lastFrame = 0;
let accumulator = 0;
let tick = 0;
let inputSeq = 0;
let lastControlState = "";

function setHomeStatus(text) { homeStatus.textContent = text || ""; }
function setConnection(text) { connectionState.textContent = text || ""; }

function showTable(room) {
  roomCode = room;
  home.classList.add("hidden");
  table.classList.remove("hidden");
  roomBadge.textContent = `TABLE ${room}`;
  cameraApi.resize();
}

function updateUrl(room, isHost) {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("room", room);
  if (isHost) url.searchParams.set("host", "1");
  history.replaceState(null, "", url);
}

function leaveTable() {
  cancelAnimationFrame(rafId);
  transport?.close();
  transport = null;
  if (engine) Engine.clear(engine);
  const url = new URL(location.href);
  url.search = "";
  location.href = url.toString();
}

function createPhysicsWorld() {
  engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 1.05;
  engine.gravity.scale = .001;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.constraintIterations = 4;

  const floorHeight = 90;
  const floor = Bodies.rectangle(
    WORLD.width / 2,
    WORLD.floorY + floorHeight / 2,
    WORLD.width + 160,
    floorHeight,
    { isStatic: true, friction: .9, restitution: .01 }
  );
  const leftWall = Bodies.rectangle(-35, WORLD.height / 2, 70, WORLD.height * 2, { isStatic: true });
  const rightWall = Bodies.rectangle(WORLD.width + 35, WORLD.height / 2, 70, WORLD.height * 2, { isStatic: true });
  Composite.add(engine.world, [floor, leftWall, rightWall]);
}

function spawnForPlayer(id, playerProfile) {
  const existing = players.get(id);
  if (existing?.puppetId && puppets.has(existing.puppetId)) return puppets.get(existing.puppetId);

  const index = puppets.size;
  const slots = [500, 360, 640, 240, 760, 120, 880];
  const puppetId = `puppet-${id}`;
  const puppet = createPuppet(engine.world, {
    id: puppetId,
    ownerPlayerId: id,
    profile: playerProfile,
    x: slots[index % slots.length],
    y: WORLD.floorY - 145,
  });
  puppets.set(puppetId, puppet);
  players.set(id, { playerId: id, puppetId, connected: true, connection: null, lastSeq: -1 });
  return puppet;
}

function makeSnapshot() {
  return { type: "snapshot", tick, puppets: Array.from(puppets.values(), serializePuppet) };
}

function syncControls(snapshot) {
  if (!snapshot || !localPuppetId) return;
  const local = snapshot.puppets.find(puppet => puppet.id === localPuppetId);
  if (!local?.behaviour) return;
  const key = `${local.behaviour.mode}:${local.behaviour.pose}`;
  if (key === lastControlState) return;
  lastControlState = key;
  for (const button of puppetControls.querySelectorAll("button")) {
    const isPose = button.dataset.action === "pose" && local.behaviour.mode === "active" && button.dataset.pose === local.behaviour.pose;
    const isLimp = button.dataset.action === "limp" && local.behaviour.mode === "limp";
    const isRecover = button.dataset.action === "recover" && local.behaviour.mode === "recovering";
    button.classList.toggle("selected", isPose || isLimp || isRecover);
  }
}

function pushSnapshot(snapshot) {
  latestSnapshot = snapshot;
  snapshotBuffer.push({ at: performance.now(), snapshot });
  if (snapshotBuffer.length > 12) snapshotBuffer.splice(0, snapshotBuffer.length - 12);
  syncControls(snapshot);
}

function lerpAngle(a, b, t) {
  const d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function interpolateSnapshots(a, b, t) {
  const oldById = new Map(a.puppets.map(p => [p.id, p]));
  return {
    type: "snapshot",
    tick: b.tick,
    puppets: b.puppets.map(next => {
      const prev = oldById.get(next.id);
      if (!prev) return next;
      const parts = {};
      for (const [name, state] of Object.entries(next.parts)) {
        const before = prev.parts[name] || state;
        parts[name] = {
          x: before.x + (state.x - before.x) * t,
          y: before.y + (state.y - before.y) * t,
          angle: lerpAngle(before.angle, state.angle, t),
        };
      }
      return { ...next, parts };
    }),
  };
}

function snapshotForRender() {
  if (mode === "host") return makeSnapshot();
  if (!snapshotBuffer.length) return null;
  if (snapshotBuffer.length === 1) return snapshotBuffer[0].snapshot;
  const target = performance.now() - WORLD.interpolationMs;
  let before = snapshotBuffer[0];
  let after = snapshotBuffer[snapshotBuffer.length - 1];
  for (let i = 1; i < snapshotBuffer.length; i += 1) {
    if (snapshotBuffer[i].at >= target) {
      before = snapshotBuffer[i - 1];
      after = snapshotBuffer[i];
      break;
    }
  }
  if (after.at <= before.at) return after.snapshot;
  const t = Math.max(0, Math.min(1, (target - before.at) / (after.at - before.at)));
  return interpolateSnapshots(before.snapshot, after.snapshot, t);
}

function render(snapshot) {
  const { camera, worldToScreen } = cameraApi;
  ctx.setTransform(camera.dpr, 0, 0, camera.dpr, 0, 0);
  ctx.clearRect(0, 0, camera.cssWidth, camera.cssHeight);
  ctx.fillStyle = "#d9a13c";
  ctx.fillRect(0, 0, camera.cssWidth, camera.cssHeight);
  const topLeft = worldToScreen(0, 0);
  const bottomRight = worldToScreen(WORLD.width, WORLD.height);
  ctx.fillStyle = "#f7e7b8";
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  const horizon = worldToScreen(0, WORLD.floorY);
  ctx.fillStyle = "#d7bd7f";
  ctx.fillRect(topLeft.x, horizon.y, bottomRight.x - topLeft.x, bottomRight.y - horizon.y);
  ctx.strokeStyle = "#1d1711";
  ctx.lineWidth = Math.max(1.5, 3 * camera.scale);
  ctx.beginPath();
  ctx.moveTo(topLeft.x, horizon.y);
  ctx.lineTo(bottomRight.x, horizon.y);
  ctx.stroke();
  if (snapshot) {
    const ordered = [...snapshot.puppets].sort((a, b) => (a.parts.torso?.y || 0) - (b.parts.torso?.y || 0));
    for (const puppet of ordered) drawPuppet(ctx, puppet, cameraApi);
  }
}

function renderLoop() {
  render(snapshotForRender());
  rafId = requestAnimationFrame(renderLoop);
}

function releaseGrab(key) {
  const grab = grabs.get(key);
  if (!grab) return;
  endPuppetGrab(grab.puppet, grab.pointerId);
  grabs.delete(key);
}

function releasePlayerGrabs(id) {
  for (const key of [...grabs.keys()]) if (key.startsWith(`${id}:`)) releaseGrab(key);
}

function clampPoint(payload) {
  return {
    x: Math.max(0, Math.min(WORLD.width, Number(payload.x) || 0)),
    y: Math.max(0, Math.min(WORLD.height, Number(payload.y) || 0)),
  };
}

function acceptSequence(player, message) {
  const seq = Number(message.seq);
  if (!Number.isFinite(seq)) return true;
  if (seq <= player.lastSeq) return false;
  player.lastSeq = seq;
  return true;
}

function handleIntent(id, message) {
  const player = players.get(id);
  const puppet = player ? puppets.get(player.puppetId) : null;
  if (!puppet || !engine || !acceptSequence(player, message)) return;
  const key = `${id}:${message.pointerId}`;

  if (message.type === "grab:start") {
    releaseGrab(key);
    const point = clampPoint(message);
    const hit = findGrabBody(puppet, point);
    if (!hit) return;
    if (!beginPuppetGrab(puppet, message.pointerId, hit.name, point)) return;
    grabs.set(key, { puppet, pointerId: message.pointerId, partName: hit.name });
  } else if (message.type === "grab:move") {
    const grab = grabs.get(key);
    if (grab) movePuppetGrab(grab.puppet, grab.pointerId, clampPoint(message));
  } else if (message.type === "grab:end") {
    releaseGrab(key);
  } else if (message.type === "action") {
    setPuppetAction(puppet, message.action, message.pose || null);
  }
}

function physicsLoop(now) {
  if (!lastFrame) lastFrame = now;
  accumulator += Math.min(250, now - lastFrame);
  lastFrame = now;
  const stepMs = 1000 / WORLD.physicsHz;
  const snapshotEvery = Math.max(1, Math.round(WORLD.physicsHz / WORLD.snapshotHz));
  while (accumulator >= stepMs) {
    for (const puppet of puppets.values()) stepPuppetBehaviour(puppet);
    Engine.update(engine, Math.min(stepMs, 1000 / 60));
    for (const puppet of puppets.values()) stabilisePuppet(puppet);
    tick += 1;
    accumulator -= stepMs;
    if (tick % snapshotEvery === 0) {
      const snapshot = makeSnapshot();
      pushSnapshot(snapshot);
      transport?.broadcast(snapshot);
    }
  }
  const liveSnapshot = snapshotForRender();
  syncControls(liveSnapshot);
  render(liveSnapshot);
  rafId = requestAnimationFrame(physicsLoop);
}

async function beginHost(room) {
  mode = "host";
  showTable(room);
  setConnection("Opening table…");
  createPhysicsWorld();
  const hostPuppet = spawnForPlayer(playerId, profile);
  localPuppetId = hostPuppet.id;
  transport = new HostTransport(room);
  transport.onMessage((message, conn) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "join") {
      const id = String(message.playerId || "");
      if (!id) return;
      conn.__hollerdayPlayerId = id;
      const puppet = spawnForPlayer(id, message.profile || { id, name: "Puppet", colour: "#315d9b" });
      const player = players.get(id);
      player.connection = conn;
      player.connected = true;
      player.lastSeq = -1;
      transport.send(conn, { type: "join:accepted", sessionId: room, playerId: id, puppetId: puppet.id, snapshot: makeSnapshot() });
      return;
    }
    const id = conn.__hollerdayPlayerId;
    if (id && (message.type.startsWith("grab:") || message.type === "action")) handleIntent(id, message);
  });
  transport.onDisconnect(conn => {
    const id = conn.__hollerdayPlayerId;
    if (!id) return;
    releasePlayerGrabs(id);
    const player = players.get(id);
    if (player) player.connected = false;
  });
  try {
    await transport.open();
    setConnection("Table open");
    pushSnapshot(makeSnapshot());
    lastFrame = performance.now();
    rafId = requestAnimationFrame(physicsLoop);
  } catch (error) {
    console.error(error);
    setConnection("Could not open this table");
  }
}

async function beginClient(room) {
  mode = "client";
  showTable(room);
  setConnection("Finding table…");
  transport = new ClientTransport(room);
  transport.onMessage(message => {
    if (!message) return;
    if (message.type === "join:accepted") {
      localPuppetId = message.puppetId;
      if (message.snapshot) pushSnapshot(message.snapshot);
      setConnection("Joined");
    } else if (message.type === "snapshot") pushSnapshot(message);
  });
  transport.onClose(() => setConnection("Connection lost"));
  try {
    await transport.open();
    transport.send({ type: "join", playerId, profile });
    rafId = requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error(error);
    setConnection("Table not found");
  }
}

function sendGrab(type, event) {
  if (mode !== "host" && mode !== "client") return;
  const rect = canvas.getBoundingClientRect();
  const point = cameraApi.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  const message = { type, seq: ++inputSeq, pointerId: event.pointerId, x: point.x, y: point.y };
  if (mode === "host") handleIntent(playerId, message);
  else transport?.send(message);
}

function sendAction(action, pose = null) {
  if (mode !== "host" && mode !== "client") return;
  const message = { type: "action", seq: ++inputSeq, action, pose };
  if (mode === "host") handleIntent(playerId, message);
  else transport?.send(message);
}

canvas.addEventListener("pointerdown", event => {
  canvas.setPointerCapture(event.pointerId);
  sendGrab("grab:start", event);
});
canvas.addEventListener("pointermove", event => {
  if (canvas.hasPointerCapture(event.pointerId)) sendGrab("grab:move", event);
});
for (const type of ["pointerup", "pointercancel"]) {
  canvas.addEventListener(type, event => {
    sendGrab("grab:end", event);
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  });
}

puppetControls.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) sendAction(button.dataset.action, button.dataset.pose || null);
});

startBtn.addEventListener("click", async () => {
  const room = makeRoomCode();
  setHomeStatus("Opening your table…");
  updateUrl(room, true);
  await beginHost(room);
});
joinBtn.addEventListener("click", async () => {
  const room = normaliseRoomCode(roomInput.value);
  if (!room) {
    setHomeStatus("Enter a table code first.");
    roomInput.focus();
    return;
  }
  updateUrl(room, false);
  await beginClient(room);
});
roomInput.addEventListener("input", () => { roomInput.value = normaliseRoomCode(roomInput.value); });
roomInput.addEventListener("keydown", event => { if (event.key === "Enter") joinBtn.click(); });
leaveBtn.addEventListener("click", leaveTable);
roomBadge.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    const old = roomBadge.textContent;
    roomBadge.textContent = "COPIED";
    setTimeout(() => { roomBadge.textContent = old; }, 900);
  } catch {}
});

const params = new URLSearchParams(location.search);
const initialRoom = normaliseRoomCode(params.get("room") || "");
if (initialRoom) {
  if (params.get("host") === "1") beginHost(initialRoom);
  else beginClient(initialRoom);
} else render(null);
