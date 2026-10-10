// The song model and the agent output format. The agent output schema stays
// portable across providers: a root object, a union inside it, and no numeric
// limits or regex patterns. Our own code checks the ranges after the parse.
import { z } from 'zod';

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
// Strudel scale names in mini-notation form: a colon joins the words.
export const SCALES = [
  'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'harmonic:minor', 'melodic:minor', 'major:pentatonic', 'minor:pentatonic', 'minor:blues',
] as const;
export const ROLES = ['drums', 'perc', 'bass', 'chords', 'pad', 'lead', 'arp', 'fx'] as const;
export const WHEN = ['now', 'next_bar', 'next_phrase'] as const;

export const LAYER_ID = /^[a-z][a-z0-9]{0,15}$/;
export const MAX_LAYERS = 8;
export const MIN_BPM = 60;
export const MAX_BPM = 180;
export const MAX_SONG_BYTES = 8192;

export type Root = (typeof ROOTS)[number];
export type Scale = (typeof SCALES)[number];
export type Role = (typeof ROLES)[number];

export type Layer = {
  id: string;
  role: Role;
  code: string;
  muted: boolean;
  author: string; // who asked for the last change of this layer
  since: number; // the version that last changed this layer
};

export type Song = {
  version: number;
  bpm: number;
  root: Root;
  scale: Scale;
  layers: Layer[];
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
const SetLayer = z.object({
  op: z.literal('set_layer'),
  id: z.string().describe('Lowercase id, for example "drums" or "bass2". Same id replaces the layer.'),
  role: z.enum(ROLES),
  code: z.string().describe('Exactly one Strudel expression. No tempo calls, no labels, no comments.'),
  muted: z.boolean(),
});
const RemoveLayer = z.object({
  op: z.literal('remove_layer'),
  id: z.string(),
});
const RestoreVersion = z.object({
  op: z.literal('restore_version'),
  version: z.number().describe('An earlier version number. Must be the only operation in the turn.'),
});

export const Op = z.discriminatedUnion('op', [SetTempo, SetKey, SetLayer, RemoveLayer, RestoreVersion]);
export type Op = z.infer<typeof Op>;

export const AgentTurn = z.object({
  plan: z.string().describe('One or two short sentences: what you will change and why.'),
  ops: z.array(Op).describe('The changes to the song. Empty when no change is needed.'),
  when: z.enum(WHEN).describe('When the change lands: now, at the next bar, or at the next 4-bar phrase.'),
  reply: z.string().describe('A short, friendly answer to the users. Name each user you answer.'),
  summary: z.string().describe('A label of at most 6 words for the version history.'),
});
export type AgentTurn = z.infer<typeof AgentTurn>;
