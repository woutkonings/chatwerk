// Layer transitions on the room clock. A change of one layer can cut, fade
// (crossfade the volume) or filter (a DJ low-pass sweep). The times are room
// cycles, so every listener hears the same fade at the same moment.
// This is our own code, not agent code, so it may use any Strudel function.
import type { StrudelLib } from './interpret.ts';
import { FADE_BARS, START_BARS, type Style, type Timing } from './schema.ts';

// One layer change: it starts at room cycle `at` and takes `bars` cycles (0 for a cut).
export type LayerChange = { at: number; style: Style; bars: number };

const MIN_CUTOFF = 250;
const MAX_CUTOFF = 20000;

const nearest = (value: number, allowed: readonly number[]) =>
  allowed.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best));

// Rounds the agent's numbers to the allowed values. A cut has no length.
export function normalizeTiming(timing: Timing): Timing {
  const start = nearest(Number.isFinite(timing.start) ? timing.start : 0, START_BARS);
  const bars = timing.style === 'cut' ? 1 : nearest(Number.isFinite(timing.bars) ? timing.bars : 4, FADE_BARS);
  return { start, style: timing.style, bars };
}

export function changeFor(timing: Timing, boundary: number): LayerChange {
  const { start, style, bars } = normalizeTiming(timing);
  return { at: boundary + start, style, bars: style === 'cut' ? 0 : bars };
}

export const changeEnd = (change: LayerChange) => change.at + change.bars;

// How much of a layer sounds at room cycle t: 0 is gone, 1 is fully there.
export function presence(t: number, change: LayerChange, direction: 'in' | 'out'): number {
  const progress = change.bars === 0 ? (t >= change.at ? 1 : 0) : Math.min(1, Math.max(0, (t - change.at) / change.bars));
  return direction === 'in' ? progress : 1 - progress;
}

// Changes one event value for its presence. Fade: an equal-power volume curve.
// Filter: an exponential low-pass sweep, with a short volume fade at the quiet end.
export function shapeValue(value: Record<string, unknown>, amount: number, style: Style): Record<string, unknown> {
  if (amount >= 1 || style === 'cut') return value;
  const velocity = typeof value.velocity === 'number' ? value.velocity : 1;
  if (style === 'fade') return { ...value, velocity: velocity * Math.sin((amount * Math.PI) / 2) };
  const sweep = MIN_CUTOFF * (MAX_CUTOFF / MIN_CUTOFF) ** amount;
  const own = typeof value.cutoff === 'number' ? value.cutoff : MAX_CUTOFF;
  return { ...value, cutoff: Math.min(own, sweep), velocity: velocity * Math.min(1, amount * 4) };
}

const beginOf = (hap: any): number | null => (hap.whole ? Number(hap.whole.begin) : null);

// The pattern of one layer during a change from `from` to `to` (either can be null).
export function transitionLayer(lib: StrudelLib, from: any | null, to: any | null, change: LayerChange): any {
  const { stack, silence } = lib.scope;
  const parts: any[] = [];
  // Events that would be silent (presence 0) are dropped, so they use no voice.
  const side = (pattern: any, direction: 'in' | 'out') => pattern
    .filterHaps((hap: any) => { const t = beginOf(hap); return t !== null && presence(t, change, direction) > 0; })
    .withHap((hap: any) => {
      const amount = presence(beginOf(hap)!, change, direction);
      if (amount >= 1 || hap.value === null || typeof hap.value !== 'object') return hap;
      return hap.withValue((value: Record<string, unknown>) => shapeValue(value, amount, change.style));
    });
  if (from) parts.push(side(from, 'out'));
  if (to) parts.push(side(to, 'in'));
  return parts.length ? stack(...parts) : silence;
}
