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
} from "./behaviour.js";
import { createPropSystem, drawProp } from "./props.js";
import { setupCharacterEditor } from "./character-ui.js";
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
const micBtn = document.querySelector("#micBtn");
const specialItemBtn = document.querySelector("#specialItem");
const gripLeftBtn = document.querySelector("#gripLeft");
const gripRightBtn = document.querySelector("#gripRight");
const throwLeftBtn = document.querySelector("#throwLeft");
const throwRightBtn = document.querySelector("#throwRight");
const useItemBtn = document.querySelector("#useItem");

const playerId = getStablePlayerId();
let profile = getLocalProfile(playerId);
const characterEditor = setupCharacterEditor(playerId);
const cameraApi = createCamera(canvas);
window.addEventListener("resize", cameraApi.resize);

let mode = "home";
let roomCode = "";
let transport = null;
let engine = null;
let propSystem = null;
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
let lastPropControlState = "";
let audioContext = null;
let micStream = null;
let micAnalyser = null;
let micTimer = null;
let lastMouthState = -1;
let statusRestoreTimer = null;

function refreshProfile() {
  profile = characterEditor?.getProfile?.() || getLocalProfile(playerId);
  return profile;
}
function setHomeStatus(text) { homeStatus.textContent = text || ""; }
function setConnection(text) { connectionState.textContent = text || ""; }
function normalConnectionText() { return mode === "host" ? "Table open" : mode === "client" ? "Joined" : ""; }
function transientStatus(text) {
  if (!text) return;
  clearTimeout(statusRestoreTimer);
  setConnection(text);
  statusRestoreTimer = setTimeout(() => setConnection(normalConnectionText()), 1600);
}

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

function stopMicrophone() {
  if (micTimer) clearInterval(micTimer);
  micTimer = null;
  micStream?.getTracks?.().forEach(track => track.stop());
  micStream = null;
  micAnalyser = null;
  audioContext?.close?.().catch(() => {});
  audioContext = null;
  lastMouthState = -1;
  if (micBtn) { micBtn.textContent = "Mic"; micBtn.classList.remove("selected"); }
}

function leaveTable() {
  cancelAnimationFrame(rafId);
  stopMicrophone();
  transport?.close();
  transport = null;
  if (engine) Engine.clear(engine);
  propSystem = null;
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
  const bounds = [
    Bodies.rectangle(WORLD.width / 2, WORLD.floorY + floorHeight / 2, WORLD.width + 160, floorHeight, { isStatic: true, friction: .9, restitution: .01 }),
    Bodies.rectangle(WORLD.width / 2, -22, WORLD.width + 160, 44, { isStatic: true, friction: .65 }),
    Bodies.rectangle(-35, WORLD.height / 2, 70, WORLD.height * 2, { isStatic: true }),
    Bodies.rectangle(WORLD.width + 35, WORLD.height / 2, 70, WORLD.height * 2, { isStatic: true }),
  ];
  Composite.add(engine.world, bounds);
  propSystem = createPropSystem(engine, puppets);
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
  return {
    type: "snapshot",
    tick,
    puppets: Array.from(puppets.values(), serializePuppet),
    props: propSystem?.serialize() || [],
  };
}

function syncControls(snapshot) {
  if (!snapshot || !localPuppetId) return;
  const local = snapshot.puppets.find(puppet => puppet.id === localPuppetId);
  if (!local?.behaviour) return;
  const key = `${local.behaviour.mode}:${local.behaviour.pose}`;
  if (key !== lastControlState) {
    lastControlState = key;
    for (const button of puppetControls.querySelectorAll("button[data-action]")) {
      const isPose = button.dataset.action === "pose" && local.behaviour.mode === "active" && button.dataset.pose === local.behaviour.pose;
      const isLimp = button.dataset.action === "limp" && local.behaviour.mode === "limp";
      const isRecover = button.dataset.action === "recover" && local.behaviour.mode === "recovering";
      button.classList.toggle("selected", isPose || isLimp || isRecover);
    }
  }

  const props = Array.isArray(snapshot.props) ? snapshot.props : [];
  const heldLeft = props.find(prop => prop.heldBy?.playerId === playerId && prop.heldBy?.hand === "left");
  const heldRight = props.find(prop => prop.heldBy?.playerId === playerId && prop.heldBy?.hand === "right");
  const specialOut = props.find(prop => prop.special && prop.ownerPlayerId === playerId);
  const propKey = `${heldLeft?.id || "-"}:${heldRight?.id || "-"}:${specialOut?.id || "-"}:${profile.specialItem}`;
  if (propKey !== lastPropControlState) {
    lastPropControlState = propKey;
    if (gripLeftBtn) gripLeftBtn.textContent = heldLeft ? "Drop L" : "Grip L";
    if (gripRightBtn) gripRightBtn.textContent = heldRight ? "Drop R" : "Grip R";
    if (throwLeftBtn) throwLeftBtn.disabled = !heldLeft;
    if (throwRightBtn) throwRightBtn.disabled = !heldRight;
    if (useItemBtn) useItemBtn.disabled = !(heldLeft || heldRight);
    if (specialItemBtn) {
      const labels = { frisbee: "Laser frisbee", pump: "Balloon pump", ball: "Ball", dart: "Sticky darts" };
      const label = labels[profile.specialItem] || "Item";
      specialItemBtn.textContent = specialOut ? `${label} is out` : `Bring out ${label}`;
      specialItemBtn.disabled = !!specialOut;
    }
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

function interpolateProps(previous = [], next = [], t = 1) {
  const oldById = new Map(previous.map(prop => [prop.id, prop]));
  return next.map(prop => {
    const before = oldById.get(prop.id);
    if (!before) return prop;
    return {
      ...prop,
      x: before.x + (prop.x - before.x) * t,
      y: before.y + (prop.y - before.y) * t,
      angle: lerpAngle(before.angle || 0, prop.angle || 0, t),
      depth: (Number(before.depth) || 0) + ((Number(prop.depth) || 0) - (Number(before.depth) || 0)) * t,
    };
  });
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
      const beforeDepth = Number(prev.behaviour?.depth) || 0;
      const nextDepth = Number(next.behaviour?.depth) || 0;
      const behaviour = { ...next.behaviour, depth: beforeDepth + (nextDepth - beforeDepth) * t };
      return { ...next, behaviour, parts };
    }),
    props: interpolateProps(a.props, b.props, t),
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
    const renderables = [
      ...snapshot.puppets.map(puppet => ({ kind: "puppet", depth: Number(puppet.behaviour?.depth) || 0, y: puppet.parts.torso?.y || 0, value: puppet })),
      ...(snapshot.props || []).map(prop => ({ kind: "prop", depth: Number(prop.depth) || 0, y: prop.y || 0, value: prop })),
    ].sort((a, b) => a.depth - b.depth || a.y - b.y);
    for (const item of renderables) {
      if (item.kind === "puppet") drawPuppet(ctx, item.value, cameraApi);
      else drawProp(ctx, item.value, cameraApi);
    }
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
    setPuppetAction(puppet, message.action, message.pose ?? null);
  }
}

function propResultFor(id, result) {
  if (!result) return;
  if (id === playerId && mode === "host") transientStatus(result.message || "Toy updated.");
  const player = players.get(id);
  if (player?.connection) transport?.send(player.connection, { type: "prop-result", ...result });
}

function handlePropIntent(id, message) {
  const player = players.get(id);
  if (!player || !propSystem || !acceptSequence(player, message)) return;
  let result = null;
  if (message.action === "bring-out") result = propSystem.bringOut(id, message.item);
  else if (message.action === "toggle-grip") result = propSystem.toggleGrip(id, message.hand);
  else if (message.action === "throw") result = propSystem.throwHeld(id, message.hand);
  else if (message.action === "use") {
    if (message.hand) result = propSystem.useHeld(id, message.hand);
    else {
      const right = propSystem.useHeld(id, "right");
      result = right.ok ? right : propSystem.useHeld(id, "left");
    }
  }
  propResultFor(id, result);
}

function physicsLoop(now) {
  if (!lastFrame) lastFrame = now;
  accumulator += Math.min(250, now - lastFrame);
  lastFrame = now;
  const stepMs = 1000 / WORLD.physicsHz;
  const snapshotEvery = Math.max(1, Math.round(WORLD.physicsHz / WORLD.snapshotHz));
  while (accumulator >= stepMs) {
    for (const puppet of puppets.values()) stepPuppetBehaviour(puppet);
    propSystem?.step();
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
  profile = refreshProfile();
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
      const puppet = spawnForPlayer(id, message.profile || { id, name: "Puppet", colour: "#315d9b", headStyle: "spikes", eyes: "dots", nose: "curve", mouth: "line", extra: "none", specialItem: "ball" });
      const player = players.get(id);
      player.connection = conn;
      player.connected = true;
      player.lastSeq = -1;
      transport.send(conn, { type: "join:accepted", sessionId: room, playerId: id, puppetId: puppet.id, snapshot: makeSnapshot() });
      return;
    }
    const id = conn.__hollerdayPlayerId;
    if (!id) return;
    if (message.type.startsWith("grab:") || message.type === "action") handleIntent(id, message);
    else if (message.type === "prop") handlePropIntent(id, message);
  });
  transport.onDisconnect(conn => {
    const id = conn.__hollerdayPlayerId;
    if (!id) return;
    releasePlayerGrabs(id);
    propSystem?.releasePlayer(id);
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
  profile = refreshProfile();
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
    else if (message.type === "prop-result") transientStatus(message.message || "Toy updated.");
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

function sendProp(action, extras = {}) {
  if (mode !== "host" && mode !== "client") return;
  const message = { type: "prop", seq: ++inputSeq, action, ...extras };
  if (mode === "host") handlePropIntent(playerId, message);
  else transport?.send(message);
}

async function startMicrophone() {
  if (micStream) {
    stopMicrophone();
    sendAction("mouth", 0);
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(micStream);
    micAnalyser = audioContext.createAnalyser();
    micAnalyser.fftSize = 512;
    micAnalyser.smoothingTimeConstant = .45;
    source.connect(micAnalyser);
    const data = new Uint8Array(micAnalyser.fftSize);
    micTimer = setInterval(() => {
      micAnalyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const n = (value - 128) / 128;
        sum += n * n;
      }
      const rms = Math.sqrt(sum / data.length);
      const state = rms > .085 ? 2 : rms > .025 ? 1 : 0;
      if (state !== lastMouthState) {
        lastMouthState = state;
        sendAction("mouth", state);
      }
    }, 55);
    if (micBtn) { micBtn.textContent = "Mic on"; micBtn.classList.add("selected"); }
  } catch (error) {
    console.error(error);
    setConnection("Microphone permission unavailable");
    stopMicrophone();
  }
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
micBtn?.addEventListener("click", startMicrophone);
specialItemBtn?.addEventListener("click", () => { refreshProfile(); sendProp("bring-out", { item: profile.specialItem }); });
gripLeftBtn?.addEventListener("click", () => sendProp("toggle-grip", { hand: "left" }));
gripRightBtn?.addEventListener("click", () => sendProp("toggle-grip", { hand: "right" }));
throwLeftBtn?.addEventListener("click", () => sendProp("throw", { hand: "left" }));
throwRightBtn?.addEventListener("click", () => sendProp("throw", { hand: "right" }));
useItemBtn?.addEventListener("click", () => sendProp("use"));

startBtn.addEventListener("click", async () => {
  refreshProfile();
  const room = makeRoomCode();
  setHomeStatus("Opening your table…");
  updateUrl(room, true);
  await beginHost(room);
});
joinBtn.addEventListener("click", async () => {
  refreshProfile();
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
if (initialRoom && params.get("host") === "1") {
  beginHost(initialRoom);
} else {
  if (initialRoom) {
    roomInput.value = initialRoom;
    joinBtn.textContent = `Join ${initialRoom}`;
    setHomeStatus("Choose your character, then join the table.");
  }
  render(null);
}
