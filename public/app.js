const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'controller' ? 'controller' : 'stage';
const roomFromUrl = cleanRoom(params.get('room'));

const SLOT_INFO = [
  { name: 'Mara', color: '#cf6c63' },
  { name: 'Ivo', color: '#d0a950' },
  { name: 'Nix', color: '#7089b9' },
  { name: 'Odo', color: '#729d78' },
  { name: 'Vale', color: '#a879b2' },
  { name: 'Pip', color: '#67a7a8' },
];

const POSES = {
  neutral: { uaL: 0.12, faL: 0.05, uaR: -0.12, faR: -0.05, thL: 0.04, shL: 0.02, thR: -0.04, shR: -0.02, torso: 0 },
  point:   { uaL: 1.48, faL: 1.48, uaR: -0.18, faR: -0.08, thL: 0.02, shL: 0, thR: -0.03, shR: 0, torso: -0.05 },
  cheer:   { uaL: 2.55, faL: 2.75, uaR: -2.55, faR: -2.75, thL: 0.08, shL: -0.04, thR: -0.08, shR: 0.04, torso: 0 },
  shrug:   { uaL: 1.02, faL: 1.9, uaR: -1.02, faR: -1.9, thL: 0.03, shL: 0, thR: -0.03, shR: 0, torso: 0 },
  crouch:  { uaL: 0.25, faL: 0.5, uaR: -0.25, faR: -0.5, thL: 0.38, shL: -0.55, thR: -0.38, shR: 0.55, torso: 0.13 },
};

function cleanRoom(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}`;
}

function send(ws, payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDelta(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

if (mode === 'controller') {
  startController(roomFromUrl);
} else {
  startStage(roomFromUrl || newRoomCode());
}

function startStage(room) {
  if (!window.Matter) {
    app.textContent = 'Matter.js failed to load.';
    return;
  }

  const url = new URL(location.href);
  url.searchParams.delete('mode');
  url.searchParams.set('room', room);
  history.replaceState(null, '', url);
  const joinUrl = `${location.origin}/?mode=controller&room=${room}`;

  app.innerHTML = `
    <section class="stage-shell">
      <div class="stage-topbar">
        <div class="brand">
          <strong>Puppetalk</strong>
          <div class="small muted" id="stage-status">opening stage…</div>
        </div>
        <div class="join-card">
          <div class="small muted">JOIN ROOM</div>
          <div class="room-code">${room}</div>
          <div class="small muted join-link">${joinUrl}</div>
        </div>
      </div>
      <canvas id="stage-canvas" aria-label="Puppetalk ensemble stage"></canvas>
    </section>`;

  const canvas = app.querySelector('#stage-canvas');
  const status = app.querySelector('#stage-status');
  const ctx = canvas.getContext('2d');
  const { Engine, Bodies, Body, Composite, Constraint, Vector } = Matter;
  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 1.05;
  engine.gravity.scale = 0.001;

  const puppets = new Map();
  let stageBounds = [];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let last = performance.now();

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    Composite.remove(engine.world, stageBounds);
    const floorY = height - 30;
    stageBounds = [
      Bodies.rectangle(width / 2, floorY + 30, width + 160, 60, { isStatic: true, friction: 0.9 }),
      Bodies.rectangle(-30, height / 2, 60, height * 2, { isStatic: true }),
      Bodies.rectangle(width + 30, height / 2, 60, height * 2, { isStatic: true }),
    ];
    Composite.add(engine.world, stageBounds);

    for (const puppet of puppets.values()) {
      const x = clamp(puppet.target.x * width, 80, width - 80);
      const y = clamp(puppet.target.y * height, 130, height - 90);
      puppet.targetPx.x = x;
      puppet.targetPx.y = y;
    }
  }

  function joint(bodyA, pointA, bodyB, pointB, stiffness = 0.92) {
    return Constraint.create({ bodyA, pointA, bodyB, pointB, length: 1, stiffness, damping: 0.13 });
  }

  function createPuppet(slot, controllerName) {
    if (puppets.has(slot)) return puppets.get(slot);
    const info = SLOT_INFO[slot] || { name: `Puppet ${slot + 1}`, color: '#aaa' };
    const x = width * (0.16 + slot * 0.135);
    const y = Math.min(height - 170, height * 0.62);
    const group = Body.nextGroup(true);
    const common = { collisionFilter: { group }, frictionAir: 0.04, restitution: 0.08, friction: 0.8 };

    const torso = Bodies.rectangle(x, y, 48, 78, { ...common, chamfer: { radius: 13 }, density: 0.0022 });
    const head = Bodies.circle(x, y - 65, 26, { ...common, density: 0.0018 });
    const uaL = Bodies.rectangle(x - 37, y - 17, 16, 52, { ...common, density: 0.0013 });
    const faL = Bodies.rectangle(x - 42, y + 30, 15, 49, { ...common, density: 0.0011 });
    const uaR = Bodies.rectangle(x + 37, y - 17, 16, 52, { ...common, density: 0.0013 });
    const faR = Bodies.rectangle(x + 42, y + 30, 15, 49, { ...common, density: 0.0011 });
    const thL = Bodies.rectangle(x - 14, y + 65, 19, 58, { ...common, density: 0.0017 });
    const shL = Bodies.rectangle(x - 14, y + 118, 17, 54, { ...common, density: 0.0015 });
    const thR = Bodies.rectangle(x + 14, y + 65, 19, 58, { ...common, density: 0.0017 });
    const shR = Bodies.rectangle(x + 14, y + 118, 17, 54, { ...common, density: 0.0015 });

    const constraints = [
      joint(torso, { x: 0, y: -39 }, head, { x: 0, y: 24 }, 0.96),
      joint(torso, { x: -24, y: -27 }, uaL, { x: 0, y: -25 }, 0.97),
      joint(uaL, { x: 0, y: 25 }, faL, { x: 0, y: -23 }, 0.97),
      joint(torso, { x: 24, y: -27 }, uaR, { x: 0, y: -25 }, 0.97),
      joint(uaR, { x: 0, y: 25 }, faR, { x: 0, y: -23 }, 0.97),
      joint(torso, { x: -14, y: 38 }, thL, { x: 0, y: -27 }, 0.97),
      joint(thL, { x: 0, y: 27 }, shL, { x: 0, y: -25 }, 0.97),
      joint(torso, { x: 14, y: 38 }, thR, { x: 0, y: -27 }, 0.97),
      joint(thR, { x: 0, y: 27 }, shR, { x: 0, y: -25 }, 0.97),
    ];

    const puppet = {
      slot,
      name: controllerName || info.name,
      color: info.color,
      torso, head, uaL, faL, uaR, faR, thL, shL, thR, shR,
      constraints,
      bodies: [torso, head, uaL, faL, uaR, faR, thL, shL, thR, shR],
      target: { x: x / width, y: y / height },
      targetPx: { x, y },
      pose: 'neutral',
      ragdoll: false,
      mouth: 0,
      facing: 1,
      connected: true,
    };

    Composite.add(engine.world, [...puppet.bodies, ...constraints]);
    puppets.set(slot, puppet);
    return puppet;
  }

  function removePuppet(slot) {
    const puppet = puppets.get(slot);
    if (!puppet) return;
    Composite.remove(engine.world, [...puppet.bodies, ...puppet.constraints]);
    puppets.delete(slot);
  }

  function servo(body, targetAngle, strength = 0.006) {
    const diff = angleDelta(targetAngle, body.angle);
    const torque = clamp(diff * strength - body.angularVelocity * strength * 0.72, -0.028, 0.028);
    body.torque += torque;
  }

  function drivePuppet(puppet) {
    const t = puppet.torso;
    puppet.targetPx.x = clamp(puppet.target.x * width, 70, width - 70);
    puppet.targetPx.y = clamp(puppet.target.y * height, 120, height - 86);
    const dx = puppet.targetPx.x - t.position.x;
    const dy = puppet.targetPx.y - t.position.y;
    const pull = puppet.ragdoll ? 0.000055 : 0.000075;
    Body.applyForce(t, t.position, {
      x: dx * pull - t.velocity.x * 0.0024,
      y: dy * pull - t.velocity.y * 0.0024,
    });

    if (puppet.ragdoll) return;
    const pose = POSES[puppet.pose] || POSES.neutral;
    const base = pose.torso;
    servo(t, base, 0.008);
    servo(puppet.head, base * 0.35, 0.0045);
    servo(puppet.uaL, base + pose.uaL, 0.006);
    servo(puppet.faL, base + pose.faL, 0.005);
    servo(puppet.uaR, base + pose.uaR, 0.006);
    servo(puppet.faR, base + pose.faR, 0.005);
    servo(puppet.thL, base + pose.thL, 0.006);
    servo(puppet.shL, base + pose.shL, 0.005);
    servo(puppet.thR, base + pose.thR, 0.006);
    servo(puppet.shR, base + pose.shR, 0.005);
  }

  function wp(body, local) {
    const p = Vector.rotate(local, body.angle);
    return { x: body.position.x + p.x, y: body.position.y + p.y };
  }

  function strokeChain(points, color, widthPx) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#08090a';
    ctx.lineWidth = widthPx + 6;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.stroke();
  }

  function drawRotatedRect(body, w, h, color, radius = 10) {
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.fillStyle = '#08090a';
    roundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, radius + 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(-w / 2, -h / 2, w, h, radius);
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rr);
  }

  function drawPuppet(puppet) {
    const c = puppet.color;
    const torso = puppet.torso;
    const shoulderL = wp(torso, { x: -24, y: -27 });
    const shoulderR = wp(torso, { x: 24, y: -27 });
    const elbowL = wp(puppet.uaL, { x: 0, y: 25 });
    const elbowR = wp(puppet.uaR, { x: 0, y: 25 });
    const wristL = wp(puppet.faL, { x: 0, y: 23 });
    const wristR = wp(puppet.faR, { x: 0, y: 23 });
    const hipL = wp(torso, { x: -14, y: 38 });
    const hipR = wp(torso, { x: 14, y: 38 });
    const kneeL = wp(puppet.thL, { x: 0, y: 27 });
    const kneeR = wp(puppet.thR, { x: 0, y: 27 });
    const ankleL = wp(puppet.shL, { x: 0, y: 25 });
    const ankleR = wp(puppet.shR, { x: 0, y: 25 });

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(torso.position.x, height - 38, 48, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    strokeChain([hipL, kneeL, ankleL], c, 17);
    strokeChain([hipR, kneeR, ankleR], c, 17);
    strokeChain([shoulderL, elbowL, wristL], c, 15);
    strokeChain([shoulderR, elbowR, wristR], c, 15);
    drawRotatedRect(torso, 48, 78, c, 13);

    ctx.save();
    ctx.translate(puppet.head.position.x, puppet.head.position.y);
    ctx.rotate(puppet.head.angle);
    ctx.fillStyle = '#08090a';
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#08090a';
    ctx.beginPath();
    ctx.arc(-8, -5, 2.7, 0, Math.PI * 2);
    ctx.arc(8, -5, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    if (puppet.mouth === 0) {
      ctx.roundRect(-7, 9, 14, 3, 2);
    } else if (puppet.mouth === 1) {
      ctx.roundRect(-7, 6, 14, 10, 5);
    } else {
      ctx.ellipse(0, 10, 9, 11, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.fillText(puppet.name, puppet.head.position.x, puppet.head.position.y - 40);
    ctx.restore();
  }

  function drawStage() {
    ctx.clearRect(0, 0, width, height);
    const g = ctx.createRadialGradient(width / 2, height * 0.72, 10, width / 2, height * 0.72, Math.max(width, height) * 0.8);
    g.addColorStop(0, '#292b30');
    g.addColorStop(0.48, '#17191c');
    g.addColorStop(1, '#0c0d0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const floorY = height - 30;
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let x = -width; x < width * 2; x += 74) {
      ctx.beginPath();
      ctx.moveTo(width / 2 + (x - width / 2) * 0.22, height * 0.66);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }
    for (let y = height * 0.7; y < floorY; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (const puppet of puppets.values()) drawPuppet(puppet);
  }

  function tick(now) {
    const dt = clamp(now - last, 8, 25);
    last = now;
    for (const puppet of puppets.values()) drivePuppet(puppet);
    Engine.update(engine, dt);
    drawStage();
    requestAnimationFrame(tick);
  }

  const ws = new WebSocket(socketUrl());
  ws.addEventListener('open', () => {
    status.textContent = 'stage live — waiting for puppeteers';
    send(ws, { type: 'hello', role: 'stage', room });
  });
  ws.addEventListener('close', () => { status.textContent = 'stage disconnected'; });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome-stage') {
      for (const controller of message.controllers) createPuppet(controller.slot, controller.name);
      status.textContent = `${message.controllers.length} puppeteer${message.controllers.length === 1 ? '' : 's'} connected`;
    }
    if (message.type === 'controller-joined') {
      createPuppet(message.slot, message.name);
      status.textContent = `${puppets.size} puppeteer${puppets.size === 1 ? '' : 's'} connected`;
    }
    if (message.type === 'controller-left') {
      removePuppet(message.slot);
      status.textContent = `${puppets.size} puppeteer${puppets.size === 1 ? '' : 's'} connected`;
    }
    if (message.type === 'input') {
      const puppet = puppets.get(message.slot) || createPuppet(message.slot);
      const input = message.input || {};
      if (Number.isFinite(input.x)) puppet.target.x = clamp(input.x, 0.04, 0.96);
      if (Number.isFinite(input.y)) puppet.target.y = clamp(input.y, 0.18, 0.9);
      if (typeof input.pose === 'string' && POSES[input.pose]) puppet.pose = input.pose;
      if (typeof input.ragdoll === 'boolean') puppet.ragdoll = input.ragdoll;
      if (Number.isInteger(input.mouth)) puppet.mouth = clamp(input.mouth, 0, 2);
      if (input.facing === -1 || input.facing === 1) puppet.facing = input.facing;
    }
  });

  addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(tick);
}

function startController(room) {
  if (!room) {
    app.innerHTML = `
      <section class="join-form">
        <form class="join-panel card" id="join-form">
          <div><strong>Puppetalk</strong><div class="muted small">Join a stage</div></div>
          <label>Room code<input id="room-input" autocomplete="off" inputmode="text" maxlength="8" placeholder="ABCDE" required /></label>
          <button class="primary" type="submit">Join</button>
        </form>
      </section>`;
    app.querySelector('#join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const next = cleanRoom(app.querySelector('#room-input').value);
      if (!next) return;
      const url = new URL(location.href);
      url.searchParams.set('mode', 'controller');
      url.searchParams.set('room', next);
      location.href = url;
    });
    return;
  }

  app.innerHTML = `
    <section class="shell controller-shell">
      <header class="controller-head">
        <div><strong>Puppetalk</strong><div class="small muted">room ${room}</div></div>
        <div class="small"><span class="status-dot" id="status-dot"></span><span id="status-text">connecting</span></div>
      </header>

      <div class="move-pad" id="move-pad" aria-label="Puppet movement pad">
        <span class="pad-label">drag your puppet</span><span class="pad-nub" id="pad-nub"></span>
      </div>

      <section class="card grid">
        <div class="small muted">POSE</div>
        <div class="grid pose-grid" id="pose-grid">
          <button class="active" data-pose="neutral">Stand</button>
          <button data-pose="point">Point</button>
          <button data-pose="cheer">Cheer</button>
          <button data-pose="shrug">Shrug</button>
          <button data-pose="crouch">Crouch</button>
          <button data-ragdoll>Go limp</button>
        </div>
      </section>

      <section class="card voice-card">
        <div><strong>Voice mouth</strong><div class="small muted">Your microphone is analysed on this phone. Audio is not sent to the stage.</div></div>
        <div class="voice-meter"><span id="voice-level"></span></div>
        <button class="primary" id="voice-button">Enable microphone</button>
        <button id="talk-button">Hold to talk manually</button>
      </section>

      <section class="card grid action-grid">
        <button data-facing="-1">Face left</button>
        <button id="centre-button">Centre</button>
        <button data-facing="1">Face right</button>
      </section>
    </section>`;

  const statusDot = app.querySelector('#status-dot');
  const statusText = app.querySelector('#status-text');
  const movePad = app.querySelector('#move-pad');
  const nub = app.querySelector('#pad-nub');
  const voiceButton = app.querySelector('#voice-button');
  const voiceLevel = app.querySelector('#voice-level');
  const talkButton = app.querySelector('#talk-button');
  let ws;
  let slot = null;
  let input = { x: 0.5, y: 0.55, pose: 'neutral', ragdoll: false, mouth: 0, facing: 1 };
  let lastSent = '';
  let micStop = null;

  function transmit(force = false) {
    const body = JSON.stringify(input);
    if (!force && body === lastSent) return;
    lastSent = body;
    send(ws, { type: 'input', input });
  }

  function setStatus(text, state = '') {
    statusText.textContent = text;
    statusDot.className = `status-dot ${state}`;
  }

  ws = new WebSocket(socketUrl());
  ws.addEventListener('open', () => {
    setStatus('joining…');
    send(ws, { type: 'hello', role: 'controller', room });
  });
  ws.addEventListener('close', () => setStatus('disconnected', 'bad'));
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome-controller') {
      slot = message.slot;
      const info = SLOT_INFO[slot] || {};
      setStatus(`you are ${info.name || message.name}`, 'live');
      transmit(true);
    }
    if (message.type === 'room-full') setStatus('room is full', 'bad');
    if (message.type === 'error') setStatus(message.message || 'connection error', 'bad');
  });

  let padActive = false;
  function movePointer(event) {
    if (!padActive) return;
    const r = movePad.getBoundingClientRect();
    const x = clamp((event.clientX - r.left) / r.width, 0, 1);
    const y = clamp((event.clientY - r.top) / r.height, 0, 1);
    nub.style.left = `${x * 100}%`;
    nub.style.top = `${y * 100}%`;
    input.x = 0.05 + x * 0.9;
    input.y = 0.22 + y * 0.66;
    transmit();
  }
  movePad.addEventListener('pointerdown', (event) => {
    padActive = true;
    movePad.setPointerCapture(event.pointerId);
    movePointer(event);
  });
  movePad.addEventListener('pointermove', movePointer);
  movePad.addEventListener('pointerup', () => { padActive = false; });
  movePad.addEventListener('pointercancel', () => { padActive = false; });

  app.querySelector('#pose-grid').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.pose) {
      input.pose = button.dataset.pose;
      input.ragdoll = false;
      app.querySelectorAll('[data-pose]').forEach((b) => b.classList.toggle('active', b === button));
      const rag = app.querySelector('[data-ragdoll]');
      rag.classList.remove('active');
      rag.textContent = 'Go limp';
      transmit(true);
    }
    if (button.hasAttribute('data-ragdoll')) {
      input.ragdoll = !input.ragdoll;
      button.classList.toggle('active', input.ragdoll);
      button.textContent = input.ragdoll ? 'Recover' : 'Go limp';
      transmit(true);
    }
  });

  app.querySelectorAll('[data-facing]').forEach((button) => {
    button.addEventListener('click', () => {
      input.facing = Number(button.dataset.facing);
      transmit(true);
    });
  });

  app.querySelector('#centre-button').addEventListener('click', () => {
    input.x = 0.5;
    input.y = 0.55;
    nub.style.left = '50%';
    nub.style.top = '50%';
    transmit(true);
  });

  async function enableMic() {
    if (micStop) {
      micStop();
      micStop = null;
      voiceButton.textContent = 'Enable microphone';
      input.mouth = 0;
      voiceLevel.style.width = '0%';
      transmit(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audio = new AudioContext();
      const source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.46;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let lastMouth = -1;
      let lastUpdate = 0;

      const sample = (now) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const n = (value - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / data.length);
        const display = clamp(rms * 540, 0, 100);
        voiceLevel.style.width = `${display}%`;
        let mouth = 0;
        if (rms > 0.028) mouth = rms > 0.105 ? 2 : 1;
        if (mouth !== lastMouth && now - lastUpdate > 45) {
          input.mouth = mouth;
          lastMouth = mouth;
          lastUpdate = now;
          transmit(true);
        }
        raf = requestAnimationFrame(sample);
      };
      raf = requestAnimationFrame(sample);
      micStop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((track) => track.stop());
        audio.close();
      };
      voiceButton.textContent = 'Disable microphone';
    } catch (error) {
      setStatus('microphone unavailable', 'bad');
      console.error(error);
    }
  }
  voiceButton.addEventListener('click', enableMic);

  function manualTalk(on) {
    input.mouth = on ? 2 : 0;
    talkButton.classList.toggle('active', on);
    transmit(true);
  }
  talkButton.addEventListener('pointerdown', (event) => { event.preventDefault(); manualTalk(true); });
  talkButton.addEventListener('pointerup', () => manualTalk(false));
  talkButton.addEventListener('pointercancel', () => manualTalk(false));
  talkButton.addEventListener('pointerleave', (event) => { if (event.buttons) manualTalk(false); });
}
