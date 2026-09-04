export class HostTransport {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.peerId = `hollerday-${roomCode}`;
    this.peer = null;
    this.connections = new Set();
    this.messageHandlers = new Set();
    this.disconnectHandlers = new Set();
    this.online = false;
    this.lastError = null;
  }

  async open() {
    // Local simulation must never depend on the signalling server. Register the
    // PeerJS listeners immediately, then let signalling come online alongside the
    // already-running table. This restores the frozen build's local-first feel.
    this.peer = new Peer(this.peerId);

    this.peer.on("open", () => {
      this.online = true;
      this.lastError = null;
    });
    this.peer.on("error", error => {
      this.lastError = error;
      this.online = false;
      console.error("Hollerday host signalling error", error);
    });
    this.peer.on("connection", conn => {
      this.connections.add(conn);
      conn.on("data", data => {
        for (const handler of this.messageHandlers) handler(data, conn);
      });
      conn.on("close", () => {
        this.connections.delete(conn);
        for (const handler of this.disconnectHandlers) handler(conn);
      });
    });

    // Deliberately resolve now: beginHost can start Matter/rendering immediately.
    // PeerJS will emit `open` when the room is reachable by other devices.
  }

  onMessage(handler) { this.messageHandlers.add(handler); }
  onDisconnect(handler) { this.disconnectHandlers.add(handler); }

  send(conn, message) {
    if (conn?.open) conn.send(message);
  }

  broadcast(message) {
    for (const conn of this.connections) {
      if (conn.open) conn.send(message);
    }
  }

  close() {
    for (const conn of this.connections) conn.close();
    this.connections.clear();
    this.peer?.destroy();
  }
}

export class ClientTransport {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.hostPeerId = `hollerday-${roomCode}`;
    this.peer = null;
    this.connection = null;
    this.messageHandlers = new Set();
    this.closeHandlers = new Set();
  }

  async open() {
    this.peer = new Peer();
    await new Promise((resolve, reject) => {
      this.peer.once("open", resolve);
      this.peer.once("error", reject);
    });

    this.connection = this.peer.connect(this.hostPeerId, { reliable: true });
    await new Promise((resolve, reject) => {
      this.connection.once("open", resolve);
      this.connection.once("error", reject);
      this.peer.once("error", reject);
    });

    this.connection.on("data", data => {
      for (const handler of this.messageHandlers) handler(data);
    });
    this.connection.on("close", () => {
      for (const handler of this.closeHandlers) handler();
    });
  }

  onMessage(handler) { this.messageHandlers.add(handler); }
  onClose(handler) { this.closeHandlers.add(handler); }

  send(message) {
    if (this.connection?.open) this.connection.send(message);
  }

  close() {
    this.connection?.close();
    this.peer?.destroy();
  }
}
