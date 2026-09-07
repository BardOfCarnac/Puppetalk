(() => {
  const nativeFetch = window.fetch.bind(window);
  const stageMembers = new Map();
  const remoteAudio = new Map();
  const calls = new Map();

  let controllerPeer = null;
  let stageConn = null;
  let controllerSlot = null;
  let controllerRoom = '';
  let localStream = null;
  let roster = [];
  let rosterSignature = '';
  let reconcileTimer = null;
  let retryBound = false;

  function safeSend(conn, payload) {
    if (!conn?.open) return;
    try { conn.send(payload); } catch (error) { console.debug('Puppetalk voice send failed', error); }
  }

  function hasLiveMic() {
    return !!localStream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled);
  }

  function stageRoster() {
    return [...stageMembers.entries()].map(([slot, member]) => ({
      slot,
      peerId: member.peerId,
      voice: !!member.voice,
    }));
  }

  function stageBroadcast(payload) {
    stageMembers.forEach(member => safeSend(member.conn, payload));
  }

  function broadcastRoster() {
    stageBroadcast({ type: 'voice-roster', peers: stageRoster() });
  }

  function stageJoin(conn, slot) {
    if (!conn?.peer) return;
    stageMembers.set(slot, { conn, peerId: conn.peer, voice: false });
    broadcastRoster();
  }

  function stageLeave(slot) {
    stageMembers.delete(slot);
    broadcastRoster();
  }

  function stageData(conn, slot, msg) {
    const member = stageMembers.get(slot);
    if (!member || member.conn !== conn || msg?.type !== 'voice-state') return;
    const enabled = !!msg.enabled;
    if (member.voice === enabled) return;
    member.voice = enabled;
    broadcastRoster();
  }

  function destroyAudio(peerId) {
    const audio = remoteAudio.get(peerId);
    if (!audio) return;
    try { audio.pause(); } catch {}
    audio.srcObject = null;
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
    for (const peerId of [...calls.keys()]) closeCall(peerId);
    for (const peerId of [...remoteAudio.keys()]) destroyAudio(peerId);
  }

  function shouldInitiate(remote) {
    if (!controllerPeer?.id || !remote?.peerId) return false;
    const selfVoice = hasLiveMic();
    if (!selfVoice && !remote.voice) return false;
    if (selfVoice && !remote.voice) return true;
    if (!selfVoice && remote.voice) return false;
    return controllerPeer.id.localeCompare(remote.peerId) < 0;
  }

  function retryBlockedAudio() {
    for (const audio of remoteAudio.values()) {
      if (audio.paused) audio.play().catch(() => {});
    }
  }

  function bindPlaybackRetry() {
    if (retryBound) return;
    retryBound = true;
    document.addEventListener('pointerdown', retryBlockedAudio, { passive: true });
  }

  function attachRemoteAudio(peerId, stream) {
    destroyAudio(peerId);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.hidden = true;
    audio.srcObject = stream;
    document.body.appendChild(audio);
    remoteAudio.set(peerId, audio);
    const play = audio.play();
    if (play?.catch) play.catch(bindPlaybackRetry);
  }

  function attachCall(call, incoming) {
    if (!call?.peer) return;
    const peerId = call.peer;
    const existing = calls.get(peerId);
    if (existing && existing.call !== call) closeCall(peerId);
    calls.set(peerId, { call, incoming: !!incoming });
    call.on('stream', stream => attachRemoteAudio(peerId, stream));
    const finish = () => {
      if (calls.get(peerId)?.call === call) calls.delete(peerId);
      destroyAudio(peerId);
    };
    call.on('close', finish);
    call.on('error', error => {
      console.debug('Puppetalk voice call error', error);
      finish();
    });
  }

  function acceptCall(call) {
    if (!call?.peer) return;
    const remoteRoom = String(call.metadata?.puppetalkRoom || '');
    if (remoteRoom && controllerRoom && remoteRoom !== controllerRoom) {
      try { call.close(); } catch {}
      return;
    }

    const remote = roster.find(item => item.peerId === call.peer);
    if (remote && shouldInitiate(remote)) {
      const existing = calls.get(call.peer);
      if (existing && !existing.incoming) {
        try { call.close(); } catch {}
        return;
      }
    }

    try {
      if (hasLiveMic()) call.answer(localStream);
      else call.answer();
      attachCall(call, true);
    } catch (error) {
      console.debug('Puppetalk voice answer failed', error);
      try { call.close(); } catch {}
    }
  }

  function establishCalls() {
    reconcileTimer = null;
    if (!controllerPeer?.id || controllerPeer.destroyed) return;
    const selfVoice = hasLiveMic();

    for (const remote of roster) {
      if (!remote?.peerId || remote.peerId === controllerPeer.id) continue;
      if (!selfVoice && !remote.voice) continue;
      if (!shouldInitiate(remote) || calls.has(remote.peerId) || !selfVoice) continue;
      try {
        const call = controllerPeer.call(remote.peerId, localStream, {
          metadata: { puppetalkRoom: controllerRoom, slot: controllerSlot },
        });
        if (call) attachCall(call, false);
      } catch (error) {
        console.debug('Puppetalk voice call failed', error);
      }
    }
  }

  function scheduleReconcile(reset = false) {
    if (reset) clearCalls();
    if (reconcileTimer) clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(establishCalls, 120 + Math.floor(Math.random() * 80));
  }

  function controllerPeerReady(peer, room) {
    clearCalls();
    controllerPeer = peer;
    controllerRoom = String(room || '');
    stageConn = null;
    controllerSlot = null;
    roster = [];
    rosterSignature = '';
    peer.on('call', acceptCall);
    peer.on('close', clearCalls);
  }

  function controllerWelcome(conn, slot) {
    stageConn = conn;
    controllerSlot = slot;
    safeSend(stageConn, { type: 'voice-state', enabled: hasLiveMic() });
  }

  function controllerData(msg) {
    if (msg?.type !== 'voice-roster' || !Array.isArray(msg.peers)) return;
    const nextRoster = msg.peers.filter(item => item && typeof item.peerId === 'string');
    const signature = JSON.stringify(nextRoster.map(item => [item.slot, item.peerId, !!item.voice]));
    roster = nextRoster;
    if (signature !== rosterSignature) {
      rosterSignature = signature;
      scheduleReconcile(true);
    }
  }

  function setLocalStream(stream) {
    localStream = stream || null;
    stream?.getAudioTracks?.().forEach(track => {
      track.addEventListener('ended', () => {
        if (localStream === stream) clearLocalStream(stream);
      }, { once: true });
    });
    safeSend(stageConn, { type: 'voice-state', enabled: hasLiveMic() });
    scheduleReconcile(true);
  }

  function clearLocalStream(stream) {
    if (stream && localStream && stream !== localStream) return;
    localStream = null;
    safeSend(stageConn, { type: 'voice-state', enabled: false });
    scheduleReconcile(true);
  }

  function transformSource(source) {
    function replaceText(needle, replacement, label) {
      if (!source.includes(needle)) {
        console.warn(`Puppetalk live voice patch missed ${label}`);
        return;
      }
      source = source.replace(needle, replacement);
    }

    function replacePattern(pattern, replacement, label) {
      if (!pattern.test(source)) {
        console.warn(`Puppetalk live voice patch missed ${label}`);
        return;
      }
      source = source.replace(pattern, replacement);
    }

    // Other rebuild decorators can add scene/prop payloads between welcome and
    // updateStatus, so hook the stable stage connection block structurally.
    replacePattern(
      /(send\(conn,\{type:'welcome',slot,name:NAMES\[slot\][^\n]*\);[\s\S]*?)(\n\s*updateStatus\(\);)/,
      (_, before, after) => `${before}\n      window.PuppetalkLiveVoice?.stageJoin(conn,slot);${after}`,
      'stage join'
    );

    replaceText(
      "    conn.on('data',msg=>applyInput(slot,msg));",
      "    conn.on('data',msg=>{ window.PuppetalkLiveVoice?.stageData(conn,slot,msg); applyInput(slot,msg); });",
      'stage data'
    );

    replaceText(
      "      conns.delete(slot);\n      removePuppet(slot);",
      "      window.PuppetalkLiveVoice?.stageLeave(slot);\n      conns.delete(slot);\n      removePuppet(slot);",
      'stage leave'
    );

    replaceText(
      "    peer = new Peer();\n    peer.on('open',()=>{",
      "    peer = new Peer();\n    window.PuppetalkLiveVoice?.controllerPeer(peer,room);\n    peer.on('open',()=>{",
      'controller peer'
    );

    replaceText(
      "      conn.on('data',msg=>{\n        if(msg?.type === 'welcome'){\n",
      "      conn.on('data',msg=>{\n        window.PuppetalkLiveVoice?.controllerData(msg);\n        if(msg?.type === 'welcome'){\n",
      'controller data'
    );

    // Character/profile decorators can insert work after slot assignment, so
    // attach immediately after the stable assignment rather than matching the
    // next line of UI text.
    replacePattern(
      /(if\(msg\?\.type === 'welcome'\)\{[\s\S]*?\n\s*slot = msg\.slot;)/,
      match => `${match}\n          window.PuppetalkLiveVoice?.controllerWelcome(conn,slot);`,
      'controller welcome'
    );

    replaceText(
      "      const stream = await navigator.mediaDevices.getUserMedia({audio:true});",
      "      const stream = await navigator.mediaDevices.getUserMedia({audio:true});\n      window.PuppetalkLiveVoice?.setLocalStream(stream);",
      'microphone stream'
    );

    replaceText(
      "      micStop = ()=>{\n        cancelAnimationFrame(raf);",
      "      micStop = ()=>{\n        window.PuppetalkLiveVoice?.clearLocalStream(stream);\n        cancelAnimationFrame(raf);",
      'microphone stop'
    );

    return source;
  }

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input?.url || '', location.href);
      if (url.origin === location.origin && /\/app\.js$/.test(url.pathname)) {
        const source = await response.text();
        return new Response(transformSource(source), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }
    } catch (error) {
      console.warn('Puppetalk live voice source patch failed', error);
    }
    return response;
  };

  window.PuppetalkLiveVoice = {
    stageJoin,
    stageLeave,
    stageData,
    controllerPeer: controllerPeerReady,
    controllerWelcome,
    controllerData,
    setLocalStream,
    clearLocalStream,
  };
})();