// The WebSocket client of one room. It keeps the room state from the server
// snapshot and the events after it. A gap in the sequence numbers means a lost
// event, so the client asks for a new snapshot. It reconnects after a drop.
import type {
  AgentState, ChatEntry, ClientMessage, MixReport, Reaction, ReactionCounts, ServerMessage, Timeline, User, VersionInfo,
} from '../../shared/protocol.ts';
import { EMPTY_SONG, type Song } from '../../shared/schema.ts';
import type { SetState } from '../../shared/set.ts';
import type { SuggestionState } from '../../shared/suggest.ts';
import type { LayerChange } from '../../shared/transition.ts';
import { ServerClock } from './server-clock.ts';

export type RoomState = {
  status: 'connecting' | 'open' | 'closed';
  you: User | null;
  song: Song;
  versions: VersionInfo[];
  chat: ChatEntry[];
  users: User[];
  agent: AgentState;
  reactions: ReactionCounts;
  mine: Set<string>; // "version:reaction"
  clocks: Timeline;
  changes: Record<string, LayerChange>; // the layer changes of the newest version
  set: SetState | null; // the live set: phases and the current phase
  autopilot: boolean;
  report: MixReport | null; // what the band hears in the newest version
  suggestions: SuggestionState | null; // ideas that any listener can apply with one click
  mineVotes: Set<string>; // vote mode (roadmap): the ideas this listener voted for
  notice: string | null;
};

export const INITIAL_STATE: RoomState = {
  status: 'connecting', you: null, song: EMPTY_SONG, versions: [], chat: [], users: [],
  agent: { status: 'idle', queue: 0 }, reactions: {}, mine: new Set(), clocks: [], changes: {}, set: null, autopilot: true, report: null, suggestions: null, mineVotes: new Set(), notice: null,
};

const MAX_CHAT = 200;

export type ConnectionEvents = {
  onState: (state: RoomState) => void;
  onSong: (song: Song, clocks: Timeline, applyAt: number | null, changes: Record<string, LayerChange>) => void;
};

export class Connection {
  readonly clock = new ServerClock();
  private socket: WebSocket | null = null;
  private state: RoomState = INITIAL_STATE;
  private seq = -1; // -1: waiting for a snapshot
  private pings = 0;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private closed = false;

  constructor(private roomId: string, private name: string, private clientId: string, private events: ConnectionEvents) {}

  open() {
    this.closed = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/${this.roomId}`);
    this.socket = socket;
    this.update({ status: 'connecting' });
    socket.onopen = () => {
      this.retry = 0;
      this.seq = -1;
      this.send({ type: 'join', name: this.name, clientId: this.clientId });
      this.pings = 0;
      this.ping();
    };
    socket.onmessage = (event) => {
      try {
        this.handle(JSON.parse(event.data as string) as ServerMessage);
      } catch (error) {
        console.error('bad server message', error);
      }
    };
    socket.onclose = () => {
      if (this.pingTimer) clearTimeout(this.pingTimer);
      this.update({ status: 'closed' });
      if (this.closed) return;
      const delay = Math.min(10_000, 1000 * 2 ** this.retry++);
      setTimeout(() => !this.closed && this.open(), delay);
    };
  }

  close() {
    this.closed = true;
    if (this.pingTimer) clearTimeout(this.pingTimer);
    this.socket?.close();
  }

  chat(text: string, toBand: boolean) {
    this.send({ type: 'chat', text, toBand });
  }

  // Our own marks change at once; the server sends the new counts to everyone.
  react(version: number, reaction: Reaction) {
    const key = `${version}:${reaction}`;
    const mine = new Set(this.state.mine);
    const on = !mine.has(key);
    if (on) mine.add(key);
    else mine.delete(key);
    this.send({ type: 'react', version, reaction, on });
    this.update({ mine });
  }

  setAutopilot(on: boolean) {
    this.send({ type: 'autopilot', on });
  }

  // Instant mode: the idea lands at the next phrase for everyone.
  applySuggestion(id: string) {
    this.send({ type: 'apply', id });
  }

  // Vote mode (roadmap): the idea lands when enough listeners vote for it.
  voteSuggestion(id: string) {
    const mineVotes = new Set(this.state.mineVotes);
    const on = !mineVotes.has(id);
    if (on) mineVotes.add(id);
    else mineVotes.delete(id);
    this.send({ type: 'vote', id, on });
    this.update({ mineVotes });
  }

  dismissNotice() {
    this.update({ notice: null });
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  // Fast pings at the start for a good clock estimate, then slow ones.
  private ping() {
    this.send({ type: 'ping', t: ServerClock.localMs() });
    this.pings++;
    this.pingTimer = setTimeout(() => this.ping(), this.pings < 8 ? 1000 : 20_000);
  }

  private handle(message: ServerMessage) {
    if (message.type === 'pong') return this.clock.addSample(message.t, message.serverMs);
    if (message.type === 'notice') return this.update({ notice: message.text });
    if (message.type === 'snapshot') {
      this.seq = message.seq;
      this.update({
        status: 'open', you: message.you, song: message.song, versions: message.versions, chat: message.chat,
        users: message.users, agent: message.agent, reactions: message.reactions, clocks: message.clocks, changes: {},
        set: message.set, autopilot: message.autopilot, report: message.report,
        suggestions: message.suggestions, mineVotes: new Set(),
        mine: new Set(message.mine.map((m) => `${m.version}:${m.reaction}`)),
      });
      this.events.onSong(message.song, message.clocks, null, {});
      return;
    }
    if (this.seq === -1) return;
    if (message.seq !== this.seq + 1) {
      this.seq = -1;
      this.send({ type: 'resync' });
      return;
    }
    this.seq = message.seq;

    switch (message.type) {
      case 'song':
        this.update({
          song: message.song, clocks: message.clocks, changes: message.changes, report: message.report,
          versions: [...this.state.versions, message.version],
        });
        this.events.onSong(message.song, message.clocks, message.applyAt, message.changes);
        return;
      case 'chat':
        this.update({ chat: [...this.state.chat, message.entry].slice(-MAX_CHAT) });
        return;
      case 'presence':
        this.update({ users: message.users });
        return;
      case 'agent':
        this.update({ agent: message.agent });
        return;
      case 'set':
        this.update({ set: message.set });
        return;
      case 'autopilot':
        this.update({ autopilot: message.on });
        return;
      case 'suggestions': {
        // Votes belong to one version of the ideas.
        const fresh = message.suggestions.version !== this.state.suggestions?.version;
        this.update({ suggestions: message.suggestions, ...(fresh ? { mineVotes: new Set<string>() } : {}) });
        return;
      }
      case 'reactions':
        this.update({ reactions: { ...this.state.reactions, [message.version]: message.counts } });
        return;
    }
  }

  private update(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch };
    this.events.onState(this.state);
  }
}
