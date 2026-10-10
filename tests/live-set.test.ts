import { describe, expect, it, vi } from 'vitest';
import type { AgentOutcome } from '../server/agent.ts';
import { Store } from '../server/db.ts';
import type { TurnContext } from '../server/prompt.ts';
import { MUTATION_BARS, Room, type Socket } from '../server/room.ts';
import type { ServerMessage } from '../shared/protocol.ts';
import type { AgentTurn, Song } from '../shared/schema.ts';
import { DEFAULT_ARC, jumpTo, nextPhase, setPosition, type SetState } from '../shared/set.ts';

describe('set model', () => {
  const set: SetState = { arc: DEFAULT_ARC, index: 0, phaseStart: 8 };

  it('gives the phase, the bars left and the energy target on the way', () => {
    const position = setPosition(set, 8 + 128);
    expect(position).toMatchObject({ index: 0, barsIn: 128, barsLeft: 128, energy: 5.3 });
    expect(position.next?.kind).toBe('build');
  });

  it('moves to the next phase, and loops into a journey after the last one', () => {
    expect(nextPhase(set, 300)).toMatchObject({ index: 1, phaseStart: 300 });
    const last = { ...set, index: DEFAULT_ARC.length - 1 };
    const looped = nextPhase(last, 5000);
    expect(looped.arc.at(-1)?.kind).toBe('journey');
    expect(looped.index).toBe(DEFAULT_ARC.length);
  });

  it('jumps to the next phase of a kind, or inserts one', () => {
    expect(jumpTo(set, 'peak', 100)).toMatchObject({ index: 2, phaseStart: 100 });
    const atEnd = { ...set, index: DEFAULT_ARC.length - 1 };
    const inserted = jumpTo(atEnd, 'breakdown', 100);
    expect(inserted.arc[inserted.index].kind).toBe('breakdown');
  });
});

type FakeSocket = Socket & { messages: ServerMessage[] };
const fakeSocket = (): FakeSocket => {
  const socket: FakeSocket = { messages: [], send: (data) => socket.messages.push(JSON.parse(data)), close: () => undefined };
  return socket;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));

function outcome(context: TurnContext, ops: AgentTurn['ops'] = []): AgentOutcome {
  const version = context.song.version + 1;
  const song: Song = {
    ...context.song, version,
    layers: [{ id: 'kick', role: 'drums', code: 's("bd*4")', muted: false, author: 'x', since: version }],
  };
  const turn: AgentTurn = { plan: '', ops, when: 'next_phrase', reply: 'ok', summary: 'change' };
  return { song, changed: true, turn, reply: 'ok', problems: [], attempts: [], harness: [], report: { energy: 5, lines: [] } };
}

function setup(runTurn: (context: TurnContext) => Promise<AgentOutcome>) {
  let now = 1_000_000;
  const store = new Store(':memory:');
  const deps = { store, runTurn, hasBudget: () => true, debounceMs: 5, now: () => now };
  const room = new Room('set-room', deps);
  const socket = fakeSocket();
  room.connect(socket);
  room.receive(socket, JSON.stringify({ type: 'join', name: 'Wout', clientId: 'client-wout' }));
  const say = (text: string) => room.receive(socket, JSON.stringify({ type: 'chat', text, toBand: true }));
  return { room, store, deps, socket, say, advance: (ms: number) => { now += ms; } };
}

const ofType = <T extends ServerMessage['type']>(socket: FakeSocket, type: T) =>
  socket.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

describe('live set in the room', () => {
  it('starts the set with the first song, and gives the band the phase and the report', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => outcome(context));
    const { say, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    const set = ofType(socket, 'set')[0].set;
    expect(set).toMatchObject({ index: 0, phaseStart: 4 });
    say('more');
    await settle();
    expect(runTurn.mock.calls[1][0].set).toMatchObject({ index: 0, phase: { kind: 'warmup' } });
    expect(runTurn.mock.calls[1][0].report).toEqual({ energy: 5, lines: [] });
  });

  it('asks the band for a mutation after a quiet time, only with the autopilot on', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => outcome(context));
    const { room, say, advance, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    room.tick();
    expect(runTurn).toHaveBeenCalledTimes(1);
    advance(((MUTATION_BARS + 8) / 0.5) * 1000); // 120 bpm: 0.5 bars per second
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(runTurn.mock.calls[1][0].mode).toMatchObject({ kind: 'mutation', idea: expect.stringContaining('new layer') }); // only a kick: add something
    room.receive(socket, JSON.stringify({ type: 'autopilot', on: false }));
    advance(((MUTATION_BARS + 8) / 0.5) * 1000);
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(ofType(socket, 'autopilot')[0]).toMatchObject({ on: false, by: 'Wout' });
  });

  it('moves to the next phase when the time is up, and lets the band make the transition', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => outcome(context));
    const { room, say, advance, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    advance(((DEFAULT_ARC[0].bars + 8) / 0.5) * 1000);
    room.tick();
    await settle();
    expect(ofType(socket, 'set').at(-1)!.set.index).toBe(1);
    expect(runTurn.mock.calls.at(-1)![0].mode).toEqual({ kind: 'phase', from: 'Warm-up', to: 'Build' });
  });

  it('moves the set when the band uses set_phase, and follows up with the transition', async () => {
    const runTurn = vi.fn(async (context: TurnContext) =>
      outcome(context, context.song.layers.length && context.mode?.kind === 'request' ? [{ op: 'set_phase', kind: 'peak' }] : []));
    const { say, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    say('go to the peak');
    await settle();
    expect(ofType(socket, 'set').at(-1)!.set.index).toBe(2);
    expect(runTurn.mock.calls.at(-1)![0].mode).toEqual({ kind: 'phase', from: 'Warm-up', to: 'Peak' });
  });

  it('keeps the clock and the set after a restart', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => outcome(context));
    const { say, deps, advance } = setup(runTurn);
    say('start a groove');
    await settle();
    advance(60_000);
    const again = new Room('set-room', deps);
    const socket = fakeSocket();
    again.connect(socket);
    again.receive(socket, JSON.stringify({ type: 'join', name: 'Wout', clientId: 'client-wout' }));
    const snapshot = ofType(socket, 'snapshot')[0];
    expect(snapshot.set).toMatchObject({ index: 0, phaseStart: 4 });
    expect(snapshot.clocks[0].serverMs).toBe(1_000_000);
    expect(snapshot.report).toEqual({ energy: 5, lines: [] });
  });
});

describe('autopilot rest', () => {
  it('stops mutating after 30 minutes without any user action, and starts again on the next action', async () => {
    const runTurn = vi.fn(async (context: TurnContext) => outcome(context));
    const { room, say, advance, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    advance(31 * 60_000);
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(1); // only the first request
    room.receive(socket, JSON.stringify({ type: 'react', version: 1, reaction: 'fire', on: true }));
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
  });
});

describe('autopilot failures', () => {
  it('keeps the chat quiet after a failed autopilot turn, and waits longer each time', async () => {
    let fail = false;
    const runTurn = vi.fn(async (context: TurnContext) => {
      if (fail) throw new Error('Connection error.');
      return outcome(context);
    });
    const { room, say, advance, socket } = setup(runTurn);
    say('start a groove');
    await settle();
    fail = true;
    const chatBefore = ofType(socket, 'chat').length;
    advance(((MUTATION_BARS + 8) / 0.5) * 1000);
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(ofType(socket, 'chat').length).toBe(chatBefore); // no "lost the thread" line
    advance(60_000); // inside the first wait of 2 minutes
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(2);
    advance(90_000); // after the wait
    room.tick();
    await settle();
    expect(runTurn).toHaveBeenCalledTimes(3);
  });
});
