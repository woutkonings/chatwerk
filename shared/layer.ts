// The pattern of one layer as it sounds: the agent code, plus what code adds on
// top: rhythm variations, the shared swing of the song, and automations. The
// player and the server check use the same function. This is our own code, not
// agent code, so it may use any Strudel function.
import { buildLayer, type StrudelLib } from './interpret.ts';
import type { AutoParam, Automation, Layer, Song, Variation } from './schema.ts';

// The value key of each parameter, its range, and the value when a layer does not set it.
export const AUTO_KEY: Record<AutoParam, string> = {
  lpf: 'cutoff', hpf: 'hcutoff', lpq: 'resonance', room: 'room', delay: 'delay', shape: 'shape', gain: 'gain',
};
const AUTO_RANGE: Record<AutoParam, [number, number]> = {
  lpf: [40, 20000], hpf: [20, 12000], lpq: [0, 25], room: [0, 1], delay: [0, 1], shape: [0, 0.8], gain: [0, 1],
};
const AUTO_DEFAULT: Record<AutoParam, number> = {
  lpf: 20000, hpf: 20, lpq: 1, room: 0, delay: 0, shape: 0, gain: 0.8,
};
// Filter cutoffs move on an exponential scale, so a sweep sounds even.
const EXPONENTIAL = new Set<AutoParam>(['lpf', 'hpf']);

export function clampAuto(param: AutoParam, value: number): number {
  const [min, max] = AUTO_RANGE[param];
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : AUTO_DEFAULT[param]));
}

// The value of an automated parameter at room cycle t, for an event whose own value is `own`.
export function automationValue(automation: Automation, own: number | undefined, t: number): number {
  const start = automation.from ?? own ?? AUTO_DEFAULT[automation.param];
  if (t < automation.at) return start;
  const x = Math.min(1, (t - automation.at) / Math.max(automation.bars, 1));
  const { to, param } = automation;
  if (EXPONENTIAL.has(param) && start > 0 && to > 0) return start * (to / start) ** x;
  return start + (to - start) * x;
}

export function applyAutomation(pattern: any, automations: Automation[]): any {
  if (!automations.length) return pattern;
  return pattern.withHap((hap: any) => {
    if (!hap.whole || hap.value === null || typeof hap.value !== 'object') return hap;
    const t = Number(hap.whole.begin);
    const active = automations.filter((a) => a.from !== undefined || t >= a.at);
    if (!active.length) return hap;
    return hap.withValue((value: Record<string, unknown>) => {
      const next = { ...value };
      for (const automation of active) {
        const key = AUTO_KEY[automation.param];
        const own = typeof value[key] === 'number' ? (value[key] as number) : undefined;
        next[key] = automationValue(automation, own, t);
      }
      return next;
    });
  });
}

// Each variation changes the rhythm of a layer in a fixed, tested way.
const VARIATION: Record<Variation, (pattern: any) => any> = {
  thin: (p) => p.degradeBy(0.3),
  busier: (p) => p.sometimesBy(0.25, (x: any) => x.ply(2)),
  fill: (p) => p.lastOf(4, (x: any) => x.ply(2)),
  ghost: (p) => p.off(1 / 16, (x: any) => x.velocity(0.3)),
  offbeat: (p) => p.late(1 / 8),
  shuffle: (p) => p.swingBy(1 / 3, 8),
};

export function applyVariations(pattern: any, kinds: Variation[]): any {
  return kinds.reduce((result, kind) => VARIATION[kind](result), pattern);
}

// The full pattern of a layer. Throws when the code does not validate or build.
export function layerPattern(layer: Layer, song: Pick<Song, 'swing' | 'motifs'>, lib: StrudelLib): any {
  const withMotifs = song.motifs ? { ...lib, motifs: song.motifs } : lib;
  let pattern = applyVariations(buildLayer(layer.code, withMotifs), layer.vary ?? []);
  if (song.swing && song.swing > 0) pattern = pattern.swingBy(song.swing, 8);
  return applyAutomation(pattern, layer.automation ?? []);
}

// What makes a layer sound different: a change here needs a new pattern in the player.
export function layerSignature(layer: Layer, song: Pick<Song, 'swing' | 'motifs'>): string {
  const motifs = layer.code.includes('motif(') ? song.motifs ?? {} : {};
  return JSON.stringify([layer.code, layer.vary ?? [], layer.automation ?? [], song.swing ?? 0, motifs]);
}
