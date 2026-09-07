export function createVoiceMesh({ peer, localPlayerId }) {
  if (!peer) return null;

  const peersByPlayer = new Map();
  const outgoingCalls = new Map();
  const incomingCalls = new Set();
  const audioByCall = new Map();
  let microphoneStream = null;

  function removeAudio(call) {
    const audio = audioByCall.get(call);
    if (!audio) return;
    try { audio.pause(); } catch {}
    audio.srcObject = null;
    audio.remove();
    audioByCall.delete(call);
  }

  function cleanupIncoming(call) {
    removeAudio(call);
    incomingCalls.delete(call);
  }

  function attachIncomingAudio(call, stream) {
    if (!stream || audioByCall.has(call)) return;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none";
    audio.srcObject = stream;
    document.body.append(audio);
    audioByCall.set(call, audio);
    audio.play?.().catch(() => {});
  }

  function handleIncomingCall(call) {
    if (call?.metadata?.kind !== "hollerday-voice") {
      call?.close?.();
      return;
    }
    incomingCalls.add(call);
    call.on("stream", stream => attachIncomingAudio(call, stream));
    call.on("close", () => cleanupIncoming(call));
    call.on("error", () => cleanupIncoming(call));
    call.answer();
  }

  function closeOutgoingPeer(peerId) {
    const call = outgoingCalls.get(peerId);
    if (!call) return;
    outgoingCalls.delete(peerId);
    try { call.close(); } catch {}
  }

  function callPeer(peerId) {
    if (!microphoneStream || !peerId || peerId === peer.id || outgoingCalls.has(peerId)) return;
    const call = peer.call(peerId, microphoneStream, {
      metadata: { kind: "hollerday-voice", playerId: localPlayerId }
    });
    if (!call) return;
    outgoingCalls.set(peerId, call);
    const cleanup = () => {
      if (outgoingCalls.get(peerId) === call) outgoingCalls.delete(peerId);
    };
    call.on("close", cleanup);
    call.on("error", cleanup);
  }

  function retryPlayback() {
    for (const audio of audioByCall.values()) {
      if (audio.paused) audio.play?.().catch(() => {});
    }
  }

  peer.on("call", handleIncomingCall);
  document.addEventListener("pointerdown", retryPlayback, { passive: true });

  return {
    get peerId() {
      return peer.id || null;
    },

    setPeers(entries = []) {
      for (const entry of entries) this.addPeer(entry?.playerId, entry?.peerId);
    },

    addPeer(playerId, peerId) {
      playerId = String(playerId || "");
      peerId = String(peerId || "");
      if (!playerId || !peerId || playerId === localPlayerId || peerId === peer.id) return;
      const previous = peersByPlayer.get(playerId);
      if (previous && previous !== peerId) closeOutgoingPeer(previous);
      peersByPlayer.set(playerId, peerId);
      callPeer(peerId);
    },

    removePeer(playerId) {
      playerId = String(playerId || "");
      const peerId = peersByPlayer.get(playerId);
      if (!peerId) return;
      peersByPlayer.delete(playerId);
      closeOutgoingPeer(peerId);
    },

    setMicrophoneStream(stream) {
      microphoneStream = stream || null;
      if (!microphoneStream) return;
      for (const peerId of peersByPlayer.values()) callPeer(peerId);
    },

    clearMicrophoneStream() {
      microphoneStream = null;
      for (const peerId of [...outgoingCalls.keys()]) closeOutgoingPeer(peerId);
    },

    close() {
      this.clearMicrophoneStream();
      for (const call of [...incomingCalls]) {
        cleanupIncoming(call);
        try { call.close(); } catch {}
      }
      peersByPlayer.clear();
      peer.off?.("call", handleIncomingCall);
      document.removeEventListener("pointerdown", retryPlayback);
    }
  };
}
