// Rules that code enforces around the agent, so they do not depend on the
// prompt alone. Tempo and key: the band changes them only when a user asks for
// it (or when the song is empty). Timing: the numbers are rounded to allowed
// values. The notes tell the agent the rules, the set phase and the mix report.
import type { MixReport } from '../shared/protocol.ts';
import { isKick } from '../shared/song.ts';
import { MAX_BPM, MAX_LAYERS, MIN_BPM, type AgentTurn, type Op, type Role, type Song } from '../shared/schema.ts';
import { PHASE_HINT, PHASE_LABEL, type PhaseKind, type SetPosition } from '../shared/set.ts';
import { normalizeTiming } from '../shared/transition.ts';
import type { ChatLine } from './prompt.ts';

// A tempo change without a number moves at most this many bpm.
const MAX_STEP_WITHOUT_NUMBER = 10;

// English and Dutch words that ask for another tempo.
const TEMPO_WORDS = /\b(bpm|tempo|faster|slower|quicker|speed(\s+it)?\s+up|slow(\s+it)?\s+down|pace|half[- ]?time|double[- ]?time|sneller|langzamer|trager)\b/i;
// A tempo number: "140 bpm", "at 170", "to 128", "@ 124".
const TEMPO_NUMBER = /\b(\d{2,3})\s*bpm\b|(?:\bat|\bto|@)\s*(\d{2,3})\b/gi;

export type TempoPolicy =
  | { kind: 'free' } // empty song: the band picks a tempo for the style
  | { kind: 'asked'; bpm: number | null; by: string } // a user asks; bpm when they named a number
  | { kind: 'locked'; bpm: number };

export function tempoPolicy(song: Song, messages: ChatLine[]): TempoPolicy {
  if (song.layers.length === 0) return { kind: 'free' };
  for (const message of messages) {
    const numbers = [...message.text.matchAll(TEMPO_NUMBER)]
      .map((match) => Number(match[1] ?? match[2]))
      .filter((bpm) => bpm >= MIN_BPM && bpm <= MAX_BPM);
    if (numbers.length) return { kind: 'asked', bpm: numbers.at(-1)!, by: message.author };
    if (TEMPO_WORDS.test(message.text)) return { kind: 'asked', bpm: null, by: message.author };
  }
  return { kind: 'locked', bpm: song.bpm };
}

// One line for the turn message, so the agent knows the rule before it answers.
export function tempoNote(policy: TempoPolicy, song: Song): string {
  switch (policy.kind) {
    case 'free':
      return 'Tempo: the song is empty, so pick a tempo that fits the style.';
    case 'asked':
      return policy.bpm
        ? `Tempo: ${policy.by} asks for ${policy.bpm} bpm. Use set_tempo with ${policy.bpm}.`
        : `Tempo: ${policy.by} asks for another tempo. Change it by ${MAX_STEP_WITHOUT_NUMBER} bpm or less.`;
    case 'locked':
      return `Tempo: locked at ${song.bpm} bpm, because no new message asks for another tempo. Do not use set_tempo, also not for a new style.`;
  }
}

const KEY_WORDS = /\b(key|minor|major|dorian|phrygian|lydian|mixolydian|locrian|pentatonic|toonsoort|mineur|majeur)\b|\bin [A-G][#b]?\b/i;

// The key is the shared harmony. It changes only when a user asks.
export function keyLocked(song: Song, messages: ChatLine[]): boolean {
  return song.layers.length > 0 && !messages.some((message) => KEY_WORDS.test(message.text));
}

export function keyNote(locked: boolean, song: Song): string {
  return locked
    ? `Key: locked at ${song.root} ${song.scale.replace(':', ' ')}. Do not use set_key. Melodic layers use scale("${song.root}<octave>:${song.scale}") and chords from this key.`
    : 'Key: a user asks for a key, or the song is empty, so set_key is allowed.';
}

// Where the live set is, and what the phase needs.
export function setNote(position: SetPosition, bpm: number): string {
  const minutes = Math.round((position.barsLeft * 4 * 60) / bpm / 60);
  const { phase, next } = position;
  const after = next ? ` Next phase: ${PHASE_LABEL[next.kind]} (energy ${next.energy[0]}).` : '';
  return `Live set: phase ${PHASE_LABEL[phase.kind]}, bar ${Math.floor(position.barsIn)} of ${phase.bars}, about ${minutes} min left. Energy target now: ${position.energy} of 10. This phase: ${PHASE_HINT[phase.kind]}.${after}`;
}

// What the band hears, and how far it is from the energy target.
export function reportNote(report: MixReport, target: number | null): string {
  let note = `What you hear now: energy ${report.energy} of 10.`;
  if (target !== null && report.energy < target - 1.5) note += ' That is below the target: raise the energy.';
  if (target !== null && report.energy > target + 1.5) note += ' That is above the target: bring the energy down.';
  return [note, ...report.lines.map((line) => `- ${line}`)].join('\n');
}

// Autopilot turns have no user request. A mutation is small; a phase change prepares the new phase.
export type TurnMode = { kind: 'request' } | { kind: 'mutation'; idea: string } | { kind: 'phase'; from: string; to: string };

// Kinds of mutation. The harness picks one per autopilot turn, so the set keeps
// moving in different ways, and a target layer that did not change for a long time.
export const MUTATIONS = ['rhythm', 'colour', 'bassline', 'harmony', 'texture', 'space'] as const;
export type MutationKind = (typeof MUTATIONS)[number];

const MUTATION_IDEA: Record<MutationKind, { roles: Role[] | null; text: (id: string) => string }> = {
  rhythm: { roles: ['drums', 'perc'], text: (id) => `give the rhythm of "${id}" a new twist: a vary, or a new pattern with some syncopation.` },
  colour: { roles: ['chords', 'pad', 'lead', 'arp', 'bass', 'fx'], text: (id) => `change the colour of "${id}" over 8 to 32 bars with automate (a filter, room, delay or shape).` },
  bassline: { roles: ['bass'], text: (id) => `change the bassline "${id}" a little: other notes or another rhythm, with the same root and groove.` },
  harmony: { roles: ['chords', 'pad', 'lead', 'arp'], text: (id) => `change "${id}" a little: another voicing, rhythm or chord, in the key.` },
  texture: { roles: null, text: () => 'add one small new layer (a texture, percussion or a short stab) that fades or filters in.' },
  space: { roles: ['perc', 'chords', 'pad', 'lead', 'arp', 'fx'], text: (id) => `make space: take "${id}" out for a while with a fade or a filter (muted: true), or thin it.` },
};

// The mutations that fit a phase. A breakdown has no drum twists; a peak does not thin out.
const PHASE_MUTATIONS: Partial<Record<PhaseKind, readonly MutationKind[]>> = {
  breakdown: ['colour', 'harmony', 'texture', 'space'],
  peak: ['rhythm', 'colour', 'bassline', 'harmony', 'texture'],
  closing: ['colour', 'harmony', 'space'],
};

// Picks the next mutation: one that fits the phase, not one of the last two, and only one that has a target.
export function pickMutation(song: Song, recent: MutationKind[], phase?: PhaseKind): { kind: MutationKind; idea: string } {
  const start = recent.length % MUTATIONS.length;
  const order = [...MUTATIONS.slice(start), ...MUTATIONS.slice(0, start)];
  const fits = (phase && PHASE_MUTATIONS[phase]) || MUTATIONS;
  for (const kind of order) {
    if (recent.slice(-2).includes(kind) || !fits.includes(kind)) continue;
    const { roles, text } = MUTATION_IDEA[kind];
    if (!roles) {
      if (song.layers.length < MAX_LAYERS - 1) return { kind, idea: text('') };
      continue;
    }
    // Rhythm twists go to hats and percussion: the kick keeps the four-on-the-floor.
    const candidates = song.layers.filter((layer) => roles.includes(layer.role) && !layer.muted && !(kind === 'rhythm' && isKick(layer.code)));
    const stale = candidates.sort((a, b) => a.since - b.since)[0];
    if (stale) return { kind, idea: text(stale.id) };
  }
  return { kind: 'rhythm', idea: 'change one layer a little, in a way that keeps the groove.' };
}

export function modeNote(mode: TurnMode): string | null {
  if (mode.kind === 'mutation') {
    return `Autopilot: nobody asked for anything for a while. Make one small mutation that fits the phase. The idea for this one: ${mode.idea} Use one or two operations. Do not remove the kick or the bass, except in a breakdown or the closing. Reply in at most 8 words.`;
  }
  if (mode.kind === 'phase') {
    return `Autopilot: the set moves from ${mode.from} to ${mode.to} now. Make the change that the new phase needs, staged over the coming phrases with start and timing. Reply in at most 10 words.`;
  }
  return null;
}

// Applies the tempo and key rules and rounds the timing values. Returns notes for the turn log.
export function enforce(turn: AgentTurn, policy: TempoPolicy, song: Song, keyIsLocked = false): string[] {
  const notes: string[] = [];
  turn.ops = turn.ops.flatMap((op): Op[] => {
    if (op.op === 'set_layer' || op.op === 'remove_layer' || op.op === 'vary') return [{ ...op, timing: normalizeTiming(op.timing) }];
    if (op.op === 'set_key' && keyIsLocked) {
      notes.push(`removed set_key ${op.root} ${op.scale}: no user asked for another key`);
      return [];
    }
    if (op.op !== 'set_tempo') return [op];
    if (policy.kind === 'locked') {
      notes.push(`removed set_tempo ${op.bpm}: no user asked for a tempo change`);
      return [];
    }
    if (policy.kind === 'asked' && policy.bpm && op.bpm !== policy.bpm) {
      notes.push(`set_tempo ${op.bpm} became ${policy.bpm}, the number the user asked for`);
      return [{ ...op, bpm: policy.bpm }];
    }
    if (policy.kind === 'asked' && !policy.bpm && Math.abs(op.bpm - song.bpm) > MAX_STEP_WITHOUT_NUMBER) {
      const bpm = song.bpm + Math.sign(op.bpm - song.bpm) * MAX_STEP_WITHOUT_NUMBER;
      notes.push(`set_tempo ${op.bpm} became ${bpm}: at most ${MAX_STEP_WITHOUT_NUMBER} bpm without a number`);
      return [{ ...op, bpm }];
    }
    return [op];
  });
  return notes;
}
