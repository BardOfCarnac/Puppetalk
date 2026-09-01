import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/vendor/matter.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'matter-js', 'build', 'matter.min.js'));
});

const rooms = new Map();
const MAX_PUPPETS = 6;

function cleanRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function roomFor(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      stage: null,
      controllers: new Map(),
      usedSlots: new Set(),
    });
  }
  return rooms.get(code);
}

function send(ws, payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function firstFreeSlot(room) {
  for (let i = 0; i < MAX_PUPPETS; i += 1) {
    if (!room.usedSlots.has(i)) return i;
  }
  return -1;
}

wss.on('connection', (ws) => {
  let membership = null;

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'hello') {
      const roomCode = cleanRoomCode(message.room);
      const role = message.role === 'controller' ? 'controller' : 'stage';
      if (!roomCode) {
        send(ws, { type: 'error', message: 'Missing room code.' });
        return;
      }

      const room = roomFor(roomCode);

      if (role === 'stage') {
        if (room.stage && room.stage !== ws) {
          send(room.stage, { type: 'replaced' });
          room.stage.close();
        }
        room.stage = ws;
        membership = { role, roomCode };
        send(ws, {
          type: 'welcome-stage',
          room: roomCode,
          controllers: [...room.controllers.values()].map((c) => ({
            id: c.id,
            slot: c.slot,
            name: c.name,
          })),
        });
        return;
      }

      const slot = firstFreeSlot(room);
      if (slot < 0) {
        send(ws, { type: 'room-full', max: MAX_PUPPETS });
        return;
      }

      const id = crypto.randomUUID();
      const name = String(message.name || `Player ${slot + 1}`).slice(0, 32);
      const controller = { id, slot, name, ws };
      room.controllers.set(id, controller);
      room.usedSlots.add(slot);
      membership = { role, roomCode, id, slot };

      send(ws, { type: 'welcome-controller', room: roomCode, id, slot, name });
      send(room.stage, { type: 'controller-joined', id, slot, name });
      return;
    }

    if (!membership) return;
    const room = rooms.get(membership.roomCode);
    if (!room) return;

    if (membership.role === 'controller' && message.type === 'input') {
      send(room.stage, {
        type: 'input',
        id: membership.id,
        slot: membership.slot,
        input: message.input || {},
      });
    }
  });

  ws.on('close', () => {
    if (!membership) return;
    const room = rooms.get(membership.roomCode);
    if (!room) return;

    if (membership.role === 'stage' && room.stage === ws) {
      room.stage = null;
    }

    if (membership.role === 'controller') {
      const controller = room.controllers.get(membership.id);
      if (controller) {
        room.controllers.delete(membership.id);
        room.usedSlots.delete(controller.slot);
        send(room.stage, {
          type: 'controller-left',
          id: membership.id,
          slot: controller.slot,
        });
      }
    }

    if (!room.stage && room.controllers.size === 0) {
      rooms.delete(membership.roomCode);
    }
  });
});

server.listen(port, () => {
  console.log(`Puppetalk listening on http://localhost:${port}`);
});
