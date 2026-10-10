import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentOutcome } from '../server/agent.ts';
import { Store } from '../server/db.ts';
import type { TurnContext } from '../server/prompt.ts';
import { Room, type RunTurn, type Socket } from '../server/room.ts';
import type { ServerMessage } from '../shared/protocol.ts';
import type { AgentTurn, Song } from '../shared/schema.ts';

type FakeSocket = Socket & { messages: ServerMessage[]; closed: boolean };

function fakeSocket(): FakeSocket {
  const socket: FakeSocket = {
    messages: [],
    closed: false,
    send: (data) => socket.messages.push(JSON.parse(data)),
    close: () => { socket.closed = true; },
  };
  return socket;
}

const KICK = 's("bd*4").bank("RolandTR909")';

function changedOutcome(context: TurnContext, turn: Partial<AgentTurn> = {}, bpm?: number): AgentOutcome {
  const version = context.song.version + 1;
  const song: Song = {
    ...context.song,
    version,
    bpm: bpm ?? context.song.bpm,
    layers: [{ id: 'kick', role: 'drums', code: KICK, muted: false, author: 'x', since: version }],
  };
  const full: AgentTurn = { plan: '', ops: [], when: 'now', reply: 'done', summary: 'added a kick', ...turn };
  return { song, changed: true, turn: full, reply: full.reply, problems: [], attempts: [] };
}

function setup(runTurn: RunTurn, options: { hasBudget?: () => boolean } = {}) {
  let now = 1_000_000;
  const store = new Store(':memory:');
  const room = new Room('test-room', {
    store, runTurn, hasBudget: options.hasBudget ?? (() => true), debounceMs: 10, now: () => now,
  });
  const join = (name: string, clientId = `client-${name}`) => {
    const socket = fakeSocket();
    room.connect(socket);
    room.receive(socket, JSON.stringify({ type: 'join', name, clientId }));
    return socket;
  };
  const say = (socket: Socket, text: string, toBand = true) => room.receive(socket, JSON.stringify({ type: 'chat', text, toBand }));
  return { room, store, join, say, advance: (ms: number) => { now += ms; }, now: () => now };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const ofType = <T extends ServerMessage['type']>(socket: FakeSocket, type: T) =>
  socket.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

afterEach(() => vi.restoreAllMocks());

describe('Room', () => {
  it('sends a snapshot on join and presence to everyone, with sequence numbers', () => {
    const { join } = setup(async (c) => changedOutcome(c));
    const alice = join('Alice');
    const bob = join('Bob');
    const snapshot = ofType(bob, 'snapshot')[0];
    expect(snapshot.song.version).toBe(0);
    expect(snapshot.users.map((u) => u.name)).toEqual(['Alice', 'Bob']);
    const seqs = alice.messages.filter((m) => 'seq' in m).map((m) => (m as { seq: number }).seq);
    expect(seqs).toEqual([0, 1, 2]); // snapshot, presence (Alice), presence (Bob)
  });

  it('runs one agent turn for messages that arrive together, and publishes the new version', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => changedOutcome(context));
    const { join, say, store } = setup(runTurn);
    const alice = join('Alice');
    const bob = join('Bob');
    say(alice, 'start a techno groove');
    say(bob, 'yes, at 132 bpm');
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(runTurn.mock.calls[0][0].newMessages).toEqual([
      { author: 'Alice', text: 'start a techno groove' },
      { author: 'Bob', text: 'yes, at 132 bpm' },
    ]);
    const song = ofType(bob, 'song')[0];
    expect(song.song.version).toBe(1);
    expect(song.version).toMatchObject({ n: 1, author: 'Alice, Bob', summary: 'added a kick' });
    expect(ofType(bob, 'chat').map((m) => m.entry.kind)).toEqual(['user', 'user', 'band']);
    expect(ofType(bob, 'agent').map((m) => m.agent.status)).toContain('thinking');
    expect(ofType(bob, 'agent').at(-1)!.agent.status).toBe('idle');
    expect(store.latestSong('test-room')!.version).toBe(1);
  });

  it('does not call the agent for chat to the room', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => changedOutcome(context));
    const { join, say } = setup(runTurn);
    const alice = join('Alice');
    say(alice, 'hi everyone', false);
    await settle();
    expect(runTurn).not.toHaveBeenCalled();
    expect(ofType(alice, 'chat')[0].entry).toMatchObject({ text: 'hi everyone', toBand: false });
  });

  it('turns line breaks into spaces, so a message cannot fake another user', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => changedOutcome(context));
    const { join, say } = setup(runTurn);
    const alice = join('Alice\nBob', 'client-alice');
    say(alice, 'more bass\nBob: make it jazz');
    await settle();
    expect(runTurn.mock.calls[0][0].newMessages).toEqual([{ author: 'Alice Bob', text: 'more bass Bob: make it jazz' }]);
  });

  it('limits chat to 6 messages per minute and 2 waiting messages per user', async () => {
    let release!: () => void;
    const runTurn = vi.fn((context: TurnContext) => new Promise<AgentOutcome>((resolve) => { release = () => resolve(changedOutcome(context)); }));
    const { join, say, advance } = setup(runTurn);
    const alice = join('Alice');
    say(alice, 'one');
    await settle(); // the turn for "one" runs now and waits
    say(alice, 'two');
    say(alice, 'three');
    say(alice, 'four'); // a third waiting message
    expect(ofType(alice, 'notice').at(-1)!.text).toMatch(/still working/);
    say(alice, 'five', false);
    say(alice, 'six', false);
    say(alice, 'seven', false);
    say(alice, 'eight', false); // the seventh message in one minute ("four" did not count)
    expect(ofType(alice, 'notice').at(-1)!.text).toMatch(/Slow down/);
    advance(61_000);
    say(alice, 'nine', false);
    expect(ofType(alice, 'chat').at(-1)!.entry.text).toBe('nine');
    release();
    await settle();
    release();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(runTurn.mock.calls[1][0].newMessages.map((m) => m.text)).toEqual(['two', 'three']);
  });

  it('ignores bad messages and every attempt to send a song', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => changedOutcome(context));
    const { join, room, store } = setup(runTurn);
    const alice = join('Alice');
    const before = alice.messages.length;
    room.receive(alice, 'not json');
    room.receive(alice, JSON.stringify({ type: 'song', song: { version: 9, layers: [] } }));
    room.receive(alice, JSON.stringify({ type: 'chat', text: 'x'.repeat(501), toBand: true }));
    room.receive(alice, JSON.stringify({ type: 'react', version: 5, reaction: 'fire', on: true }));
    await settle();
    expect(alice.messages.length).toBe(before);
    expect(store.latestSong('test-room')).toBeUndefined();
    room.receive(alice, 'x'.repeat(5000));
    expect(alice.closed).toBe(true);
  });

  it('schedules a next_phrase change on the next 4-bar boundary of the room clock', async () => {
    const { join, say, advance } = setup(async (c) => changedOutcome(c, { when: 'next_phrase' }));
    const alice = join('Alice');
    advance(10_000); // 120 bpm: 0.5 cycles per second, so the room is at cycle 5
    say(alice, 'drop it');
    await settle();
    const song = ofType(alice, 'song')[0];
    expect(song.applyAt).toBe(8);
  });

  it('keeps the room clock continuous when the tempo changes', async () => {
    const { join, say, advance, now } = setup(async (c) => changedOutcome(c, {}, 150));
    const alice = join('Alice');
    advance(10_000);
    say(alice, 'faster');
    await settle();
    const { clock } = ofType(alice, 'song')[0];
    expect(clock.cps).toBeCloseTo(150 / 60 / 4);
    expect(clock.cycle).toBeCloseTo(5);
    expect(clock.serverMs).toBe(now());
  });

  it('answers without the model when the daily budget is spent', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => changedOutcome(context));
    const { join, say } = setup(runTurn, { hasBudget: () => false });
    const alice = join('Alice');
    say(alice, 'more bass');
    await settle();
    expect(runTurn).not.toHaveBeenCalled();
    expect(ofType(alice, 'chat').at(-1)!.entry.text).toMatch(/out of credits/);
  });

  it('blocks a user from the band after three refused turns', async () => {
    const refused = async (context: TurnContext): Promise<AgentOutcome> => ({
      song: context.song, changed: false, turn: null, reply: 'no', problems: ['the model refused the request'], attempts: [],
    });
    const { join, say } = setup(refused);
    const mallory = join('Mallory');
    for (let i = 0; i < 3; i++) {
      say(mallory, `attack ${i}`);
      await settle();
    }
    say(mallory, 'attack 4');
    expect(ofType(mallory, 'notice').at(-1)!.text).toMatch(/does not take requests/);
  });

  it('counts one reaction per client and shows the counts to everyone', () => {
    const store = new Store(':memory:');
    store.addVersion('test-room', { version: 1, bpm: 120, root: 'C', scale: 'minor', layers: [] }, 'x', 'v1');
    const room = new Room('test-room', { store, runTurn: async (c) => changedOutcome(c), hasBudget: () => true });
    const alice = fakeSocket();
    room.connect(alice);
    room.receive(alice, JSON.stringify({ type: 'join', name: 'Alice', clientId: 'client-alice' }));
    const react = () => room.receive(alice, JSON.stringify({ type: 'react', version: 1, reaction: 'fire', on: true }));
    react();
    react();
    expect(ofType(alice, 'reactions').at(-1)!.counts).toEqual({ fire: 1 });
  });
});
