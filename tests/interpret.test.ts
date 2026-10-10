import { describe, expect, it } from 'vitest';
import { strudelLib } from '../server/strudel-lib.ts';
import { buildLayer } from '../shared/interpret.ts';
import { GOOD_LAYERS } from './layers.ts';

describe('buildLayer', () => {
  it.each(GOOD_LAYERS)('builds and queries %s', (layer) => {
    const haps = buildLayer(layer, strudelLib).queryArc(0, 4);
    expect(haps.length).toBeGreaterThan(0);
  });

  it('transposes notes after .s()', () => {
    const haps = buildLayer('note("c2").s("sawtooth").off(1/8, x => x.transpose(12))', strudelLib).queryArc(0, 1);
    const notes = haps.map((hap: any) => hap.value.note);
    expect(notes).toContain('C3');
  });

  it('uses the song key through scale()', () => {
    const haps = buildLayer('n("0 2 4").scale("C3:minor")', strudelLib).queryArc(0, 1);
    expect(haps.map((hap: any) => hap.value.note)).toEqual(['C3', 'Eb3', 'G3']);
  });

  it('refuses a layer that does not validate', () => {
    expect(() => buildLayer('fetch("x")', strudelLib)).toThrow('unknown function "fetch"');
  });
});
