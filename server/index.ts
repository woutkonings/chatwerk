// The Chatwerk server: one Node process with HTTP and WebSocket on one port.
// In production it also serves the built web app (dist/web) with a strict
// Content-Security-Policy. Start: npm start (production) or npm run dev.
import { serve, upgradeWebSocket } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { mkdirSync, readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { ROOM_ID } from '../shared/protocol.ts';
import { runAgentTurn } from './agent.ts';
import { checkSongInWorker, stopCheckWorker } from './check-song.ts';
import { Store } from './db.ts';
import { MODEL_SETUPS, type SetupName } from './llm.ts';
import { Room, type RunTurn, type Socket } from './room.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.DATA_DIR ?? 'data';
const MODEL = (process.env.MUSIC_CHAT_MODEL ?? 'haiku') as SetupName;
const DAILY_BUDGET_USD = Number(process.env.MUSIC_CHAT_DAILY_USD ?? 1);
const MAX_ROOMS = 200;
const EMPTY_ROOM_TTL_MS = 5 * 60_000;

if (!(MODEL in MODEL_SETUPS)) throw new Error(`unknown MUSIC_CHAT_MODEL ${MODEL}`);
mkdirSync(DATA_DIR, { recursive: true });
const store = new Store(`${DATA_DIR}/music-chat.sqlite`);

const runTurn: RunTurn = process.env.ANTHROPIC_API_KEY
  ? (context, restore, signal) => runAgentTurn(MODEL, context, restore, { signal })
  : async (context) => ({
      song: context.song, changed: false, turn: null, problems: [], attempts: [], harness: [], report: null,
      reply: 'The band has no API key yet. Set ANTHROPIC_API_KEY in .env and restart the server.',
    });

function hasBudget(): boolean {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return store.costSince(today.getTime()) < DAILY_BUDGET_USD;
}

const rooms = new Map<string, Room>();
const evictTimers = new Map<string, ReturnType<typeof setTimeout>>();

function openRoom(id: string): Room | undefined {
  let room = rooms.get(id);
  if (!room && rooms.size < MAX_ROOMS) {
    room = new Room(id, { store, runTurn, hasBudget, checkSong: (song) => checkSongInWorker(song) });
    rooms.set(id, room);
  }
  clearTimeout(evictTimers.get(id));
  evictTimers.delete(id);
  return room;
}

// An empty room leaves memory after a while. Its song and chat stay in SQLite.
function evictLater(room: Room) {
  if (room.size > 0) return;
  clearTimeout(evictTimers.get(room.id));
  evictTimers.set(room.id, setTimeout(() => {
    evictTimers.delete(room.id);
    if (room.size === 0 && !room.busy) rooms.delete(room.id);
    else evictLater(room);
  }, EMPTY_ROOM_TTL_MS));
}

// Only pages from this server may open a socket. Clients without an Origin header (scripts) may too.
function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, rooms: rooms.size }));

app.get('/ws/:room', async (c, next) => {
  if (!ROOM_ID.test(c.req.param('room'))) return c.text('bad room id', 400);
  if (!sameOrigin(c.req.header('origin'), c.req.header('host'))) return c.text('forbidden origin', 403);
  return next();
}, upgradeWebSocket((c) => {
  const id = c.req.param('room')!;
  let room: Room | undefined;
  let socket: Socket;
  return {
    onOpen(_event, ws) {
      socket = { send: (data) => ws.send(data), close: (code, reason) => ws.close(code, reason) };
      room = openRoom(id);
      if (!room) return ws.close(1013, 'too many rooms');
      room.connect(socket);
    },
    onMessage(event) {
      if (room && typeof event.data === 'string') room.receive(socket, event.data);
    },
    onClose() {
      if (!room) return;
      room.disconnect(socket);
      evictLater(room);
    },
  };
}));

if (PRODUCTION) {
  const indexHtml = readFileSync('dist/web/index.html', 'utf8');
  app.use('*', async (c, next) => {
    await next();
    const host = c.req.header('host') ?? '';
    c.header('Content-Security-Policy', [
      "default-src 'self'",
      // AudioWorklets load from data: URLs. There is no 'unsafe-eval', so Function() throws.
      "script-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      // Samples load from GitHub (sounds/*.json has the base URLs).
      `connect-src 'self' ws://${host} wss://${host} https://raw.githubusercontent.com`,
      "media-src 'self' blob: data:",
      "worker-src 'self' blob: data:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; '));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
  });
  app.use('/assets/*', serveStatic({
    root: './dist/web',
    onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable'),
  }));
  app.use('*', serveStatic({ root: './dist/web' }));
  app.get('*', (c) => c.html(indexHtml));
}

// The autopilot and the set phases move with time, so every room gets a tick.
// Each second, so a new phase starts within a second of its time.
const ticker = setInterval(() => {
  for (const room of rooms.values()) room.tick();
}, 1000);

const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST, websocket: { server: wss } }, (info) => {
  console.log(`Chatwerk on http://localhost:${info.port} (${PRODUCTION ? 'production' : 'development'}, model ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY is not set: the band cannot answer.');
});

async function shutdown() {
  clearInterval(ticker);
  server.close();
  await stopCheckWorker();
  store.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
