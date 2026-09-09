// Keeps torso dragging attached to the puppeteer's finger instead of letting the
// vertical target chase the falling torso. The locomotion layer intentionally
// rewrites torso Y to the current torso position; without a held drag anchor that
// creates a feedback loop where gravity lowers both body and target together.
(() => {
  const Peer = window.Peer;
  if (!Peer?.prototype || window.PuppetalkTorsoDragAnchor) return;

  const previousConnect = Peer.prototype.connect;
  const previousPeerOn = Peer.prototype.on;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function tagControllerConnection(conn) {
    if (!conn || conn.__puppetalkTorsoAnchorController) return conn;
    conn.__puppetalkTorsoAnchorController = true;
    const previousSend = conn.send.bind(conn);

    conn.send = function(data) {
      if (data?.type !== 'input' || !data.input) return previousSend(data);

      const input = { ...data.input };
      if (Array.isArray(input.grabs)) {
        input.grabs = input.grabs.map(grab => {
          if (grab?.part !== 'torso' || !Number.isFinite(grab.y)) return grab;
          return { ...grab, puppetalkRawFingerY: grab.y };
        });
      } else if (input.grabbing && input.grabPart === 'torso' && Number.isFinite(input.y)) {
        input.puppetalkRawFingerY = input.y;
      }

      return previousSend({ ...data, input });
    };

    return conn;
  }

  function patchStageConnection(conn) {
    if (!conn || conn.__puppetalkTorsoAnchorStage) return conn;
    conn.__puppetalkTorsoAnchorStage = true;

    const previousOn = conn.on.bind(conn);
    const previousSend = conn.send.bind(conn);
    let slot = null;
    let drag = null;

    function repairInput(input) {
      if (!input) return input;
      const grabs = Array.isArray(input.grabs) ? input.grabs : [];
      const torsoIndex = grabs.findIndex(grab => grab?.part === 'torso');
      const torso = torsoIndex >= 0 ? grabs[torsoIndex] : null;
      const rawFingerY = Number.isFinite(torso?.puppetalkRawFingerY)
        ? torso.puppetalkRawFingerY
        : Number.isFinite(input.puppetalkRawFingerY)
          ? input.puppetalkRawFingerY
          : null;

      if (!torso || rawFingerY == null) {
        drag = null;
        return input;
      }

      // By the time this wrapper sees the packet, locomotion.js has replaced
      // torso.y with its current physical Y. Capture that once at grab-down, then
      // move from it only by the finger's own vertical delta.
      if (!drag) {
        drag = {
          startRawFingerY: rawFingerY,
          startTargetY: Number.isFinite(torso.y) ? torso.y : rawFingerY
        };
      }

      const depth = Number.isInteger(slot)
        ? (window.PuppetalkDepthState?.getDepthForSlot?.(slot) || 0)
        : 0;
      const scale = Math.max(.1, window.PuppetalkDepthState?.scaleForDepth?.(depth) || 1);
      const desiredY = clamp(
        drag.startTargetY + (rawFingerY - drag.startRawFingerY) / scale,
        .04,
        .96
      );

      const nextGrabs = grabs.map((grab, index) =>
        index === torsoIndex ? { ...grab, y: desiredY } : grab
      );
      const next = { ...input, grabs: nextGrabs };
      if (next.grabPart === 'torso') next.y = desiredY;
      return next;
    }

    conn.on = function(event, handler) {
      if (event === 'data' && typeof handler === 'function') {
        return previousOn(event, data => {
          if (data?.type === 'input' && data.input) {
            return handler({ ...data, input: repairInput(data.input) });
          }
          return handler(data);
        });
      }
      return previousOn(event, handler);
    };

    conn.send = function(data) {
      if (data?.type === 'welcome' && Number.isInteger(data.slot)) slot = data.slot;
      return previousSend(data);
    };

    return conn;
  }

  Peer.prototype.connect = function(...args) {
    return tagControllerConnection(previousConnect.apply(this, args));
  };

  Peer.prototype.on = function(event, handler, ...rest) {
    if (event === 'connection' && typeof handler === 'function') {
      return previousPeerOn.call(this, event, conn => handler(patchStageConnection(conn)), ...rest);
    }
    return previousPeerOn.call(this, event, handler, ...rest);
  };

  window.PuppetalkTorsoDragAnchor = { version: 1 };
})();
