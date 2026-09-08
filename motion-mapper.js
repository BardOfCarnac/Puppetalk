// Puppetalk movement mapper.
// Diagnostic only: records local touch/input paths and the resulting head/chest/hips/feet
// positions for the controller's own puppet. Nothing is uploaded; Copy trace puts a compact
// JSON trace on the clipboard so it can be pasted into a debugging conversation.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('mode') !== 'controller' || !window.Peer || window.PuppetalkMotionMapper) return;

  const Peer = window.Peer;
  const rawConnect = Peer.prototype.connect;
  const TRACE_MS = 12000;
  const MAX_INPUTS = 360;
  const MAX_FRAMES = 240;
  const MAX_TOUCHES = 360;

  let slot = null;
  let recording = false;
  let startedAt = 0;
  let latestInput = null;
  let latestFrame = null;
  let panel = null;
  let plot = null;
  let ctx = null;
  let status = null;
  let mapButton = null;
  const inputs = [];
  const frames = [];
  const touches = [];

  const round = value => Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
  const nowMs = () => performance.now();

  function compactPoint(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { x: round(point.x), y: round(point.y) };
  }

  function midpoint(a, b) {
    if (!a || !b) return null;
    return compactPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }

  function trim(list, max) {
    while (list.length > max) list.shift();
    const cutoff = nowMs() - TRACE_MS;
    while (list.length && list[0].at < cutoff) list.shift();
  }

  function normalizedGrabs(input) {
    if (Array.isArray(input?.grabs)) {
      return input.grabs
        .filter(grab => grab && typeof grab.part === 'string')
        .map(grab => ({ part: grab.part, x: round(grab.x), y: round(grab.y) }));
    }
    if (input?.grabbing && input?.grabPart) {
      return [{ part: input.grabPart, x: round(input.x), y: round(input.y) }];
    }
    return [];
  }

  function observeInput(input) {
    latestInput = input || null;
    if (!recording || !input) return;
    const grabs = normalizedGrabs(input);
    inputs.push({
      at: nowMs(),
      t: round(nowMs() - startedAt),
      grabs,
      pose: input.pose || null,
      rag: !!input.rag
    });
    trim(inputs, MAX_INPUTS);
  }

  function ownPuppet(scene) {
    if (!Array.isArray(scene?.puppets)) return null;
    if (Number.isInteger(slot)) return scene.puppets.find(puppet => puppet?.slot === slot) || null;
    return scene.puppets.length === 1 ? scene.puppets[0] : null;
  }

  function frameFromPuppet(puppet) {
    if (!puppet) return null;
    const head = compactPoint(puppet.head);
    const chest = compactPoint(puppet.torso);
    const hips = midpoint(puppet.hl, puppet.hr);
    const feet = midpoint(puppet.al, puppet.ar);
    return {
      at: nowMs(),
      t: round(nowMs() - startedAt),
      head,
      chest,
      hips,
      feet,
      headAngle: round(puppet.head?.a),
      chestAngle: round(puppet.torso?.a),
      rag: !!puppet.rag
    };
  }

  function observeScene(scene) {
    const frame = frameFromPuppet(ownPuppet(scene));
    if (!frame) return;
    latestFrame = frame;
    if (!recording) return;
    frames.push(frame);
    trim(frames, MAX_FRAMES);
  }

  function patchConnection(conn) {
    if (!conn || conn.__puppetalkMotionMapperPatched) return conn;
    conn.__puppetalkMotionMapperPatched = true;
    const rawSend = conn.send.bind(conn);
    const rawOn = conn.on.bind(conn);

    conn.send = function(data) {
      if (data?.type === 'input' && data.input) observeInput(data.input);
      return rawSend(data);
    };

    conn.on = function(event, handler) {
      if (event === 'data' && typeof handler === 'function') {
        return rawOn(event, data => {
          if (data?.type === 'welcome' && Number.isInteger(data.slot)) slot = data.slot;
          if (data?.type === 'scene') observeScene(data);
          return handler(data);
        });
      }
      return rawOn(event, handler);
    };
    return conn;
  }

  Peer.prototype.connect = function(...args) {
    return patchConnection(rawConnect.apply(this, args));
  };

  function canvasPoint(event) {
    const canvas = document.querySelector('#personal-canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  function recordTouch(event, phase) {
    if (!recording || event.target?.id !== 'personal-canvas') return;
    const point = canvasPoint(event);
    if (!point) return;
    touches.push({
      at: nowMs(),
      t: round(nowMs() - startedAt),
      phase,
      x: round(point.x),
      y: round(point.y),
      pointerId: event.pointerId
    });
    trim(touches, MAX_TOUCHES);
  }

  document.addEventListener('pointerdown', event => recordTouch(event, 'down'), true);
  document.addEventListener('pointermove', event => recordTouch(event, 'move'), true);
  document.addEventListener('pointerup', event => recordTouch(event, 'up'), true);
  document.addEventListener('pointercancel', event => recordTouch(event, 'cancel'), true);

  function resetTrace() {
    inputs.length = 0;
    frames.length = 0;
    touches.length = 0;
    startedAt = nowMs();
    if (status) status.textContent = recording ? 'recording · trace cleared' : 'ready';
  }

  function setRecording(next) {
    recording = !!next;
    if (recording) {
      if (!startedAt) resetTrace();
      startedAt = nowMs();
      if (status) status.textContent = 'recording';
      if (mapButton) mapButton.textContent = 'MAP ON';
      panel?.classList.add('active');
    } else {
      if (status) status.textContent = 'paused';
      if (mapButton) mapButton.textContent = 'MAP';
      panel?.classList.remove('active');
    }
  }

  function tracePayload() {
    const base = startedAt || nowMs();
    const stripAt = sample => {
      const copy = { ...sample };
      delete copy.at;
      copy.t = round(sample.at - base);
      return copy;
    };
    return {
      type: 'PUPPETALK_MOTION_TRACE_V1',
      capturedAt: new Date().toISOString(),
      viewport: { width: innerWidth, height: innerHeight, dpr: round(devicePixelRatio || 1) },
      slot,
      durationMs: round(nowMs() - base),
      latestInput: latestInput ? {
        grabs: normalizedGrabs(latestInput),
        pose: latestInput.pose || null,
        rag: !!latestInput.rag
      } : null,
      inputs: inputs.map(stripAt),
      frames: frames.map(stripAt),
      touches: touches.map(stripAt)
    };
  }

  async function copyTrace() {
    const text = JSON.stringify(tracePayload());
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = 'copied · paste into ChatGPT';
      return;
    } catch (_) {}
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      if (status) status.textContent = 'copied · paste into ChatGPT';
    } catch (_) {
      if (status) status.textContent = 'copy failed';
    }
    area.remove();
  }

  function makeButton(text, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    Object.assign(button.style, {
      border: '1px solid rgba(255,255,255,.18)',
      borderRadius: '999px',
      background: 'rgba(14,16,19,.82)',
      color: '#fff',
      padding: '7px 9px',
      font: '800 9px/1 system-ui,sans-serif',
      letterSpacing: '.08em'
    });
    button.addEventListener('click', action);
    return button;
  }

  function ensurePanel() {
    if (panel || !document.querySelector('#personal-canvas')) return !!panel;
    panel = document.createElement('section');
    panel.id = 'puppetalk-motion-mapper';
    Object.assign(panel.style, {
      position: 'fixed',
      right: '10px',
      top: '10px',
      zIndex: '120',
      width: '214px',
      padding: '8px',
      border: '1px solid rgba(255,255,255,.16)',
      borderRadius: '14px',
      background: 'rgba(5,7,9,.74)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 30px rgba(0,0,0,.28)'
    });

    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', gap: '6px', alignItems: 'center' });
    mapButton = makeButton('MAP', () => setRecording(!recording));
    const clearButton = makeButton('CLEAR', resetTrace);
    const copyButton = makeButton('COPY', copyTrace);
    head.append(mapButton, clearButton, copyButton);

    status = document.createElement('div');
    status.textContent = 'ready';
    Object.assign(status.style, {
      marginLeft: 'auto',
      color: 'rgba(255,255,255,.58)',
      font: '700 8px/1 system-ui,sans-serif',
      letterSpacing: '.04em'
    });

    const statusRow = document.createElement('div');
    statusRow.appendChild(status);
    Object.assign(statusRow.style, { marginTop: '6px', textAlign: 'right' });

    plot = document.createElement('canvas');
    plot.width = 396;
    plot.height = 300;
    plot.style.width = '198px';
    plot.style.height = '150px';
    plot.style.display = 'block';
    plot.style.marginTop = '7px';
    plot.style.borderRadius = '9px';
    plot.style.background = 'rgba(255,255,255,.035)';
    plot.style.pointerEvents = 'none';
    ctx = plot.getContext('2d');

    const key = document.createElement('div');
    key.textContent = 'T touch · H head · C chest · P hips · F feet';
    Object.assign(key.style, {
      marginTop: '5px',
      color: 'rgba(255,255,255,.58)',
      font: '700 8px/1.25 system-ui,sans-serif',
      letterSpacing: '.025em'
    });

    panel.append(head, statusRow, plot, key);
    document.body.appendChild(panel);
    return true;
  }

  function plotPoint(point, width, height, pad) {
    if (!point) return null;
    return {
      x: pad + point.x * (width - pad * 2),
      y: pad + point.y * (height - pad * 2)
    };
  }

  function drawTrail(points, strokeStyle, width, height, pad) {
    const valid = points.map(point => plotPoint(point, width, height, pad)).filter(Boolean);
    if (valid.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(valid[0].x, valid[0].y);
    for (let i = 1; i < valid.length; i += 1) ctx.lineTo(valid[i].x, valid[i].y);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 3;
    ctx.globalAlpha = .62;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function mark(point, label, fill, width, height, pad) {
    const p = plotPoint(point, width, height, pad);
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = '#080a0d';
    ctx.font = '800 10px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + .5);
  }

  function draw() {
    requestAnimationFrame(draw);
    if (!ensurePanel() || !ctx || !plot) return;
    const width = plot.width;
    const height = plot.height;
    const pad = 14;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const x = width * i / 4;
      const y = height * i / 4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const recentFrames = frames.slice(-90);
    const recentTouches = touches.slice(-120).filter(sample => sample.phase !== 'up' && sample.phase !== 'cancel');
    drawTrail(recentTouches, '#ffffff', width, height, pad);
    drawTrail(recentFrames.map(frame => frame.head), '#e7c35a', width, height, pad);
    drawTrail(recentFrames.map(frame => frame.chest), '#66b9ff', width, height, pad);
    drawTrail(recentFrames.map(frame => frame.hips), '#f08ac0', width, height, pad);
    drawTrail(recentFrames.map(frame => frame.feet), '#79d78f', width, height, pad);

    const frame = latestFrame;
    if (frame) {
      if (frame.head && frame.chest && frame.hips) {
        const hp = plotPoint(frame.head, width, height, pad);
        const cp = plotPoint(frame.chest, width, height, pad);
        const pp = plotPoint(frame.hips, width, height, pad);
        ctx.beginPath();
        ctx.moveTo(hp.x, hp.y); ctx.lineTo(cp.x, cp.y); ctx.lineTo(pp.x, pp.y);
        ctx.strokeStyle = 'rgba(255,255,255,.26)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      mark(frame.head, 'H', '#e7c35a', width, height, pad);
      mark(frame.chest, 'C', '#66b9ff', width, height, pad);
      mark(frame.hips, 'P', '#f08ac0', width, height, pad);
      mark(frame.feet, 'F', '#79d78f', width, height, pad);
    }

    const grab = normalizedGrabs(latestInput)[0];
    if (grab && Number.isFinite(grab.x) && Number.isFinite(grab.y)) {
      mark(grab, 'T', '#ffffff', width, height, pad);
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '800 12px system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(grab.part, 8, 8);
    }
  }

  const observer = new MutationObserver(() => ensurePanel());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ensurePanel();
  requestAnimationFrame(draw);

  window.PuppetalkMotionMapper = {
    version: 1,
    start() { setRecording(true); },
    stop() { setRecording(false); },
    clear: resetTrace,
    trace: tracePayload
  };
})();
