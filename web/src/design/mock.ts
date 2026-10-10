// Mock room data for the style guide. The times are relative to a room cycle, so the demos can move.
import type { AgentState, ChatEntry, MixReport, ReactionCounts, User, VersionInfo } from '../../../shared/protocol.ts';
import type { Layer, Song } from '../../../shared/schema.ts';
import type { SuggestMode, SuggestionState, SuggestionView } from '../../../shared/suggest.ts';
import type { LayerPreview } from '../player.ts';
import { DEFAULT_ARC, type SetState } from '../../../shared/set.ts';
import type { LayerChange } from '../../../shared/transition.ts';

// The first peak starts at bar 512 of the arc; the demo starts 160 bars into it.
export const MOCK_PHASE_START = 512;
export const MOCK_START_CYCLE = MOCK_PHASE_START + 160;

export const mockSet = (index = 2, phaseStart = MOCK_PHASE_START): SetState => ({ arc: DEFAULT_ARC, index, phaseStart });

export function mockLayers(cycle: number): Layer[] {
  return [
    { id: 'kick', role: 'drums', code: 's("bd*4").bank("RolandTR909").gain(1.1)', muted: false, author: 'band', since: 3 },
    {
      id: 'hats', role: 'perc', code: 's("~ hh ~ hh, hh*16").bank("RolandTR909").gain(".5 .3").hpf(6000)', muted: false,
      author: 'Mila', since: 11, automation: [{ param: 'hpf', to: 2000, at: Math.floor(cycle) - 6, bars: 16 }],
    },
    {
      id: 'bass', role: 'bass', code: 'n("0 ~ 0 [0 3]").scale("F1:phrygian").s("sawtooth").lpf(400).lpq(12)', muted: false,
      author: 'band', since: 14, automation: [{ param: 'lpf', from: 400, to: 2400, at: Math.floor(cycle) + 3, bars: 8 }], vary: ['ghost'],
    },
    {
      id: 'acid', role: 'lead', code: 'n("0 3 7 10 12 7 3 0").scale("F2:phrygian").s("sawtooth").lpf(sine.range(300, 2800).slow(8)).lpq(20).delay(.3)',
      muted: false, author: 'Joris', since: 13,
    },
    { id: 'stab', role: 'chords', code: 'n("<[0,3,7] ~ ~ [0,3,7]>").scale("F3:phrygian").s("square").room(.6).delay(.5)', muted: true, author: 'band', since: 9 },
    { id: 'pad', role: 'pad', code: 'n("<0 -2>").scale("F3:phrygian").s("supersaw").lpf(900).room(.8).slow(2)', muted: false, author: 'band', since: 6 },
    { id: 'arp', role: 'arp', code: 'n("0 7 12 7").fast(2).scale("F4:phrygian").s("triangle").delay(.4)', muted: false, author: 'Sam', since: 12 },
    { id: 'noise', role: 'fx', code: 's("glitch*2").room(.9)', muted: false, author: 'band', since: 14 },
  ];
}

export const mockSong = (cycle: number): Song => ({
  version: 14, bpm: 132, root: 'F', scale: 'phrygian', swing: 0.12, layers: mockLayers(cycle),
});

export const mockChanges = (cycle: number): Record<string, LayerChange> => ({
  acid: { at: Math.floor(cycle) + 2, style: 'filter', bars: 8 },
  arp: { at: Math.floor(cycle) - 2, style: 'fade', bars: 4 },
});

export const MOCK_ERRORS = { noise: 'sound "glitch" not found' };

export const MOCK_REPORT: MixReport = {
  energy: 7,
  lines: [
    'Kick and bass lock on every beat.',
    'The hats are bright: the top end is busy.',
    'The acid line carries the tension; the pad is low in the mix.',
  ],
};

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Wout' }, { id: 'u2', name: 'Mila' }, { id: 'u3', name: 'Joris' }, { id: 'u4', name: 'Sam' },
];

const T = Date.UTC(2026, 9, 10, 21, 4);

export const MOCK_CHAT: ChatEntry[] = [
  { id: 1, at: T, author: 'Mila', kind: 'user', text: 'Start a dark underground techno groove at 132 bpm', toBand: true },
  { id: 2, at: T + 9000, author: 'band', kind: 'band', text: 'Mila, here is a dark 909 groove in F phrygian: kick, offbeat hats and a rolling saw bass.', toBand: false },
  { id: 3, at: T + 60_000, author: 'Joris', kind: 'user', text: 'this is great', toBand: false },
  { id: 4, at: T + 95_000, author: 'Wout', kind: 'user', text: 'Add an acid line that builds slowly', toBand: true },
  { id: 5, at: T + 104_000, author: 'band', kind: 'band', text: 'Wout, an acid line comes in with a filter sweep over 8 bars. The resonance goes up step by step.', toBand: false },
  { id: 6, at: T + 180_000, author: 'system', kind: 'system', text: 'The set moved to the Peak', toBand: false },
];

export const MOCK_VERSIONS: VersionInfo[] = [
  { n: 10, at: T - 600_000, author: 'band', summary: 'dark 909 groove' },
  { n: 11, at: T - 420_000, author: 'Mila', summary: 'busier hats' },
  { n: 12, at: T - 300_000, author: 'Sam', summary: 'triangle arp' },
  { n: 13, at: T - 120_000, author: 'Joris', summary: 'acid line with slow filter' },
  { n: 14, at: T, author: 'band', summary: 'peak: bass opens up' },
];

export const MOCK_REACTIONS: ReactionCounts = { 13: { fire: 3, dance: 1 }, 14: { fire: 1 }, 11: { meh: 1 } };

export const AGENT_STATES: AgentState[] = [
  { status: 'idle', queue: 0 }, { status: 'waiting', queue: 0 }, { status: 'thinking', queue: 2 },
];

// One idea of each kind, for the style guide.
export const MOCK_IDEAS_ALL: SuggestionView[] = [
  { id: 'k1', kind: 'energy-up', label: 'Open the acid filter', detail: 'acid: low-pass to 3000 Hz over 16 bars', votes: 0 },
  { id: 'k2', kind: 'energy-down', label: 'Thin out the drums', detail: 'kick, hats: vary thin', votes: 0 },
  { id: 'k3', kind: 'groove', label: 'Ghost notes on the hats', detail: 'hats: vary ghost', votes: 0 },
  { id: 'k4', kind: 'colour', label: 'Swap the stab for a choir pad', detail: 'stab: new sound, same notes', votes: 0 },
  { id: 'k5', kind: 'space', label: 'More dub delay on the stab', detail: 'stab: delay to 0.6 over 8 bars', votes: 0 },
  { id: 'k6', kind: 'drop', label: 'Drop the kick for 8 bars', detail: 'kick: mute at the next phrase, back after 8 bars', votes: 0 },
  { id: 'k7', kind: 'phase', label: 'Go to the breakdown', detail: 'set: move to the Breakdown', votes: 0 },
  { id: 'k8', kind: 'restore', label: 'Back to version 13', detail: 'restore v13: acid line with slow filter', votes: 0 },
  { id: 'k9', kind: 'fix', label: 'Fix the noise layer', detail: 'noise: sound "glitch" not found, use "noise2"', votes: 0 },
];

// Two rounds of four ideas, so the instant demo can show a refresh after a click.
const ROUNDS = [[0, 2, 4, 6], [1, 3, 5, 7]];

export function mockSuggestions(mode: SuggestMode, version = 14, votes: number[] = [2, 0, 1, 0]): SuggestionState {
  const round = ROUNDS[version % 2];
  return {
    version, mode, needed: mode === 'vote' ? 3 : 1,
    items: round.map((index, i) => ({ ...MOCK_IDEAS_ALL[index], id: `${MOCK_IDEAS_ALL[index].id}-v${version}`, votes: mode === 'vote' ? votes[i] : 0 })),
  };
}

// The events of each mock layer in one bar, in the shape of player.preview(id).
// "x" is a full hit, "o" a soft hit, "." a rest; 16 steps per bar.
function steps(pattern: string, sound: string): LayerPreview {
  return [...pattern].flatMap((char, i) => (char === '.' ? [] : [{ t: i / 16, length: 1 / 16, velocity: char === 'x' ? 1 : 0.45, midi: null, sound }]));
}

// [step, midi, length in steps, velocity]
function notes(list: [number, number, number, number?][]): LayerPreview {
  return list.map(([step, midi, length, velocity = 0.9]) => ({ t: step / 16, length: length / 16, velocity, midi, sound: 'sawtooth' }));
}

export const MOCK_PREVIEWS: Record<string, LayerPreview> = {
  kick: steps('x...x...x...x...', 'bd'),
  hats: steps('o.x.o.x.o.x.o.xo', 'hh'),
  bass: notes([[0, 29, 2], [3, 29, 1, 0.6], [6, 29, 2], [8, 29, 2], [11, 32, 1], [12, 29, 2], [14, 30, 2, 0.7]]),
  acid: notes([[0, 41, 1], [2, 44, 1], [4, 48, 1], [5, 51, 1, 0.5], [6, 53, 1], [8, 48, 1], [10, 44, 1], [11, 46, 1, 0.5], [12, 41, 2], [14, 53, 1], [15, 51, 1, 0.5]]),
  stab: notes([[0, 53, 2], [0, 56, 2], [0, 60, 2], [10, 53, 2, 0.7], [10, 56, 2, 0.7], [10, 60, 2, 0.7]]),
  pad: notes([[0, 53, 8, 0.6], [0, 60, 8, 0.6], [8, 51, 8, 0.6], [8, 58, 8, 0.6]]),
  arp: notes([[0, 65, 1], [2, 72, 1], [4, 77, 1], [6, 72, 1], [8, 65, 1], [10, 72, 1], [12, 77, 1], [14, 72, 1]]),
  noise: [],
};
