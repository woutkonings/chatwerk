import { describe, expect, it } from 'vitest';
import { gateValue } from '../web/src/hap-gate.ts';

describe('hap gate', () => {
  it('lets normal events through unchanged', () => {
    const value = { s: 'bd', bank: 'RolandTR909', gain: 0.9, cutoff: 800, orbit: 2 };
    expect(gateValue(value)).toBe(true);
    expect(value).toEqual({ s: 'bd', bank: 'RolandTR909', gain: 0.9, cutoff: 800, orbit: 2 });
  });

  it('drops unknown sounds and sounds that are not strings', () => {
    expect(gateValue({ s: 'nosuchsound' })).toBe(false);
    expect(gateValue({ s: 'bd', bank: 'NoSuchMachine' })).toBe(false);
    expect(gateValue({ s: 42 })).toBe(false);
    expect(gateValue({ note: 'c3' })).toBe(true); // no sound: the default synth
  });

  it('clamps loud, harsh and heavy values', () => {
    const value: Record<string, unknown> = {
      s: 'sawtooth', gain: 100, delayfeedback: 1.5, resonance: 200, shape: 1, unison: 64, speed: -100, orbit: 9.7,
    };
    expect(gateValue(value)).toBe(true);
    expect(value).toMatchObject({ gain: 1, delayfeedback: 0.8, resonance: 30, shape: 0.9, unison: 8, speed: -4, orbit: 3 });
  });

  it('removes values that are not finite and values that change the tempo', () => {
    const value: Record<string, unknown> = { s: 'bd', gain: Number.NaN, room: Infinity, cps: 9 };
    expect(gateValue(value)).toBe(true);
    expect(value).toEqual({ s: 'bd' });
  });
});
