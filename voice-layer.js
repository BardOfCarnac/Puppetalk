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
  let deafened = false;
  let micEverEnabled = false;
  let autoplayBlocked = false;

  const calibration = {
    startedAt: 0,
    ready: false,
    samples: [],
    floor: 0.006,
  };

  function safeSend(conn, payload) {
    if (!conn?.open) return;
    try { conn.send(payload); } catch (error) { console.debug('Puppetalk voice send failed', error); }
  }

  function audioConstraints() {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    const audio = {};
    if (supported.echoCancellation) audio.echoCancellation = true;
    if (supported.noiseSuppression) audio.noiseSuppression = true;
    if (supported.autoGainControl) audio.autoGainControl = true;
    if (supported.channelCount) audio.channelCount = { ideal: 1 };
    if (supported.latency) audio.latency = { ideal: 0.01 };
    return Object.keys(audio).length ? audio : true;
  }

  function resetCalibration() {
    calibration.startedAt = performance.now();
    calibration.ready = false;
    calibration.samples = [];
    calibration.floor = 0.006;
  }

  function percentile(values, amount) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))];
  }

  function mouthState(rms, now = performance.now()) {
    if (!calibration.startedAt) resetCalibration();
    if (!calibration.ready) {
      calibration.samples.push(rms);
      if (calibration.samples.length > 90) calibration.samples.shift();
      if (now - calibration.startedAt >= 720) {
        calibration.floor = Math.max(0.0025, Math.min(0.04, percentile(calibration.samples, 0.58)));
        calibration.ready = true;
      }
    }
    const floor = calibration.floor;
    const open = Math.max(0.016, floor * 2.35 + 0.006);
    const wide = Math.max(0.058, floor * 4.8 + 0.024, open * 2.5);
    if (calibration.ready && rms < open) calibration.floor = calibration.floor * 0.997 + rms * 0.003;
    if (!calibration.ready && rms < 0.045) return 0;
    if (rms >= wide) return 2;
    if (rms >= open) return 1;
    return 0;
  }

  function hasLiveMic() {
    return !!localStream?.getAudioTracks().some(track => track.readyState === 'live' && track.enabled);
  }

  function stageRoster() {
    return [...stageMembers.entries()].map(([slot, member]) => ({ slot, peerId: member.peerId, voice: !!member.voice }));
  }
  function stageBroadcast(payload) { stageMembers.forEach(member => safeSend(member.conn, payload)); }
  function broadcastRoster() { stageBroadcast({ type: 'voice-roster', peers: stageRoster() }); }

  function stageJoin(conn, slot) {
    if (!conn?.peer) return;
    stageMembers.set(slot, { conn, peerId: conn.peer, voice: false, mouth: -1 });
    broadcastRoster();
  }
  function stageLeave(slot) {
    stageMembers.delete(slot);
    broadcastRoster();
  }
  function stageData(conn, slot, msg) {
    const member = stageMembers.get(slot);
    if (!member || member.conn !== conn) return;
    if (msg?.type === 'voice-state') {
      const next = !!msg.enabled;
      if (member.voice !== next) { member.voice = next; broadcastRoster(); }
      return;
    }
    const mouth = msg?.type === 'input' && Number.isInteger(msg.input?.mouth)
      ? Math.max(0, Math.min(2, msg.input.mouth)) : null;
    if (mouth !== null && mouth !== member.mouth) {
      member.mouth = mouth;
      stageBroadcast({ type: 'mouth', slot, mouth });
    }
  }

  function destroyAudio(peerId) {
    const audio = remoteAudio.get(peerId);
    if (!audio) return;
    try { audio.pause(); } catch {}
    audio.srcObject = null;
    audio.remove();
    remoteAudio.delete(peerId);
  }
  function clearCalls() {
    calls.forEach(entry => { try { entry.call.close(); } catch {} });
    calls.clear();
    [...remoteAudio.keys()].forEach(destroyAudio);
    refreshUi();
  }
  function expectedSelfInitiator(remote) {
    if (!controllerPeer?.id || !remote?.peerId) return false;
    const selfVoice = hasLiveMic();
    if (selfVoice && !remote.voice) return true;
    if (!selfVoice && remote.voice) return false;
    if (!selfVoice && !remote.voice) return false;
    return controllerPeer.id.localeCompare(remote.peerId) < 0;
  }

  function attachRemoteAudio(peerId, stream) {
    destroyAudio(peerId);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.hidden = true;
    audio.muted = deafened;
    audio.srcObject = stream;
    document.body.appendChild(audio);
    remoteAudio.set(peerId, audio);
    const play = audio.play();
    if (play?.catch) play.catch(() => { autoplayBlocked = true; refreshUi(); });
    refreshUi();
  }

  function attachCall(call, incoming = false) {
    if (!call?.peer) return;
    const peerId = call.peer;
    const existing = calls.get(peerId);
    if (existing && existing.call !== call) {
      try { existing.call.close(); } catch {}
      destroyAudio(peerId);
    }
    calls.set(peerId, { call, incoming });
    call.on('stream', stream => attachRemoteAudio(peerId, stream));
    const close = () => {
      const current = calls.get(peerId);
      if (current?.call === call) calls.delete(peerId);
      destroyAudio(peerId);
      refreshUi();
    };
    call.on('close', close);
    call.on('error', error => { console.debug('Puppetalk voice call error', error); close(); });
    refreshUi();
  }

  function acceptCall(call) {
    const remote = roster.find(item => item.peerId === call.peer);
    if (remote && expectedSelfInitiator(remote)) {
      const existing = calls.get(call.peer);
      if (existing && !existing.incoming) { try { call.close(); } catch {} return; }
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
      if (!expectedSelfInitiator(remote)) continue;
      if (calls.has(remote.peerId) || !selfVoice) continue;
      try {
        const call = controllerPeer.call(remote.peerId, localStream, {
          metadata: { room: controllerRoom, slot: controllerSlot, puppetalkVoice: 1 },
        });
        if (call) attachCall(call, false);
      } catch (error) { console.debug('Puppetalk voice call failed', error); }
    }
    refreshUi();
  }
  function scheduleReconcile(reset = false) {
    if (reset) clearCalls();
    if (reconcileTimer) clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(establishCalls, 120 + Math.floor(Math.random() * 90));
  }

  function controllerPeerReady(peer, room) {
    clearCalls();
    controllerPeer = peer;
    controllerRoom = room || '';
    stageConn = null;
    controllerSlot = null;
    roster = [];
    rosterSignature = '';
    peer.on('call', acceptCall);
    peer.on('close', clearCalls);
    peer.on('disconnected', () => refreshUi());
    bindUi();
  }
  function controllerWelcome(conn, slot) {
    stageConn = conn;
    controllerSlot = slot;
    safeSend(stageConn, { type: 'voice-state', enabled: hasLiveMic() });
    refreshUi();
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
    refreshUi();
  }

  function setLocalStream(stream) {
    localStream = stream;
    micEverEnabled = true;
    autoplayBlocked = false;
    resetCalibration();
    stream?.getAudioTracks().forEach(track => {
      track.addEventListener('ended', () => { if (localStream === stream) clearLocalStream(stream); }, { once: true });
    });
    safeSend(stageConn, { type: 'voice-state', enabled: true });
    scheduleReconcile(true);
    setTimeout(refreshUi, 0);
  }
  function clearLocalStream(stream) {
    if (stream && localStream && stream !== localStream) return;
    localStream = null;
    calibration.startedAt = 0;
    calibration.ready = false;
    calibration.samples = [];
    safeSend(stageConn, { type: 'voice-state', enabled: false });
    scheduleReconcile(true);
    setTimeout(refreshUi, 0);
  }

  function setDeafened(next) {
    deafened = !!next;
    autoplayBlocked = false;
    remoteAudio.forEach(audio => {
      audio.muted = deafened;
      if (!deafened) audio.play().catch(() => { autoplayBlocked = true; });
    });
    refreshUi();
  }
  function refreshUi() {
    const deafen = document.querySelector('#deafen');
    if (deafen) {
      deafen.textContent = deafened ? 'Hear everyone' : 'Deafen';
      deafen.classList.toggle('active', deafened);
    }
    const mic = document.querySelector('#mic');
    if (mic) {
      if (hasLiveMic()) mic.textContent = 'Mute microphone';
      else if (micEverEnabled) mic.textContent = 'Unmute microphone';
    }
    const status = document.querySelector('#voice-live-status');
    if (!status) return;
    const othersSpeaking = roster.filter(item => item.peerId !== controllerPeer?.id && item.voice).length;
    if (deafened) status.textContent = 'Speakers muted · puppets still hear your mic state';
    else if (autoplayBlocked) status.textContent = 'Tap Deafen, then Hear everyone, to start phone audio';
    else if (hasLiveMic()) status.textContent = `Mic live · ${othersSpeaking} other voice${othersSpeaking === 1 ? '' : 's'} active`;
    else if (othersSpeaking) status.textContent = `Listening · ${othersSpeaking} other voice${othersSpeaking === 1 ? '' : 's'} active`;
    else status.textContent = micEverEnabled ? 'Microphone muted · listening for the table' : 'Enable the microphone to speak; listening is automatic';
  }
  function bindUi() {
    const deafen = document.querySelector('#deafen');
    if (deafen && !deafen.dataset.voiceBound) {
      deafen.dataset.voiceBound = '1';
      deafen.addEventListener('click', () => setDeafened(!deafened));
    }
    refreshUi();
  }
  const observer = new MutationObserver(bindUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function localMouth(scene, slot, mouth, render) {
    const puppet = Array.isArray(scene) ? scene.find(item => item.slot === slot) : null;
    if (!puppet) return;
    puppet.mouth = mouth;
    try { render?.(); } catch {}
  }

  function transformSource(source) {
    const replace = (needle, replacement, label) => {
      if (!source.includes(needle)) { console.warn(`Puppetalk voice patch missed ${label}`); return; }
      source = source.replace(needle, replacement);
    };
    replace(
      '<div class="control-title"><span>Voice mouth</span><span class="small muted">audio stays on this phone</span></div>',
      '<div class="control-title"><span>Voice</span><span class="small muted">live audio + mouth</span></div>',
      'voice title'
    );
    replace(
      '<button id="talk">Hold to talk</button>\n        </div>',
      '<button id="talk">Hold to talk</button>\n          <button id="deafen">Deafen</button>\n        </div>\n        <div class="small muted" id="voice-live-status">Enable the microphone to speak; listening is automatic</div>',
      'voice controls'
    );
    replace(
      "      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy)});\n      updateStatus();",
      "      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy)});\n      window.PuppetalkVoice?.stageJoin(conn,slot);\n      updateStatus();",
      'stage join'
    );
    replace(
      "    conn.on('data',msg=>applyInput(slot,msg));",
      "    conn.on('data',msg=>{ window.PuppetalkVoice?.stageData(conn,slot,msg); applyInput(slot,msg); });",
      'stage data'
    );
    replace(
      "      conns.delete(slot);\n      removePuppet(slot);",
      "      window.PuppetalkVoice?.stageLeave(slot);\n      conns.delete(slot);\n      removePuppet(slot);",
      'stage leave'
    );
    replace(
      "    peer = new Peer();\n    peer.on('open',()=>{",
      "    peer = new Peer();\n    window.PuppetalkVoice?.controllerPeer(peer,room);\n    peer.on('open',()=>{",
      'controller peer'
    );
    replace(
      "      conn.on('data',msg=>{\n        if(msg?.type === 'welcome'){\n",
      "      conn.on('data',msg=>{\n        window.PuppetalkVoice?.controllerData(msg);\n        if(msg?.type === 'welcome'){\n",
      'controller data hook'
    );
    replace(
      "          slot = msg.slot;\n          setStatus(`you are ${NAMES[slot] || msg.name}`,'live');",
      "          slot = msg.slot;\n          window.PuppetalkVoice?.controllerWelcome(conn,slot);\n          setStatus(`you are ${NAMES[slot] || msg.name}`,'live');",
      'controller welcome'
    );
    replace(
      "        if(msg?.type === 'scene'){",
      "        if(msg?.type === 'mouth'){ window.PuppetalkVoice?.localMouth(scene,msg.slot,msg.mouth,renderPersonalScene); }\n        if(msg?.type === 'scene'){",
      'fast remote mouth'
    );
    replace(
      "      const stream = await navigator.mediaDevices.getUserMedia({audio:true});",
      "      const stream = await navigator.mediaDevices.getUserMedia({audio:window.PuppetalkVoice?.audioConstraints?.() || true});\n      window.PuppetalkVoice?.setLocalStream(stream);",
      'mic constraints'
    );
    replace(
      "        if(rms > .028) mouth = rms > .105 ? 2 : 1;",
      "        mouth = window.PuppetalkVoice?.mouthState?.(rms,now) ?? (rms > .028 ? (rms > .105 ? 2 : 1) : 0);",
      'mouth calibration'
    );
    replace(
      "          input.mouth = mouth;\n          lastMouth = mouth;",
      "          input.mouth = mouth;\n          window.PuppetalkVoice?.localMouth(scene,slot,mouth,renderPersonalScene);\n          lastMouth = mouth;",
      'local mouth response'
    );
    replace(
      "      micStop = ()=>{\n        cancelAnimationFrame(raf);",
      "      micStop = ()=>{\n        window.PuppetalkVoice?.clearLocalStream(stream);\n        cancelAnimationFrame(raf);",
      'mic stop'
    );
    replace("      micButton.textContent = 'Disable microphone';", "      micButton.textContent = 'Mute microphone';", 'mic active label');
    replace(
      "      micButton.textContent = 'Enable microphone';\n      input.mouth = 0;",
      "      micButton.textContent = 'Unmute microphone';\n      input.mouth = 0;\n      window.PuppetalkVoice?.localMouth(scene,slot,0,renderPersonalScene);",
      'mic muted label'
    );
    replace(
      "      input.mouth = phase === 0 ? 1 : phase === 1 ? 2 : 1;\n      transmit(true);",
      "      input.mouth = phase === 0 ? 1 : phase === 1 ? 2 : 1;\n      window.PuppetalkVoice?.localMouth(scene,slot,input.mouth,renderPersonalScene);\n      transmit(true);",
      'manual local mouth'
    );
    replace(
      "    input.mouth = 0;\n    talkButton.classList.remove('active');",
      "    input.mouth = 0;\n    window.PuppetalkVoice?.localMouth(scene,slot,0,renderPersonalScene);\n    talkButton.classList.remove('active');",
      'manual mouth close'
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
          headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
    } catch (error) { console.warn('Puppetalk voice source patch failed', error); }
    return response;
  };

  const style = document.createElement('style');
  style.textContent = `
    .voice-actions { grid-template-columns: repeat(3,minmax(0,1fr)); }
    #voice-live-status { min-height: 16px; line-height: 1.35; }
    @media (max-width: 470px) { .voice-actions { grid-template-columns: 1fr 1fr; } #deafen { grid-column: 1 / -1; } }
  `;
  document.head.appendChild(style);

  window.PuppetalkVoice = {
    audioConstraints,
    mouthState,
    stageJoin,
    stageLeave,
    stageData,
    controllerPeer: controllerPeerReady,
    controllerWelcome,
    controllerData,
    setLocalStream,
    clearLocalStream,
    localMouth,
  };
})();
