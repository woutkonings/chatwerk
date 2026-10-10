// Rules that code enforces around the agent, so they do not depend on the
// prompt alone. Tempo: the band changes the tempo only when a user asks for it
// (or when the song is empty). Timing: the numbers are rounded to allowed values.
import { MAX_BPM, MIN_BPM, type AgentTurn, type Op, type Song } from '../shared/schema.ts';
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

// Applies the tempo rule and rounds the timing values. Returns notes for the turn log.
export function enforce(turn: AgentTurn, policy: TempoPolicy, song: Song): string[] {
  const notes: string[] = [];
  turn.ops = turn.ops.flatMap((op): Op[] => {
    if (op.op === 'set_layer' || op.op === 'remove_layer') return [{ ...op, timing: normalizeTiming(op.timing) }];
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
