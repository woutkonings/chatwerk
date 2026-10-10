// One Room actor per room. It keeps the clients, the chat, the song and the
// live set, and it runs one agent turn at a time. Chat messages for the band
// collect for a short time, so one turn can answer several users. When nobody
// asks for anything, the autopilot asks the band for a small mutation, and it
// moves the set to the next phase when the time is up. Only an agent turn
// writes a new song version; clients can only chat, react, ping and switch the
// autopilot.
import type { AgentOutcome } from './agent.ts';
import type { Store } from './db.ts';
import { pickMutation, type MutationKind, type TurnMode } from './harness.ts';
import type { TurnContext } from './prompt.ts';
import { pickSuggestions } from './suggest.ts';
import type { CheckResult } from '../shared/check.ts';
import { applyOps } from '../shared/song.ts';
import { MAX_SUGGESTIONS, SUGGESTION_COOLDOWN_BARS, type Suggestion, type SuggestionKind, type SuggestionState } from '../shared/suggest.ts';
import {
  ClientMessage, REACTION_EMOJI, clockAt, cpsFromBpm, roomCycle, timeAtCycle,
  type AgentState, type ChatEntry, type MixReport, type ServerMessage, type Timeline, type User,
} from '../shared/protocol.ts';
import { EMPTY_SONG, type Song } from '../shared/schema.ts';
import { DEFAULT_ARC, PHASE_LABEL, jumpTo, nextPhase, setPosition, type SetState } from '../shared/set.ts';
import { changeFor, type LayerChange } from '../shared/transition.ts';

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
// The autopilot asks for a mutation after this many bars without a change (about a minute).
export const MUTATION_BARS = 32;
// The autopilot rests when nobody chatted, reacted, applied an idea or joined for this long,
// so a forgotten open tab does not spend the model budget.
export const AUTOPILOT_IDLE_MS = 30 * 60_000;
// After a failed autopilot turn (for example no network), the autopilot waits, longer each time.
const BACKOFF_START_MS = 2 * 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

// Filters, swing, phase moves and muting cannot break the song check, so their ideas skip it.
function needsCheck(ops: Suggestion['ops']): boolean {
  return ops.some((op) => !(op.op === 'automate' || op.op === 'set_swing' || op.op === 'set_phase' || (op.op === 'set_layer' && op.muted)));
}

// What survives a server restart, next to the song versions.
type RoomMemory = { clocks: Timeline; set: SetState | null; autopilot: boolean; report: MixReport | null; lastChange: number };

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
  checkSong?: (song: Song) => Promise<CheckResult>; // the song check for suggestions; without it, every idea passes
  debounceMs?: number;
  now?: () => number;
};

type Client = { user: User; clientId: string };
type Pending = { chatId: number; clientId: string; author: string; text: string };
type Limits = { chatTimes: number[]; strikes: number; blockedUntil: number };

let nextUserId = 1;

export class Room {
  readonly id: string;
  private deps: Required<Omit<RoomDeps, 'checkSong'>> & Pick<RoomDeps, 'checkSong'>;
  private clients = new Map<Socket, Client | null>(); // null until the client joins
  private socketWindows = new Map<Socket, { start: number; count: number }>();
  private limits = new Map<string, Limits>(); // per client id, so a reconnect keeps them
  private song: Song;
  private clocks: Timeline;
  private seq = 0;
  private pending: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private agent: AgentState = { status: 'idle', queue: 0 };
  private set: SetState | null;
  private autopilot: boolean;
  private report: MixReport | null;
  private lastChange: number; // the room cycle of the last change or autopilot turn
  private mutations: MutationKind[] = []; // the kinds of the last autopilot mutations
  private followUp: TurnMode | null = null; // a phase transition turn after a bare set_phase
  private suggestions: Suggestion[] = [];
  private suggestionsVersion = -1; // the song version of the ideas
  private refreshToken = 0;
  private lastIdeaAt = Number.NEGATIVE_INFINITY; // the room cycle of the last applied idea
  private lastApplied: SuggestionState['lastApplied'] = null;
  private appliedKinds: SuggestionKind[] = [];
  private lastActivity: number; // server time of the last user action
  private backoffUntil = 0; // server time until which the autopilot waits after a failure
  private backoffMs = BACKOFF_START_MS;

  constructor(id: string, deps: RoomDeps) {
    this.id = id;
    this.deps = { debounceMs: 1500, now: Date.now, ...deps };
    this.song = deps.store.latestSong(id) ?? EMPTY_SONG;
    const memory = deps.store.roomState<RoomMemory>(id);
    // The stored clock keeps counting, so the set position survives a restart.
    this.clocks = memory?.clocks.length ? memory.clocks : [{ cycle: 0, serverMs: this.deps.now(), cps: cpsFromBpm(this.song.bpm) }];
    this.set = memory?.set ?? null;
    this.autopilot = memory?.autopilot ?? true;
    this.report = memory?.report ?? null;
    this.lastChange = memory?.lastChange ?? 0;
    this.lastActivity = this.deps.now();
  }

  private remember() {
    const memory: RoomMemory = { clocks: this.clocks, set: this.set, autopilot: this.autopilot, report: this.report, lastChange: this.lastChange };
    this.deps.store.saveRoomState(this.id, memory, this.deps.now());
  }

  // Called every few seconds. Moves the set to the next phase when its time is
  // up, and asks the band for a mutation when nothing changed for a while.
  tick() {
    if (!this.set || this.users().length === 0) return;
    const now = this.deps.now();
    const waiting = now < this.backoffUntil;
    const cycle = roomCycle(this.clocks, now);
    const position = setPosition(this.set, cycle);
    if (position.barsLeft <= 0) {
      this.set = nextPhase(this.set, Math.ceil(cycle));
      this.remember();
      this.broadcast({ type: 'set', seq: 0, set: this.set });
      void this.refreshSuggestions();
      const to = this.set.arc[this.set.index].kind;
      const resting = now - this.lastActivity > AUTOPILOT_IDLE_MS;
      if (this.autopilot && !resting && !waiting && !this.busy) this.autopilotTurn({ kind: 'phase', from: PHASE_LABEL[position.phase.kind], to: PHASE_LABEL[to] }, cycle);
      return;
    }
    const resting = now - this.lastActivity > AUTOPILOT_IDLE_MS;
    if (this.autopilot && !resting && !waiting && !this.busy && cycle - this.lastChange >= MUTATION_BARS) {
      const mutation = pickMutation(this.song, this.mutations, position.phase.kind);
      this.mutations = [...this.mutations, mutation.kind].slice(-6);
      this.autopilotTurn({ kind: 'mutation', idea: mutation.idea }, cycle);
    }
  }

  private autopilotTurn(mode: TurnMode, cycle: number) {
    if (!this.deps.hasBudget() || this.song.layers.length === 0) return;
    this.lastChange = cycle;
    void this.runTurn(mode);
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
    if (message.type !== 'ping' && message.type !== 'resync') this.lastActivity = this.deps.now();

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
      if (this.suggestionsVersion !== this.song.version) void this.refreshSuggestions();
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
        void this.refreshSuggestions(); // the favourite version may change
        return;
      }
      case 'apply':
        void this.applySuggestion(socket, client, message.id);
        return;
      case 'vote':
        return; // vote mode is on the roadmap; instant mode ignores votes
      case 'autopilot': {
        if (message.on === this.autopilot) return;
        this.autopilot = message.on;
        this.lastChange = roomCycle(this.clocks, this.deps.now());
        this.remember();
        this.broadcast({ type: 'autopilot', seq: 0, on: message.on, by: client.user.name });
        this.systemSays(`${client.user.name} turned the autopilot ${message.on ? 'on' : 'off'}.`);
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

  // A turn answers the waiting messages, or (with an autopilot mode) nobody.
  private async runTurn(mode: TurnMode = { kind: 'request' }) {
    this.running = true;
    const batch = mode.kind === 'request' ? this.pending.splice(0, MAX_BATCH) : [];
    this.setAgent('thinking');
    try {
      if (!this.deps.hasBudget()) {
        if (mode.kind === 'request') this.bandSays('The band is out of credits for today. The song keeps playing.');
        return;
      }
      const outcome = await this.ask(batch, mode);
      if (mode.kind !== 'request') this.backoffMs = BACKOFF_START_MS; // the autopilot works again
      const author = mode.kind === 'request' ? [...new Set(batch.map((p) => p.author))].join(', ') : 'autopilot';
      if (outcome.changed) this.publish(outcome, author);
      this.applyPhaseOps(outcome);
      this.bandSays(outcome.reply);
      if (outcome.problems.includes('the model refused the request')) this.strike(batch);
    } catch (error) {
      console.error(`room ${this.id}: agent turn failed`, error);
      if (mode.kind === 'request') this.bandSays('The band lost the thread. Please try again.');
      else {
        // Nobody asked for an autopilot turn, so the chat stays quiet; the autopilot waits.
        this.backoffUntil = this.deps.now() + this.backoffMs;
        this.backoffMs = Math.min(BACKOFF_MAX_MS, this.backoffMs * 2);
      }
    } finally {
      this.running = false;
      this.setAgent(this.pending.length ? 'waiting' : 'idle');
      const followUp = this.followUp;
      this.followUp = null;
      // A new user message comes first; otherwise the band makes the phase transition.
      if (followUp && this.pending.length === 0 && this.timer === null) void this.runTurn(followUp);
      else this.schedule();
    }
  }

  private async ask(batch: Pending[], mode: TurnMode): Promise<AgentOutcome> {
    const { store } = this.deps;
    const firstId = batch[0]?.chatId ?? Number.POSITIVE_INFINITY;
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
      newMessages: batch.length ? batch.map((p) => ({ author: p.author, text: p.text })) : [{ author: 'autopilot', text: '(no request: see the autopilot rule)' }],
      reactions,
      set: this.set ? setPosition(this.set, roomCycle(this.clocks, this.deps.now())) : null,
      report: this.report,
      mode,
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

  // Publishes a new version. The changes start at a boundary in room cycles that
  // every client reaches at the same time. A tempo change lands on a bar line.
  private publish(outcome: AgentOutcome, author: string) {
    const now = this.deps.now();
    this.pruneClocks(now);
    const cycle = roomCycle(this.clocks, now + TRANSITION_LEAD_MS);
    const when = outcome.turn?.when ?? 'now';
    const applyAt = when === 'now' ? cycle : when === 'next_bar' ? Math.ceil(cycle) : Math.ceil(cycle / 4) * 4;
    // New automations start a number of bars after the boundary.
    const song: Song = {
      ...outcome.song,
      layers: outcome.song.layers.map((layer) => (layer.automation?.some((a) => a.start !== undefined)
        ? { ...layer, automation: layer.automation.map(({ start, ...a }) => (start === undefined ? a : { ...a, at: applyAt + start })) }
        : layer)),
    };
    const version = this.deps.store.addVersion(this.id, song, author, outcome.turn?.summary ?? '', now);
    if (song.bpm !== this.song.bpm) {
      const tempoAt = when === 'now' ? Math.ceil(cycle) : applyAt;
      this.clocks = this.clocks.filter((clock, i) => i === 0 || clock.cycle < tempoAt);
      const base = this.clocks.at(-1)!;
      this.clocks.push({ cycle: tempoAt, serverMs: timeAtCycle(base, tempoAt), cps: cpsFromBpm(song.bpm) });
    }
    const changes: Record<string, LayerChange> = {};
    for (const op of outcome.turn?.ops ?? []) {
      if (op.op === 'set_layer' || op.op === 'remove_layer' || op.op === 'vary') changes[op.id] = changeFor(op.timing, applyAt);
    }
    this.song = song;
    if (outcome.report) this.report = outcome.report;
    this.lastChange = Math.max(this.lastChange, applyAt);
    this.broadcast({ type: 'song', seq: 0, song, version, clocks: this.clocks, applyAt, changes, report: this.report });
    // The first song starts the live set.
    if (!this.set) {
      this.set = { arc: DEFAULT_ARC.map((phase) => ({ ...phase })), index: 0, phaseStart: Math.floor(applyAt) };
      this.broadcast({ type: 'set', seq: 0, set: this.set });
    }
    this.remember();
    void this.refreshSuggestions();
  }

  // Makes new ideas for the current song, checks them, and shows the first that pass.
  async refreshSuggestions() {
    const token = ++this.refreshToken;
    const song = this.song;
    if (song.layers.length === 0) return;
    const counts = this.deps.store.reactions(this.id);
    let favourite: { version: number; count: number } | null = null;
    for (const [version, perReaction] of Object.entries(counts)) {
      const count = (perReaction.fire ?? 0) + (perReaction.dance ?? 0);
      if (count > (favourite?.count ?? 0)) favourite = { version: Number(version), count };
    }
    const position = this.set ? setPosition(this.set, roomCycle(this.clocks, this.deps.now())) : null;
    const picked = pickSuggestions({ song, position, report: this.report, favourite, recentKinds: this.appliedKinds });
    const passed: Suggestion[] = [];
    for (const candidate of picked) {
      if (passed.length >= MAX_SUGGESTIONS) break;
      const { song: next, errors } = applyOps(song, candidate.ops, 'idea', (n) => this.deps.store.song(this.id, n));
      if (errors.length || next === song && !candidate.ops.some((op) => op.op === 'set_phase')) continue;
      const check = next === song || !this.deps.checkSong || !needsCheck(candidate.ops) ? null : await this.deps.checkSong(next);
      if (token !== this.refreshToken) return; // a newer refresh runs
      if (check && check.issues.length) continue;
      passed.push({ ...candidate, id: `s${song.version}-${passed.length + 1}`, votes: 0 });
    }
    if (token !== this.refreshToken) return;
    this.suggestions = passed;
    this.suggestionsVersion = song.version;
    this.broadcast({ type: 'suggestions', seq: 0, suggestions: this.suggestionView() });
  }

  private suggestionView(): SuggestionState {
    return {
      version: this.suggestionsVersion, mode: 'instant', needed: 1,
      items: this.suggestions.map(({ id, kind, label, detail, votes }) => ({ id, kind, label, detail, votes })),
      lastApplied: this.lastApplied,
      cooldownUntil: Number.isFinite(this.lastIdeaAt) ? this.lastIdeaAt + SUGGESTION_COOLDOWN_BARS : 0,
    };
  }

  // Instant mode: the first click applies the idea at the next phrase. No model call.
  private async applySuggestion(socket: Socket, client: Client, id: string) {
    const suggestion = this.suggestions.find((s) => s.id === id);
    if (!suggestion || this.suggestionsVersion !== this.song.version) {
      this.sendTo(socket, { type: 'notice', text: 'That idea is gone. Here are new ones.' });
      void this.refreshSuggestions();
      return;
    }
    if (this.running) {
      this.sendTo(socket, { type: 'notice', text: 'The band is busy with a change. Try again in a moment.' });
      return;
    }
    const cycle = roomCycle(this.clocks, this.deps.now());
    const wait = Math.ceil(this.lastIdeaAt + SUGGESTION_COOLDOWN_BARS - cycle);
    if (wait > 0) {
      this.sendTo(socket, { type: 'notice', text: `Wait ${wait} bar${wait === 1 ? '' : 's'}: the last idea lands first.` });
      return;
    }
    const before = this.song;
    const { song, errors } = applyOps(before, suggestion.ops, client.user.name, (n) => this.deps.store.song(this.id, n));
    const check = song !== before && this.deps.checkSong ? await this.deps.checkSong(song) : null;
    if (errors.length || (check && check.issues.length) || this.song !== before) {
      this.sendTo(socket, { type: 'notice', text: 'That idea does not fit the song any more.' });
      void this.refreshSuggestions();
      return;
    }
    this.lastIdeaAt = cycle;
    this.appliedKinds = [...this.appliedKinds, suggestion.kind].slice(-4);
    this.systemSays(`${client.user.name} applied the idea: ${suggestion.label}.`);
    const turn = { plan: '', ops: suggestion.ops, when: suggestion.when, reply: '', summary: suggestion.label };
    const outcome: AgentOutcome = {
      song, changed: song !== before, turn, reply: '', problems: [], attempts: [], harness: [], report: check?.report ?? null,
    };
    const cycleNow = roomCycle(this.clocks, this.deps.now() + TRANSITION_LEAD_MS);
    this.lastApplied = { label: suggestion.label, by: client.user.name, at: suggestion.when === 'next_phrase' ? Math.ceil(cycleNow / 4) * 4 : cycleNow };
    if (outcome.changed) this.publish(outcome, client.user.name);
    this.applyPhaseOps(outcome);
    if (!outcome.changed) void this.refreshSuggestions();
    // A bare phase idea needs the band for the transition.
    const followUp = this.followUp;
    this.followUp = null;
    if (followUp && !this.running) void this.runTurn(followUp);
  }

  // set_phase moves the live set, also when the song itself did not change.
  // Without layer changes in the same turn, a follow-up turn makes the transition.
  private applyPhaseOps(outcome: AgentOutcome) {
    const op = outcome.turn?.ops.find((o) => o.op === 'set_phase');
    if (!op || op.op !== 'set_phase' || !this.set) return;
    const from = PHASE_LABEL[this.set.arc[this.set.index].kind];
    const cycle = roomCycle(this.clocks, this.deps.now() + TRANSITION_LEAD_MS);
    this.set = jumpTo(this.set, op.kind, Math.ceil(cycle / 4) * 4);
    this.remember();
    this.broadcast({ type: 'set', seq: 0, set: this.set });
    void this.refreshSuggestions();
    const layerOps = outcome.turn!.ops.some((o) => ['set_layer', 'remove_layer', 'vary', 'automate'].includes(o.op));
    if (!layerOps) this.followUp = { kind: 'phase', from, to: PHASE_LABEL[op.kind] };
  }

  // Keeps the active clock segment and the segments that start later.
  private pruneClocks(now: number) {
    const active = clockAt(this.clocks, now);
    this.clocks = this.clocks.filter((clock) => clock === active || clock.serverMs > now);
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

  private systemSays(text: string) {
    const entry = this.deps.store.addChat(this.id, 'room', 'system', text, false, this.deps.now());
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
      clocks: this.clocks,
      set: this.set,
      autopilot: this.autopilot,
      report: this.report,
      suggestions: this.suggestionsVersion === -1 ? null : this.suggestionView(),
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
  get state(): { song: Song; agent: AgentState; clocks: Timeline; chat: ChatEntry[] } {
    return { song: this.song, agent: this.agent, clocks: this.clocks, chat: this.deps.store.chat(this.id) };
  }
}
