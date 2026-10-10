// The live set: a DJ set of an hour or more, in phases with an energy level.
// It is not a song form. The phases give the band a direction over a long
// time (warm-up, build, peak, breakdown, journey, closing), and the room clock
// says where the set is. The harness tells the band the phase and the energy
// target in every turn, and it moves to the next phase when the time is up.

export const PHASE_KINDS = ['warmup', 'build', 'peak', 'breakdown', 'journey', 'closing'] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PHASE_LABEL: Record<PhaseKind, string> = {
  warmup: 'Warm-up', build: 'Build', peak: 'Peak', breakdown: 'Breakdown', journey: 'Journey', closing: 'Closing',
};

// What each phase means, for the agent.
export const PHASE_HINT: Record<PhaseKind, string> = {
  warmup: 'few layers, space, the groove settles; no big drops',
  build: 'add tension step by step: percussion, filter openings, risers; energy goes up',
  peak: 'full energy: driving kick and bass, the strongest hooks; change by variation, not by removal',
  breakdown: 'kick and bass out or filtered, pads and textures carry; prepare the drop',
  journey: 'deeper and hypnotic: rolling grooves, long filter movements, new colours',
  closing: 'energy comes down slowly; remove layers one by one, long fades',
};

// One phase: its length in bars, and the energy from its start to its end (1 to 10).
export type Phase = { kind: PhaseKind; bars: number; energy: [number, number] };

// About 72 minutes at 124 bpm (one bar is 4 beats, so about 1.9 s). The energy
// values use the scale of the mix report (shared/report.ts): a plain groove of
// kick, hats and bass is about 5, a full peak about 9, pads alone about 2.
export const DEFAULT_ARC: Phase[] = [
  { kind: 'warmup', bars: 256, energy: [5, 5.5] },
  { kind: 'build', bars: 256, energy: [5.5, 7] },
  { kind: 'peak', bars: 384, energy: [7.5, 8.5] },
  { kind: 'breakdown', bars: 64, energy: [2.5, 3] },
  { kind: 'build', bars: 128, energy: [5, 7.5] },
  { kind: 'peak', bars: 384, energy: [8, 9] },
  { kind: 'journey', bars: 256, energy: [5.5, 6.5] },
  { kind: 'peak', bars: 256, energy: [7.5, 9] },
  { kind: 'closing', bars: 256, energy: [6, 3.5] },
];

// The state of the set in a room. `phaseStart` is the room cycle where the current phase began.
export type SetState = { arc: Phase[]; index: number; phaseStart: number };

export type SetPosition = {
  index: number;
  phase: Phase;
  barsIn: number;
  barsLeft: number;
  energy: number; // the energy target now
  next: Phase | null;
};

export function setPosition(set: SetState, cycle: number): SetPosition {
  const phase = set.arc[set.index];
  const barsIn = Math.max(0, cycle - set.phaseStart);
  const progress = Math.min(1, barsIn / phase.bars);
  const energy = phase.energy[0] + (phase.energy[1] - phase.energy[0]) * progress;
  return {
    index: set.index, phase, barsIn, barsLeft: Math.max(0, phase.bars - barsIn),
    energy: Math.round(energy * 10) / 10, next: set.arc[set.index + 1] ?? null,
  };
}

// The room cycle where each phase starts, from the current phase on (earlier phases are history).
export function phaseStarts(set: SetState): number[] {
  const starts: number[] = [];
  let at = set.phaseStart;
  for (let i = 0; i < set.arc.length; i++) {
    if (i < set.index) starts.push(Number.NaN);
    else {
      starts.push(at);
      at += set.arc[i].bars;
    }
  }
  return starts;
}

// After the last phase, the set loops back to a journey, so the music never stops.
export function nextPhase(set: SetState, cycle: number): SetState {
  if (set.index + 1 < set.arc.length) return { ...set, index: set.index + 1, phaseStart: cycle };
  return { arc: [...set.arc, { kind: 'journey', bars: 256, energy: [5.5, 6.5] }], index: set.index + 1, phaseStart: cycle };
}

// Jumps to the next phase of a kind (for example "go to the peak now"). If the arc
// has none, the phase is inserted after the current one.
export function jumpTo(set: SetState, kind: PhaseKind, cycle: number): SetState {
  const later = set.arc.findIndex((phase, i) => i > set.index && phase.kind === kind);
  if (later !== -1) return { ...set, index: later, phaseStart: cycle };
  const template = DEFAULT_ARC.find((phase) => phase.kind === kind)!;
  const arc = [...set.arc.slice(0, set.index + 1), { ...template }, ...set.arc.slice(set.index + 1)];
  return { arc, index: set.index + 1, phaseStart: cycle };
}
