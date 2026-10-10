// The song model and the agent output format. The agent output schema stays
// portable across providers: a root object, a union inside it, and no numeric
// limits or regex patterns. Our own code checks the ranges after the parse.
import { z } from 'zod';
import { PHASE_KINDS } from './set.ts';

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
// Strudel scale names in mini-notation form: a colon joins the words.
export const SCALES = [
  'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'harmonic:minor', 'melodic:minor', 'major:pentatonic', 'minor:pentatonic', 'minor:blues',
] as const;
export const ROLES = ['drums', 'perc', 'bass', 'chords', 'pad', 'lead', 'arp', 'fx'] as const;
export const WHEN = ['now', 'next_bar', 'next_phrase'] as const;
// How a layer change sounds: switch at once, crossfade the volume, or sweep a low-pass filter.
export const STYLES = ['cut', 'fade', 'filter'] as const;
// Allowed values. Our code rounds the agent's numbers to the nearest one.
export const START_BARS = [0, 4, 8, 16] as const;
export const FADE_BARS = [1, 2, 4, 8, 16] as const;

export const LAYER_ID = /^[a-z][a-z0-9]{0,15}$/;
export const MAX_LAYERS = 8;
export const MIN_BPM = 60;
export const MAX_BPM = 180;
export const MAX_SONG_BYTES = 8192;

export type Root = (typeof ROOTS)[number];
export type Scale = (typeof SCALES)[number];
export type Role = (typeof ROLES)[number];
export type Style = (typeof STYLES)[number];

// Parameters that the band can automate over bars, by their Strudel method names.
export const AUTO_PARAMS = ['lpf', 'hpf', 'lpq', 'room', 'delay', 'shape', 'gain'] as const;
export type AutoParam = (typeof AUTO_PARAMS)[number];
export const AUTO_BARS = [1, 2, 4, 8, 16, 32] as const;
// An automation moves a parameter from `from` (or the layer's own value) to `to`,
// from room cycle `at` over `bars` bars, and then keeps `to`. The agent gives a
// `start` in bars; the room turns it into `at` when it publishes the version.
export type Automation = { param: AutoParam; to: number; from?: number; at: number; bars: number; start?: number };

// Rhythm variations that code applies to a layer, so the band does not rewrite it.
export const VARIATIONS = ['thin', 'busier', 'fill', 'ghost', 'offbeat', 'shuffle'] as const;
export type Variation = (typeof VARIATIONS)[number];
export const MAX_VARIATIONS = 3;
export const MAX_SWING = 0.3;

// Motifs: short ideas in scale degrees that layers share through motif("a").
export const MOTIF_NAME = /^[a-z]{1,8}$/;
export const MOTIF_NOTES = /^[0-9 ~\-[\]<>.,*!@_?/]{1,64}$/;
export const MAX_MOTIFS = 3;
export const MAX_MOTIF_LAYERS = 2;

export type Layer = {
  id: string;
  role: Role;
  code: string;
  muted: boolean;
  author: string; // who asked for the last change of this layer
  since: number; // the version that last changed this layer
  automation?: Automation[];
  vary?: Variation[];
};

export type Song = {
  version: number;
  bpm: number;
  root: Root;
  scale: Scale;
  layers: Layer[];
  swing?: number; // 0 to 0.3: a shuffle on the 16th notes of every layer, so the groove is shared
  motifs?: Record<string, string>; // name -> scale degrees in mini-notation
};

export const EMPTY_SONG: Song = { version: 0, bpm: 120, root: 'C', scale: 'minor', layers: [] };

const SetTempo = z.object({
  op: z.literal('set_tempo'),
  bpm: z.number().describe(`Beats per minute, ${MIN_BPM} to ${MAX_BPM}. One cycle is 4 beats.`),
});
const SetKey = z.object({
  op: z.literal('set_key'),
  root: z.enum(ROOTS),
  scale: z.enum(SCALES),
});
const Timing = z.object({
  start: z.number().describe('Bars after the transition moment when this change begins: 0, 4, 8 or 16. Stage a big change over several starts.'),
  style: z.enum(STYLES).describe('cut: switch at once. fade: crossfade the volume. filter: a low-pass filter sweep, like a DJ.'),
  bars: z.number().describe('Length of a fade or filter sweep in bars: 1, 2, 4, 8 or 16. Use 1 for cut.'),
});
export type Timing = z.infer<typeof Timing>;

const SetLayer = z.object({
  op: z.literal('set_layer'),
  id: z.string().describe('Lowercase id, for example "drums" or "bass2". Same id replaces the layer.'),
  role: z.enum(ROLES),
  code: z.string().describe('Exactly one Strudel expression. No tempo calls, no labels, no comments.'),
  muted: z.boolean(),
  timing: Timing,
});
const RemoveLayer = z.object({
  op: z.literal('remove_layer'),
  id: z.string(),
  timing: Timing,
});
const Automate = z.object({
  op: z.literal('automate'),
  id: z.string().describe('The layer to automate.'),
  param: z.enum(AUTO_PARAMS).describe('lpf or hpf: filter cutoff in Hz. lpq: resonance 0 to 30. room, delay, shape and gain: 0 to 1.'),
  to: z.number().describe('The value at the end. The layer keeps it after the automation.'),
  start: z.number().describe('Bars after the transition moment when the movement begins: 0, 4, 8 or 16.'),
  bars: z.number().describe('Length of the movement in bars: 1, 2, 4, 8, 16 or 32.'),
});
const Vary = z.object({
  op: z.literal('vary'),
  id: z.string().describe('The layer to vary.'),
  kinds: z.array(z.enum(VARIATIONS)).describe('At most 3. An empty list removes all. thin: drop 30% of the hits. busier: double some hits. fill: double the hits in every 4th bar. ghost: add quiet hits a 16th later. offbeat: move the layer an 8th later. shuffle: swing this layer.'),
  timing: Timing,
});
const SetSwing = z.object({
  op: z.literal('set_swing'),
  amount: z.number().describe('Shuffle on the 16th notes of all layers: 0 is straight, 0.1 a light groove, 0.2 to 0.3 a strong shuffle.'),
});
const SetPhase = z.object({
  op: z.literal('set_phase'),
  kind: z.enum(PHASE_KINDS).describe('Move the live set to the next phase of this kind.'),
});
const SetMotif = z.object({
  op: z.literal('set_motif'),
  name: z.string().describe('A short lowercase name, for example "a".'),
  notes: z.string().describe('Scale degrees in mini-notation, for example "0 ~ 3 [0 5] ~ 7 3 ~". An empty string removes the motif.'),
});
const RestoreVersion = z.object({
  op: z.literal('restore_version'),
  version: z.number().describe('An earlier version number. Must be the only operation in the turn.'),
});

export const Op = z.discriminatedUnion('op', [SetTempo, SetKey, SetLayer, RemoveLayer, Automate, Vary, SetSwing, SetPhase, SetMotif, RestoreVersion]);
export type Op = z.infer<typeof Op>;

export const AgentTurn = z.object({
  plan: z.string().describe('One or two short sentences: what you will change and why.'),
  ops: z.array(Op).describe('The changes to the song. Empty when no change is needed.'),
  when: z.enum(WHEN).describe('When the change lands: now, at the next bar, or at the next 4-bar phrase.'),
  reply: z.string().describe('A short, friendly answer to the users. Name each user you answer.'),
  summary: z.string().describe('A label of at most 6 words for the version history.'),
});
export type AgentTurn = z.infer<typeof AgentTurn>;
