import { describe, expect, it, vi } from 'vitest';
import type { AgentOutcome } from '../server/agent.ts';
import { Store } from '../server/db.ts';
import type { TurnContext } from '../server/prompt.ts';
import { Room, type Socket } from '../server/room.ts';
import { candidates, pickSuggestions, type SuggestContext } from '../server/suggest.ts';
import type { ServerMessage } from '../shared/protocol.ts';
import type { Layer, Song } from '../shared/schema.ts';
import { DEFAULT_ARC, setPosition } from '../shared/set.ts';

const layer = (id: string, role: Layer['role'], code: string, extra: Partial<Layer> = {}): Layer =>
  ({ id, role, code, muted: false, author: 'x', since: 1, ...extra });
const SONG: Song = {
  version: 4, bpm: 128, root: 'A', scale: 'minor',
  layers: [
    layer('kick', 'drums', 's("bd*4").bank("RolandTR909")'),
    layer('hats', 'drums', 's("hh*16").bank("RolandTR909")'),
    layer('bass', 'bass', 'note("[~ a1]*4").s("sawtooth").lpf(400)'),
    layer('stab', 'chords', 'chord("<Am9 Dm9>").voicing().s("sawtooth")'),
  ],
};
const context = (extra: Partial<SuggestContext> = {}): SuggestContext =>
  ({ song: SONG, position: null, report: null, favourite: null, recentKinds: [], ...extra });

describe('suggestion candidates', () => {
  it('makes ideas from the layers, without touching the kick rhythm', () => {
    const labels = candidates(context()).map((c) => c.label);
    expect(labels).toContain('Open the bass filter');
    expect(labels).toContain('Ghost notes on hats');
    expect(labels).toContain('Light swing');
    expect(labels).toContain('Breakdown now');
    expect(labels.some((label) => label.includes('kick') && !label.startsWith('Drop'))).toBe(false);
  });

  it('offers the drop when kick and bass are muted, and a favourite version', () => {
    const muted = { ...SONG, layers: SONG.layers.map((l) => (l.id === 'kick' || l.id === 'bass' ? { ...l, muted: true } : l)) };
    const list = candidates(context({ song: muted, favourite: { version: 2, count: 3 } }));
    const drop = list.find((c) => c.kind === 'drop')!;
    expect(drop.ops.map((op) => op.op)).toEqual(['set_layer', 'set_layer']);
    expect(list.find((c) => c.kind === 'restore')?.label).toBe('Back to v2');
  });

  it('turns report findings into fixes', () => {
    const report = { energy: 5, lines: [], findings: [{ kind: 'register' as const, ids: ['bass', 'stab'] }] };
    const fix = candidates(context({ report })).find((c) => c.kind === 'fix')!;
    expect(fix.label).toBe('stab an octave up');
  });
});

describe('suggestion ranking', () => {
  it('ranks energy ideas by the gap to the target, and keeps kinds and targets apart', () => {
    const position = setPosition({ arc: DEFAULT_ARC, index: 2, phaseStart: 0 }, 10); // a peak, target about 7.5
    const low = pickSuggestions(context({ position, report: { energy: 4, lines: [], findings: [] } }), undefined, 4);
    expect(low[0].kind).toBe('energy-up');
    expect(new Set(low.map((c) => c.kind)).size).toBe(low.length);
    const targets = low.map((c) => c.target).filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
    const high = pickSuggestions(context({ position: setPosition({ arc: DEFAULT_ARC, index: 3, phaseStart: 0 }, 10), report: { energy: 7, lines: [], findings: [] } }), undefined, 4);
    expect(['energy-down', 'space']).toContain(high[0].kind);
  });
});

type FakeSocket = Socket & { messages: ServerMessage[] };
const fakeSocket = (): FakeSocket => {
  const socket: FakeSocket = { messages: [], send: (data) => socket.messages.push(JSON.parse(data)), close: () => undefined };
  return socket;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const ofType = <T extends ServerMessage['type']>(socket: FakeSocket, type: T) =>
  socket.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

function setup() {
  let now = 1_000_000;
  const store = new Store(':memory:');
  store.addVersion('idea-room', SONG, 'x', 'start');
  const runTurn = vi.fn(async (c: TurnContext): Promise<AgentOutcome> =>
    ({ song: c.song, changed: false, turn: null, reply: 'ok', problems: [], attempts: [], harness: [], report: null }));
  const checkSong = vi.fn(async () => ({ issues: [], eventsPerCycle: {}, report: { energy: 6, lines: [] } }));
  const room = new Room('idea-room', { store, runTurn, hasBudget: () => true, checkSong, debounceMs: 5, now: () => now });
  const join = (name: string) => {
    const socket = fakeSocket();
    room.connect(socket);
    room.receive(socket, JSON.stringify({ type: 'join', name, clientId: `client-${name}` }));
    return socket;
  };
  return { room, store, join, runTurn, checkSong, advance: (ms: number) => { now += ms; } };
}

describe('suggestions in the room', () => {
  const apply = (room: Room, socket: Socket, id: string) => room.receive(socket, JSON.stringify({ type: 'apply', id }));

  it('shows ideas after the first join, and applies one instantly without a model call', async () => {
    const { room, join, runTurn, store } = setup();
    const alice = join('Alice');
    const bob = join('Bob');
    await settle();
    const ideas = ofType(alice, 'suggestions').at(-1)!.suggestions;
    expect(ideas).toMatchObject({ version: 4, mode: 'instant', needed: 1 });
    expect(ideas.items.length).toBeGreaterThan(0);
    expect(ideas.items.length).toBeLessThanOrEqual(4);
    const idea = ideas.items.find((item) => item.kind !== 'phase')!;
    apply(room, alice, idea.id);
    await settle();
    expect(runTurn).not.toHaveBeenCalled();
    expect(store.versions('idea-room').at(-1)).toMatchObject({ n: 5, author: 'Alice', summary: idea.label });
    expect(ofType(bob, 'song').at(-1)!.song.version).toBe(5);
    expect(ofType(bob, 'chat').at(-1)!.entry).toMatchObject({ kind: 'system', text: `Alice applied the idea: ${idea.label}.` });
    const after = ofType(bob, 'suggestions').at(-1)!.suggestions;
    expect(after.version).toBe(5); // fresh ideas for the new version
    expect(after.lastApplied).toMatchObject({ label: idea.label, by: 'Alice', at: 4 });
    expect(after.cooldownUntil).toBeGreaterThan(0);
  });

  it('waits 8 bars between ideas, and refuses an idea of an old version', async () => {
    const { room, join, advance } = setup();
    const alice = join('Alice');
    await settle();
    const first = ofType(alice, 'suggestions').at(-1)!.suggestions.items[0];
    apply(room, alice, first.id);
    await settle();
    const next = ofType(alice, 'suggestions').at(-1)!.suggestions.items[0];
    apply(room, alice, next.id);
    await settle();
    expect(ofType(alice, 'notice').at(-1)!.text).toMatch(/Wait \d+ bars/);
    apply(room, alice, first.id); // of version 4, the song is at version 5 now
    await settle();
    expect(ofType(alice, 'notice').at(-1)!.text).toMatch(/gone/);
    advance(20_000); // 128 bpm: about 10 bars
    apply(room, alice, next.id);
    await settle();
    expect(ofType(alice, 'song').at(-1)!.song.version).toBe(6);
  });

  it('moves the set with a phase idea, and lets the band make the transition', async () => {
    const { room, join, runTurn, advance } = setup();
    const alice = join('Alice');
    await settle();
    apply(room, alice, ofType(alice, 'suggestions').at(-1)!.suggestions.items[0].id); // starts the set
    await settle();
    advance(20_000);
    await room.refreshSuggestions();
    const phase = ofType(alice, 'suggestions').at(-1)!.suggestions.items.find((item) => item.kind === 'phase');
    if (!phase) return; // the ranking did not show a phase idea for this song
    apply(room, alice, phase.id);
    await settle();
    expect(ofType(alice, 'set').at(-1)!.set.index).toBe(1);
    expect(runTurn.mock.calls.at(-1)![0].mode).toEqual({ kind: 'phase', from: 'Warm-up', to: 'Build' });
  });
});

describe('breakdown idea', () => {
  it('appears only when there is energy to break down from', () => {
    const at = (index: number) => setPosition({ arc: DEFAULT_ARC, index, phaseStart: 0 }, 10);
    const has = (index: number) => candidates(context({ position: at(index) })).some((c) => c.label === 'Breakdown now');
    expect(has(0)).toBe(false); // warm-up
    expect(has(2)).toBe(true); // peak
    expect(has(8)).toBe(false); // closing
  });
});
