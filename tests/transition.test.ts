import { describe, expect, it } from 'vitest';
import { strudelLib } from '../server/strudel-lib.ts';
import { buildLayer } from '../shared/interpret.ts';
import { changeFor, presence, transitionLayer } from '../shared/transition.ts';

const OLD = buildLayer('s("hh*4")', strudelLib);
const NEW = buildLayer('s("cp*4")', strudelLib);

// The events of one cycle as [sound, velocity, cutoff].
const events = (pattern: any, cycle: number) =>
  pattern.queryArc(cycle, cycle + 1)
    .filter((hap: any) => hap.whole)
    .map((hap: any) => [hap.value.s, Number((hap.value.velocity ?? 1).toFixed(2)), hap.value.cutoff ? Math.round(hap.value.cutoff) : undefined]);

describe('layer transitions', () => {
  it('cuts at the boundary', () => {
    const pattern = transitionLayer(strudelLib, OLD, NEW, changeFor({ start: 0, style: 'cut', bars: 1 }, 8));
    expect(events(pattern, 7).map((e: unknown[]) => e[0])).toEqual(['hh', 'hh', 'hh', 'hh']);
    expect(events(pattern, 8).map((e: unknown[]) => e[0])).toEqual(['cp', 'cp', 'cp', 'cp']);
  });

  it('crossfades over the bars, with equal power at the middle', () => {
    const change = changeFor({ start: 0, style: 'fade', bars: 4 }, 8);
    const pattern = transitionLayer(strudelLib, OLD, NEW, change);
    expect(events(pattern, 7).every((e: unknown[]) => e[0] === 'hh' && e[1] === 1)).toBe(true);
    const middle = events(pattern, 10);
    const first = (sound: string) => middle.find((e: unknown[]) => e[0] === sound)!;
    expect(first('hh')[1]).toBeCloseTo(Math.cos(Math.PI / 4), 2);
    expect(first('cp')[1]).toBeCloseTo(Math.sin(Math.PI / 4), 2);
    expect(events(pattern, 12).map((e: unknown[]) => e[0])).toEqual(['cp', 'cp', 'cp', 'cp']);
  });

  it('stages a change with a later start, and drops silent events', () => {
    const change = changeFor({ start: 8, style: 'fade', bars: 2 }, 8);
    expect(change).toEqual({ at: 16, style: 'fade', bars: 2 });
    const pattern = transitionLayer(strudelLib, null, NEW, change);
    expect(events(pattern, 15)).toEqual([]);
    // The event at cycle 16.0 has presence 0, so it is dropped.
    expect(events(pattern, 16).map((e: unknown[]) => e[1])).toEqual([0.2, 0.38, 0.56]);
  });

  it('sweeps a low-pass filter for the filter style', () => {
    const change = changeFor({ start: 0, style: 'filter', bars: 4 }, 0);
    const pattern = transitionLayer(strudelLib, null, NEW, change);
    const cutoffs = [0, 1, 2, 3].map((cycle) => events(pattern, cycle)[0][2] as number);
    expect(cutoffs[1]).toBeGreaterThan(cutoffs[0]);
    expect(cutoffs[3]).toBeGreaterThan(cutoffs[2]);
    expect(events(pattern, 4)[0][2]).toBeUndefined(); // the sweep is over: the layer sounds as written
    expect(presence(2, change, 'out')).toBe(0.5);
  });
});
