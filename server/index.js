import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { RoomStore, StoreError } from './rooms.js';
import { GameError } from '../shared/tichu/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const store = new RoomStore();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, rooms: store.roomCount, uptime: Math.round(process.uptime()) });
});

if (fs.existsSync(DIST)) {
  app.use(
    express.static(DIST, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send('개발 모드입니다. http://localhost:5173 으로 접속해 주세요. (npm run dev)');
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendError(ws, message, fatal = false) {
  send(ws, { t: 'error', message, fatal });
}

function broadcast(room) {
  for (const player of room.players) {
    if (player.socket && player.socket.readyState === player.socket.OPEN) {
      send(player.socket, { t: 'state', view: store.serialize(room, player) });
    }
  }
}

function attach(ws, room, player) {
  store.bindSocket(room, player, ws);
  ws.ctx = { room, player };
  send(ws, {
    t: 'joined',
    token: player.token,
    seat: player.seat,
    code: room.code,
    name: player.name,
  });
  broadcast(room);
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.ctx = null;
  ws.messageTimes = [];

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    const now = Date.now();
    ws.messageTimes = ws.messageTimes.filter((t) => now - t < 5000);
    ws.messageTimes.push(now);
    if (ws.messageTimes.length > 80) {
      sendError(ws, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      ws.close(4008, 'rate limit');
      return;
    }

    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      sendError(ws, '잘못된 요청입니다.');
      return;
    }

    try {
      switch (msg.t) {
        case 'ping': {
          send(ws, { t: 'pong', at: now });
          break;
        }

        case 'create': {
          if (ws.ctx) {
            sendError(ws, '이미 방에 접속해 있습니다.');
            break;
          }
          const { room, player } = store.createRoom({ name: msg.name, catId: msg.catId });
          attach(ws, room, player);
          break;
        }

        case 'join': {
          if (ws.ctx) {
            sendError(ws, '이미 방에 접속해 있습니다.');
            break;
          }
          const { room, player, reconnected } = store.joinRoom({
            code: msg.code,
            name: msg.name,
            token: msg.token,
            catId: msg.catId,
          });
          attach(ws, room, player);
          if (reconnected) {
            send(ws, { t: 'info', message: '다시 연결되었습니다.' });
          }
          break;
        }

        case 'action': {
          if (!ws.ctx) {
            sendError(ws, '먼저 방에 접속해 주세요.', true);
            break;
          }
          const { room, player } = ws.ctx;
          if (!room.players.includes(player)) {
            sendError(ws, '방에서 나갔습니다.', true);
            break;
          }
          const result = store.handleAction(room, player, msg.action ?? {});
          if (msg.action?.type === 'leave') {
            send(ws, { t: 'left' });
            ws.ctx = null;
            ws.close(4000, 'left');
            break;
          }
          if (!result.duplicate) broadcast(room);
          break;
        }

        default:
          sendError(ws, '알 수 없는 요청입니다.');
      }
    } catch (err) {
      if (err instanceof StoreError || err instanceof GameError) {
        sendError(ws, err.message, msg.t === 'join' || msg.t === 'create');
      } else {
        console.error('[cat-tichu] unexpected error:', err);
        sendError(ws, '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  });

  ws.on('close', () => {
    const ctx = ws.ctx;
    if (!ctx) return;
    const { room, player } = ctx;
    // 다른 탭/기기로 교체된 경우에는 접속 해제로 처리하지 않는다.
    if (player.socket === ws) {
      store.disconnect(room, player);
      broadcast(room);
    }
  });

  ws.on('error', () => {
    /* close 이벤트에서 정리한다 */
  });
});

// 좀비 연결 정리
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, 25000);

const cleaner = setInterval(() => store.cleanup(), 10 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`[cat-tichu] 서버 실행 중: http://localhost:${PORT}`);
  if (!fs.existsSync(DIST)) {
    console.log('[cat-tichu] dist 폴더가 없습니다. 개발 모드에서는 Vite(5173)를 사용하세요.');
  }
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(cleaner);
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
