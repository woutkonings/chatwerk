// One Room actor per room. It keeps the clients, the chat and the song, and it
// runs one agent turn at a time. Chat messages for the band collect for a
// short time, so one turn can answer several users. Only an agent turn writes
// a new song version; clients can only chat, react and ping.
import type { AgentOutcome } from './agent.ts';
import type { Store } from './db.ts';
import type { TurnContext } from './prompt.ts';
import {
  ClientMessage, REACTION_EMOJI, cpsFromBpm, cycleAt,
  type AgentState, type ChatEntry, type RoomClock, type ServerMessage, type User,
} from '../shared/protocol.ts';
import { EMPTY_SONG, type Song } from '../shared/schema.ts';

export const MAX_CLIENTS = 16;
const MAX_MESSAGE_BYTES = 4096;
const MAX_PENDING_PER_USER = 2;
const MAX_BATCH = 8;
const CHAT_PER_MINUTE = 6;
const SOCKET_MESSAGES_PER_10S = 40;
const TURN_TIMEOUT_MS = 60_000;
// The time that a song message needs to reach the clients and be scheduled.
const TRANSITION_LEAD_MS = 500;
// After this many refused turns, a user cannot talk to the band for a while.
const MAX_STRIKES = 3;
const BLOCK_MS = 10 * 60_000;

export type Socket = { send(data: string): void; close(code?: number, reason?: string): void };

export type RunTurn = (
  context: TurnContext,
  restore: (version: number) => Song | undefined,
  signal: AbortSignal,
) => Promise<AgentOutcome>;

export type RoomDeps = {
  store: Store;
  runTurn: RunTurn;
  hasBudget: () => boolean; // false when the daily model budget is spent
  debounceMs?: number;
  now?: () => number;
};

type Client = { user: User; clientId: string };
type Pending = { chatId: number; clientId: string; author: string; text: string };
type Limits = { chatTimes: number[]; strikes: number; blockedUntil: number };

let nextUserId = 1;

export class Room {
  readonly id: string;
  private deps: Required<RoomDeps>;
  private clients = new Map<Socket, Client | null>(); // null until the client joins
  private socketWindows = new Map<Socket, { start: number; count: number }>();
  private limits = new Map<string, Limits>(); // per client id, so a reconnect keeps them
  private song: Song;
  private clock: RoomClock;
  private seq = 0;
  private pending: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private agent: AgentState = { status: 'idle', queue: 0 };

  constructor(id: string, deps: RoomDeps) {
    this.id = id;
    this.deps = { debounceMs: 1500, now: Date.now, ...deps };
    this.song = deps.store.latestSong(id) ?? EMPTY_SONG;
    this.clock = { cycle: 0, serverMs: this.deps.now(), cps: cpsFromBpm(this.song.bpm) };
  }

  get size() {
    return this.clients.size;
  }

  // True while a turn runs or messages wait for one, so the room must stay in memory.
  get busy() {
    return this.running || this.timer !== null || this.pending.length > 0;
  }

  connect(socket: Socket) {
    this.clients.set(socket, null);
  }

  disconnect(socket: Socket) {
    const client = this.clients.get(socket);
    this.clients.delete(socket);
    this.socketWindows.delete(socket);
    if (client) this.broadcast({ type: 'presence', seq: 0, users: this.users() });
  }

  receive(socket: Socket, raw: string) {
    if (!this.clients.has(socket)) return;
    if (raw.length > MAX_MESSAGE_BYTES || !this.allowSocketMessage(socket)) {
      socket.close(1008, 'too many or too large messages');
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = ClientMessage.safeParse(data);
    if (!parsed.success) return;
    const message = parsed.data;
    const client = this.clients.get(socket);

    if (message.type === 'ping') {
      this.sendTo(socket, { type: 'pong', t: message.t, serverMs: this.deps.now() });
      return;
    }
    if (message.type === 'join') {
      if (client) return;
      if (this.users().length >= MAX_CLIENTS) {
        this.sendTo(socket, { type: 'notice', text: 'This room is full.' });
        socket.close(1008, 'room full');
        return;
      }
      const joined: Client = { user: { id: `u${nextUserId++}`, name: message.name }, clientId: message.clientId };
      this.clients.set(socket, joined);
      this.sendSnapshot(socket, joined);
      this.broadcast({ type: 'presence', seq: 0, users: this.users() });
      return;
    }
    if (!client) return;

    switch (message.type) {
      case 'resync':
        this.sendSnapshot(socket, client);
        return;
      case 'chat':
        this.chat(socket, client, message.text, message.toBand);
        return;
      case 'react': {
        if (message.version > this.song.version) return;
        const counts = this.deps.store.react(this.id, message.version, client.clientId, message.reaction, message.on);
        this.broadcast({ type: 'reactions', seq: 0, version: message.version, counts });
        return;
      }
    }
  }

  private chat(socket: Socket, client: Client, text: string, toBand: boolean) {
    const now = this.deps.now();
    const limits = this.limitsOf(client.clientId);
    limits.chatTimes = limits.chatTimes.filter((t) => now - t < 60_000);
    if (limits.chatTimes.length >= CHAT_PER_MINUTE) {
      this.sendTo(socket, { type: 'notice', text: 'Slow down: at most 6 messages per minute.' });
      return;
    }
    if (toBand && limits.blockedUntil > now) {
      this.sendTo(socket, { type: 'notice', text: 'The band does not take requests from you for a few minutes.' });
      return;
    }
    if (toBand && this.pending.filter((p) => p.clientId === client.clientId).length >= MAX_PENDING_PER_USER) {
      this.sendTo(socket, { type: 'notice', text: 'The band is still working on your earlier messages.' });
      return;
    }
    limits.chatTimes.push(now);
    const entry = this.deps.store.addChat(this.id, client.user.name, 'user', text, toBand, now);
    this.broadcast({ type: 'chat', seq: 0, entry });
    if (!toBand) return;
    this.pending.push({ chatId: entry.id, clientId: client.clientId, author: client.user.name, text });
    this.schedule();
  }

  private schedule() {
    if (this.running || this.timer || this.pending.length === 0) {
      this.setAgent(this.running ? 'thinking' : this.agent.status);
      return;
    }
    this.setAgent('waiting');
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runTurn();
    }, this.deps.debounceMs);
  }

  private async runTurn() {
    this.running = true;
    const batch = this.pending.splice(0, MAX_BATCH);
    this.setAgent('thinking');
    try {
      if (!this.deps.hasBudget()) {
        this.bandSays('The band is out of credits for today. The song keeps playing.');
        return;
      }
      const outcome = await this.ask(batch);
      if (outcome.changed) this.publish(outcome, [...new Set(batch.map((p) => p.author))].join(', '));
      this.bandSays(outcome.reply);
      if (outcome.problems.includes('the model refused the request')) this.strike(batch);
    } catch (error) {
      console.error(`room ${this.id}: agent turn failed`, error);
      this.bandSays('The band lost the thread. Please try again.');
    } finally {
      this.running = false;
      this.setAgent(this.pending.length ? 'waiting' : 'idle');
      this.schedule();
    }
  }

  private async ask(batch: Pending[]): Promise<AgentOutcome> {
    const { store } = this.deps;
    const firstId = batch[0].chatId;
    const recentChat = store.chat(this.id, 40)
      .filter((entry) => entry.id < firstId && entry.kind !== 'system')
      .slice(-10)
      .map((entry) => ({ author: entry.kind === 'band' ? 'band' : entry.author, text: entry.text }));
    const versions = store.versions(this.id, 10);
    const counts = store.reactions(this.id);
    const reactions = versions
      .filter((v) => counts[v.n])
      .map((v) => `v${v.n}: ${Object.entries(counts[v.n]).map(([r, c]) => `${REACTION_EMOJI[r as keyof typeof REACTION_EMOJI]} ${c}`).join(', ')}`);
    const context: TurnContext = {
      song: this.song,
      history: versions.map((v) => ({ version: v.n, author: v.author, summary: v.summary })),
      recentChat,
      newMessages: batch.map((p) => ({ author: p.author, text: p.text })),
      reactions,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
    const started = this.deps.now();
    try {
      const outcome = await this.deps.runTurn(context, (n) => store.song(this.id, n), controller.signal);
      const costUsd = outcome.attempts.reduce((sum, a) => sum + a.costUsd, 0);
      store.logTurn(this.id, { messages: context.newMessages, outcome, costUsd, latencyMs: this.deps.now() - started });
      return outcome;
    } finally {
      clearTimeout(timeout);
    }
  }

  private publish(outcome: AgentOutcome, author: string) {
    const now = this.deps.now();
    const song = outcome.song;
    const version = this.deps.store.addVersion(this.id, song, author, outcome.turn?.summary ?? '', now);
    if (song.bpm !== this.song.bpm) {
      this.clock = { cycle: cycleAt(this.clock, now), serverMs: now, cps: cpsFromBpm(song.bpm) };
    }
    this.song = song;
    const when = outcome.turn?.when ?? 'now';
    let applyAt: number | null = null;
    if (when !== 'now') {
      const cycle = cycleAt(this.clock, now + TRANSITION_LEAD_MS);
      applyAt = when === 'next_bar' ? Math.ceil(cycle) : Math.ceil(cycle / 4) * 4;
    }
    this.broadcast({ type: 'song', seq: 0, song, version, clock: this.clock, applyAt });
  }

  private strike(batch: Pending[]) {
    const now = this.deps.now();
    for (const clientId of new Set(batch.map((p) => p.clientId))) {
      const limits = this.limitsOf(clientId);
      limits.strikes++;
      if (limits.strikes >= MAX_STRIKES) {
        limits.strikes = 0;
        limits.blockedUntil = now + BLOCK_MS;
      }
    }
  }

  private bandSays(text: string) {
    const entry = this.deps.store.addChat(this.id, 'band', 'band', text, false, this.deps.now());
    this.broadcast({ type: 'chat', seq: 0, entry });
  }

  private setAgent(status: AgentState['status']) {
    const next = { status, queue: this.pending.length };
    if (next.status === this.agent.status && next.queue === this.agent.queue) return;
    this.agent = next;
    this.broadcast({ type: 'agent', seq: 0, agent: next });
  }

  private sendSnapshot(socket: Socket, client: Client) {
    const { store } = this.deps;
    this.sendTo(socket, {
      type: 'snapshot',
      seq: this.seq,
      room: this.id,
      you: client.user,
      song: this.song,
      versions: store.versions(this.id),
      chat: store.chat(this.id),
      users: this.users(),
      agent: this.agent,
      reactions: store.reactions(this.id),
      mine: store.reactionsOf(this.id, client.clientId),
      clock: this.clock,
    });
  }

  private users(): User[] {
    return [...this.clients.values()].filter((c): c is Client => c !== null).map((c) => c.user);
  }

  private limitsOf(clientId: string): Limits {
    let limits = this.limits.get(clientId);
    if (!limits) this.limits.set(clientId, (limits = { chatTimes: [], strikes: 0, blockedUntil: 0 }));
    return limits;
  }

  private allowSocketMessage(socket: Socket): boolean {
    const now = this.deps.now();
    const window = this.socketWindows.get(socket);
    if (!window || now - window.start > 10_000) {
      this.socketWindows.set(socket, { start: now, count: 1 });
      return true;
    }
    return ++window.count <= SOCKET_MESSAGES_PER_10S;
  }

  // Every room event gets the next sequence number, so a client can see a gap.
  private broadcast(message: ServerMessage & { seq: number }) {
    message.seq = ++this.seq;
    const data = JSON.stringify(message);
    for (const [socket, client] of this.clients) if (client) socket.send(data);
  }

  private sendTo(socket: Socket, message: ServerMessage) {
    socket.send(JSON.stringify(message));
  }

  // Exposed for tests.
  get state(): { song: Song; agent: AgentState; clock: RoomClock; chat: ChatEntry[] } {
    return { song: this.song, agent: this.agent, clock: this.clock, chat: this.deps.store.chat(this.id) };
  }
}
