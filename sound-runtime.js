// Puppetalk live sound runtime.
// Deliberately does NOT patch fetch/app source: voice failure must never stop the puppet scene booting.
(() => {
  try {
    if (!window.Peer || !navigator.mediaDevices?.getUserMedia) return;

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode') === 'controller' ? 'controller' : params.get('mode') === 'stage' ? 'stage' : 'home';
    const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (mode === 'home' || !room) return;

    const PeerClass = window.Peer;
    const peerOn = PeerClass.prototype.on;
    const peerConnect = PeerClass.prototype.connect;
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    let controllerPeer = null;
    let stageConn = null;
    let localStream = null;
    let roster = [];
    let rosterSig = '';
    let deafened = false;
    let autoplayBlocked = false;
    let streamWatch = null;
    let reconcileTimer = null;
    const calls = new Map();
    const remoteAudio = new Map();
    const observedPeers = new WeakSet();
    const stageMembers = new Map();

    function safeSend(conn, payload) {
      if (!conn?.open) return;
      try { conn.send(payload); } catch (error) { console.debug('Puppetalk sound send failed', error); }
    }

    function hasMic() {
      return !!localStream?.getAudioTracks().some(track => track.readyState === 'live' && track.enabled);
    }

    function audioConstraints(requested) {
      const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
      const audio = typeof requested === 'object' && requested ? { ...requested } : {};
      if (supported.echoCancellation && audio.echoCancellation == null) audio.echoCancellation = true;
      if (supported.noiseSuppression && audio.noiseSuppression == null) audio.noiseSuppression = true;
      if (supported.autoGainControl && audio.autoGainControl == null) audio.autoGainControl = true;
      if (supported.channelCount && audio.channelCount == null) audio.channelCount = { ideal: 1 };
      if (supported.latency && audio.latency == null) audio.latency = { ideal: 0.01 };
      return audio;
    }

    function destroyAudio(peerId) {
      const audio = remoteAudio.get(peerId);
      if (!audio) return;
      try { audio.pause(); } catch {}
      try { audio.srcObject = null; } catch {}
      audio.remove();
      remoteAudio.delete(peerId);
    }

    function closeCall(peerId) {
      const entry = calls.get(peerId);
      if (entry) {
        try { entry.call.close(); } catch {}
        calls.delete(peerId);
      }
      destroyAudio(peerId);
    }

    function clearCalls() {
      [...calls.keys()].forEach(closeCall);
    }

    function attachRemoteAudio(peerId, stream) {
      destroyAudio(peerId);
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.hidden = true;
      audio.muted = deafened;
      audio.srcObject = stream;
      document.body.appendChild(audio);
      remoteAudio.set(peerId, audio);
      const play = audio.play();
      if (play?.catch) play.catch(() => {
        autoplayBlocked = true;
        refreshUi();
      });
      refreshUi();
    }

    function registerCall(call, direction) {
      if (!call?.peer) return;
      const peerId = call.peer;
      const previous = calls.get(peerId);
      if (previous && previous.call !== call) closeCall(peerId);
      calls.set(peerId, { call, direction });
      call.on('stream', stream => attachRemoteAudio(peerId, stream));
      const finish = () => {
        if (calls.get(peerId)?.call === call) calls.delete(peerId);
        destroyAudio(peerId);
        refreshUi();
      };
      call.on('close', finish);
      call.on('error', error => {
        console.debug('Puppetalk sound call error', error);
        finish();
      });
    }

    function shouldInitiate(remote) {
      if (!controllerPeer?.id || !remote?.peerId || !hasMic()) return false;
      if (!remote.voice) return true;
      return controllerPeer.id.localeCompare(remote.peerId) < 0;
    }

    function scheduleReconcile() {
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(reconcileCalls, 120 + Math.floor(Math.random() * 80));
    }

    function reconcileCalls() {
      reconcileTimer = null;
      if (mode !== 'controller' || !controllerPeer?.id || controllerPeer.destroyed) return;
      const valid = new Set(roster.map(item => item.peerId));
      [...calls.keys()].forEach(peerId => { if (!valid.has(peerId)) closeCall(peerId); });

      for (const remote of roster) {
        if (!remote?.peerId || remote.peerId === controllerPeer.id) continue;
        const existing = calls.get(remote.peerId);
        const initiate = shouldInitiate(remote);
        if (existing) {
          const wrongDirection = initiate ? existing.direction !== 'out' : (hasMic() && remote.voice && existing.direction !== 'in');
          if (wrongDirection) closeCall(remote.peerId);
          else continue;
        }
        if (!initiate) continue;
        try {
          const call = controllerPeer.call(remote.peerId, localStream, {
            metadata: { puppetalkSound: 2, room }
          });
          if (call) registerCall(call, 'out');
        } catch (error) {
          console.debug('Puppetalk sound outgoing call failed', error);
        }
      }
      refreshUi();
    }

    function acceptCall(call) {
      if (mode !== 'controller' || !call?.peer) return;
      if (call.metadata?.puppetalkSound !== 2 || String(call.metadata?.room || '').toUpperCase() !== room) {
        try { call.close(); } catch {}
        return;
      }
      const remote = roster.find(item => item.peerId === call.peer);
      if (remote && shouldInitiate(remote)) {
        const existing = calls.get(call.peer);
        if (existing?.direction === 'out') {
          try { call.close(); } catch {}
          return;
        }
      }
      try {
        if (hasMic()) call.answer(localStream);
        else call.answer();
        registerCall(call, 'in');
      } catch (error) {
        console.debug('Puppetalk sound answer failed', error);
        try { call.close(); } catch {}
      }
    }

    function sendPresence() {
      safeSend(stageConn, { type: 'voice-presence-v2', enabled: hasMic() });
      refreshUi();
    }

    function setLocalStream(stream) {
      if (!stream?.getAudioTracks?.().length) return;
      if (localStream && localStream !== stream) clearCalls();
      localStream = stream;
      autoplayBlocked = false;
      sendPresence();
      scheduleReconcile();
      if (streamWatch) clearInterval(streamWatch);
      streamWatch = setInterval(() => {
        if (localStream !== stream) return;
        if (!stream.getAudioTracks().some(track => track.readyState === 'live' && track.enabled)) {
          localStream = null;
          clearInterval(streamWatch);
          streamWatch = null;
          sendPresence();
          clearCalls();
          scheduleReconcile();
        }
      }, 350);
      refreshUi();
    }

    // Upgrade Puppetalk's existing mic request and reuse that exact stream for live voice.
    try {
      navigator.mediaDevices.getUserMedia = async constraints => {
        const request = { ...(constraints || {}) };
        if (request.audio) request.audio = audioConstraints(request.audio === true ? {} : request.audio);
        const stream = await nativeGetUserMedia(request);
        if (request.audio) setLocalStream(stream);
        return stream;
      };
    } catch (error) {
      console.debug('Puppetalk could not wrap getUserMedia; mouth control remains available', error);
    }

    function stageRoster() {
      return [...stageMembers.values()].map(member => ({ peerId: member.peerId, voice: !!member.voice }));
    }

    function broadcastRoster() {
      const payload = { type: 'voice-roster-v2', peers: stageRoster() };
      stageMembers.forEach(member => safeSend(member.conn, payload));
    }

    function observeStageConnection(conn) {
      if (!conn?.peer || stageMembers.has(conn.peer)) return;
      const member = { conn, peerId: conn.peer, voice: false };
      stageMembers.set(conn.peer, member);
      conn.on('open', broadcastRoster);
      conn.on('data', msg => {
        if (msg?.type !== 'voice-presence-v2') return;
        const next = !!msg.enabled;
        if (member.voice !== next) {
          member.voice = next;
          broadcastRoster();
        }
      });
      const gone = () => {
        if (stageMembers.get(conn.peer)?.conn !== conn) return;
        stageMembers.delete(conn.peer);
        broadcastRoster();
      };
      conn.on('close', gone);
      conn.on('error', gone);
    }

    function observeControllerStageConnection(conn) {
      stageConn = conn;
      conn.on('open', () => {
        sendPresence();
        safeSend(conn, { type: 'voice-presence-v2', enabled: hasMic() });
      });
      conn.on('data', msg => {
        if (msg?.type !== 'voice-roster-v2' || !Array.isArray(msg.peers)) return;
        const next = msg.peers.filter(item => item && typeof item.peerId === 'string');
        const sig = JSON.stringify(next.map(item => [item.peerId, !!item.voice]));
        roster = next;
        if (sig !== rosterSig) {
          rosterSig = sig;
          scheduleReconcile();
        }
        refreshUi();
      });
      const gone = () => {
        if (stageConn === conn) stageConn = null;
        roster = [];
        rosterSig = '';
        clearCalls();
        refreshUi();
      };
      conn.on('close', gone);
      conn.on('error', gone);
    }

    function observePeer(peer) {
      if (!peer || observedPeers.has(peer)) return;
      observedPeers.add(peer);
      if (mode === 'stage') {
        peerOn.call(peer, 'connection', observeStageConnection);
      } else if (mode === 'controller') {
        controllerPeer = peer;
        peerOn.call(peer, 'call', acceptCall);
        peerOn.call(peer, 'open', () => { scheduleReconcile(); refreshUi(); });
        peerOn.call(peer, 'disconnected', () => refreshUi());
        peerOn.call(peer, 'close', () => { clearCalls(); refreshUi(); });
      }
    }

    // Discover Peer instances without replacing the Peer constructor.
    PeerClass.prototype.on = function patchedPeerOn(event, handler) {
      observePeer(this);
      return peerOn.call(this, event, handler);
    };

    PeerClass.prototype.connect = function patchedPeerConnect(id, options) {
      observePeer(this);
      const conn = peerConnect.call(this, id, options);
      if (mode === 'controller' && /^puppetalk-/i.test(String(id || ''))) observeControllerStageConnection(conn);
      return conn;
    };

    function setDeafened(next) {
      deafened = !!next;
      autoplayBlocked = false;
      remoteAudio.forEach(audio => {
        audio.muted = deafened;
        if (!deafened) audio.play().catch(() => { autoplayBlocked = true; });
      });
      refreshUi();
    }

    function unlockAudio() {
      if (deafened) return;
      let blocked = false;
      remoteAudio.forEach(audio => {
        audio.play().catch(() => { blocked = true; });
      });
      autoplayBlocked = blocked;
      setTimeout(refreshUi, 0);
    }

    function installUi() {
      if (mode !== 'controller') return;
      const card = document.querySelector('.voice-card');
      if (!card) return;
      const title = card.querySelector('.control-title span:first-child');
      const note = card.querySelector('.control-title span:last-child');
      if (title) title.textContent = 'Voice';
      if (note) note.textContent = 'live audio + mouth';

      const actions = card.querySelector('.voice-actions');
      if (actions && !document.querySelector('#sound-deafen')) {
        const button = document.createElement('button');
        button.id = 'sound-deafen';
        button.type = 'button';
        button.textContent = 'Deafen';
        button.addEventListener('click', event => {
          event.preventDefault();
          setDeafened(!deafened);
        });
        actions.appendChild(button);
      }
      if (!document.querySelector('#sound-status')) {
        const status = document.createElement('div');
        status.id = 'sound-status';
        status.className = 'small muted';
        status.style.marginTop = '8px';
        status.style.minHeight = '16px';
        card.appendChild(status);
      }
      refreshUi();
    }

    function refreshUi() {
      const button = document.querySelector('#sound-deafen');
      if (button) {
        button.textContent = deafened ? 'Hear everyone' : 'Deafen';
        button.classList.toggle('active', deafened);
      }
      const status = document.querySelector('#sound-status');
      if (!status) return;
      const others = roster.filter(item => item.peerId !== controllerPeer?.id && item.voice).length;
      if (deafened) status.textContent = 'Table audio muted';
      else if (autoplayBlocked) status.textContent = 'Tap anywhere to hear table audio';
      else if (hasMic()) status.textContent = `Mic live · ${others} other voice${others === 1 ? '' : 's'} active`;
      else if (others) status.textContent = `Listening · ${others} other voice${others === 1 ? '' : 's'} active`;
      else status.textContent = 'Listening automatically · enable microphone to speak';
    }

    const observer = new MutationObserver(installUi);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    addEventListener('pointerdown', unlockAudio, { passive: true });
    addEventListener('touchend', unlockAudio, { passive: true });
    installUi();

    window.PuppetalkSound = {
      version: 2,
      get mode() { return mode; },
      get connectedVoices() { return remoteAudio.size; },
      get micLive() { return hasMic(); }
    };
  } catch (error) {
    // Sound is optional. Never let it prevent Puppetalk itself from booting.
    console.error('Puppetalk sound runtime disabled after error', error);
  }
})();
