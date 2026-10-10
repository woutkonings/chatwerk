// Pure helpers for the room UI: labels, times and the geometry of the set timeline.
import { PHASE_LABEL, setPosition, type SetPosition, type SetState } from '../../../shared/set.ts';
import type { AutoParam, Automation } from '../../../shared/schema.ts';
import type { LayerChange } from '../../../shared/transition.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "fade in 3 bars" before a staged change, "fading, 2 bars left" during it, nothing after it.
export function changeLabel(change: LayerChange | undefined, cycle: number): string | null {
  if (!change) return null;
  const name = { cut: 'cut', fade: 'fade', filter: 'filter sweep' }[change.style];
  if (cycle < change.at) return `${name} in ${plural(Math.ceil(change.at - cycle), 'bar')}`;
  if (change.bars > 0 && cycle < change.at + change.bars) {
    return `${change.style === 'filter' ? 'filtering' : 'fading'}, ${Math.ceil(change.at + change.bars - cycle)} bars left`;
  }
  return null;
}

export type AutomationStatus =
  | { state: 'pending'; barsUntil: number }
  | { state: 'running'; progress: number; barsLeft: number }
  | { state: 'done' };

export function automationStatus(automation: Automation, cycle: number): AutomationStatus {
  if (cycle < automation.at) return { state: 'pending', barsUntil: Math.ceil(automation.at - cycle) };
  const end = automation.at + automation.bars;
  if (automation.bars > 0 && cycle < end) {
    return { state: 'running', progress: (cycle - automation.at) / automation.bars, barsLeft: Math.ceil(end - cycle) };
  }
  return { state: 'done' };
}

// Filter frequencies in Hz read best as "800" or "2.4k"; the other parameters are small numbers.
export function formatParam(param: AutoParam, value: number): string {
  if (param === 'lpf' || param === 'hpf') {
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : `${Math.round(value)}`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/0$/, '');
}

// One bar is 4 beats.
export const barsToSeconds = (bars: number, bpm: number) => (bars * 4 * 60) / bpm;

// "6:05" under an hour, "1:12:30" from an hour.
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatClock(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export type TimelineGeometry = {
  total: number; // all bars of the arc
  offsets: number[]; // the first bar of each phase in the arc
  playhead: number; // the bar of the arc that plays now
  position: SetPosition;
};

// The arc as one bar axis. Earlier phases keep their planned length: they are history.
export function timelineGeometry(set: SetState, cycle: number): TimelineGeometry {
  const offsets: number[] = [];
  let total = 0;
  for (const phase of set.arc) {
    offsets.push(total);
    total += phase.bars;
  }
  const position = setPosition(set, cycle);
  const playhead = offsets[set.index] + Math.min(position.barsIn, position.phase.bars);
  return { total, offsets, playhead, position };
}


export const moveSetMessage = (set: SetState, index: number) => `Move the set to the ${PHASE_LABEL[set.arc[index].kind]} now`;

// How far the band is from the target energy, in words.
export function energyDelta(energy: number, target: number): { text: string; tone: 'on' | 'under' | 'over' } {
  const delta = Math.round((energy - target) * 10) / 10;
  if (Math.abs(delta) < 0.75) return { text: 'on target', tone: 'on' };
  return delta < 0 ? { text: `${Math.abs(delta)} under target`, tone: 'under' } : { text: `${delta} over target`, tone: 'over' };
}
