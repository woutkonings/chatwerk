import { describe, expect, it } from 'vitest';
import { strudelLib } from '../server/strudel-lib.ts';
import { checkSong } from '../shared/check.ts';
import { automationValue, layerPattern } from '../shared/layer.ts';
import type { Layer, Song } from '../shared/schema.ts';
import { applyOps } from '../shared/song.ts';

const layer = (id: string, role: Layer['role'], code: string, extra: Partial<Layer> = {}): Layer =>
  ({ id, role, code, muted: false, author: 'x', since: 1, ...extra });
const song = (layers: Layer[], extra: Partial<Song> = {}): Song => ({ version: 1, bpm: 130, root: 'A', scale: 'minor', layers, ...extra });
const onsets = (pattern: any, cycle = 0) => pattern.queryArc(cycle, cycle + 1).filter((hap: any) => hap.hasOnset());
const noRestore = () => undefined;

describe('automation', () => {
  it('moves a filter on an exponential scale and keeps the end value', () => {
    const automation = { param: 'lpf' as const, to: 4000, at: 8, bars: 4 };
    expect(automationValue(automation, 400, 7)).toBe(400);
    expect(automationValue(automation, 400, 10)).toBeCloseTo(Math.sqrt(400 * 4000));
    expect(automationValue(automation, 400, 20)).toBe(4000);
  });

  it('starts from the end value of the previous automation of the same parameter', () => {
    const { song: next } = applyOps(
      song([layer('acid', 'lead', 'note("a1*4").s("sawtooth")', { automation: [{ param: 'lpf', to: 3000, at: 0, bars: 16 }] })]),
      [{ op: 'automate', id: 'acid', param: 'lpf', to: 500, start: 3, bars: 7 }], 'Bob', noRestore,
    );
    expect(next.layers[0].automation).toEqual([{ param: 'lpf', to: 500, from: 3000, at: -1, start: 4, bars: 8 }]);
  });

  it('changes the events of the layer in the player and the check', () => {
    const acid = layer('acid', 'lead', 'note("a1*4").s("sawtooth").lpf(400)', { automation: [{ param: 'lpf', to: 4000, at: 0, bars: 4 }] });
    const pattern = layerPattern(acid, {}, strudelLib);
    expect(onsets(pattern, 0)[0].value.cutoff).toBe(400);
    expect(onsets(pattern, 5)[0].value.cutoff).toBe(4000);
  });
});

describe('variations and swing', () => {
  it('applies rhythm variations by code', () => {
    const hats = layer('hats', 'drums', 's("hh*8")');
    expect(onsets(layerPattern(hats, {}, strudelLib)).length).toBe(8);
    expect(onsets(layerPattern({ ...hats, vary: ['ghost'] }, {}, strudelLib)).length).toBe(16);
    expect(onsets(layerPattern({ ...hats, vary: ['fill'] }, {}, strudelLib), 3).length).toBe(16); // every 4th bar
    const kick = layer('kick', 'drums', 's("bd*4")');
    const begins = onsets(layerPattern({ ...kick, vary: ['offbeat'] }, {}, strudelLib)).map((hap: any) => Number(hap.whole.begin));
    expect(begins).toEqual([1 / 8, 3 / 8, 5 / 8, 7 / 8]);
  });

  it('shuffles every layer with the song swing', () => {
    const hats = layer('hats', 'drums', 's("hh*16")');
    const begins = onsets(layerPattern(hats, { swing: 0.2 }, strudelLib)).map((hap: any) => Number(hap.whole.begin));
    expect(begins[0]).toBe(0);
    expect(begins[1]).toBeGreaterThan(1 / 16);
  });

  it('sets the variations and the swing with operations', () => {
    const start = song([layer('hats', 'drums', 's("hh*8")')]);
    const timing = { start: 0, style: 'cut' as const, bars: 1 };
    const { song: next, errors } = applyOps(start, [
      { op: 'vary', id: 'hats', kinds: ['ghost', 'thin', 'ghost'], timing },
      { op: 'set_swing', amount: 0.9 },
      { op: 'set_phase', kind: 'peak' },
    ], 'Bob', noRestore);
    expect(errors).toEqual([]);
    expect(next.layers[0].vary).toEqual(['ghost', 'thin']);
    expect(next.swing).toBe(0.3);
    expect(applyOps(start, [{ op: 'set_phase', kind: 'peak' }], 'Bob', noRestore).song).toBe(start); // the room handles it
  });
});

describe('song check', () => {
  it('finds a scale in another key', () => {
    const { issues } = checkSong(song([layer('bass', 'bass', 'n("0 3").scale("C2:major").s("sawtooth")')]), strudelLib);
    expect(issues[0].message).toMatch(/scale C2:major, but the song is in A minor/);
    expect(checkSong(song([layer('bass', 'bass', 'n("0 3").scale("A1:minor").s("sawtooth")')]), strudelLib).issues).toEqual([]);
  });

  it('finds two delay settings on one effect bus', () => {
    const { issues } = checkSong(song([
      layer('stab', 'chords', 's("cp*2").delay(.5).delaytime(3/16).delayfeedback(.6).orbit(3)'),
      layer('rim', 'perc', 's("rim*4").delay(.5).delaytime(1/8).delayfeedback(.6).orbit(3)'),
    ]), strudelLib);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: 'rim', message: expect.stringMatching(/orbit 3/) });
  });

  it('counts variations in the density limit', () => {
    const { issues } = checkSong(song([layer('hats', 'drums', 's("hh*20, cp*20")', { vary: ['ghost'] })]), strudelLib);
    expect(issues[0].message).toMatch(/has 8\d events in one cycle, the maximum is 64/); // 40 hits, doubled by the ghost notes
  });
});

describe('mix report', () => {
  const kick = layer('kick', 'drums', 's("bd*4").bank("RolandTR909")');
  const bass = layer('bass', 'bass', 'note("[~ a1]*4").s("sawtooth")');
  const hats = layer('hats', 'drums', 's("hh*8").bank("RolandTR909")');
  const pad = layer('pad', 'pad', 'note("<a3 c4>").s("supersaw")');

  it('estimates more energy for a full groove than for a pad alone', () => {
    const full = checkSong(song([kick, bass, hats, pad]), strudelLib).report!;
    const quiet = checkSong(song([pad]), strudelLib).report!;
    expect(full.energy).toBeGreaterThanOrEqual(5.5);
    expect(quiet.energy).toBeLessThanOrEqual(2.5);
    expect(quiet.lines[0]).toMatch(/No low end/);
  });

  it('finds a square groove, and accepts a syncopated one', () => {
    const square = checkSong(song([kick, bass, hats]), strudelLib).report!;
    expect(square.lines.some((line) => /square/.test(line))).toBe(true);
    const broken = layer('perc', 'perc', 's("rim(5,16,2)")');
    expect(checkSong(song([kick, bass, hats, broken]), strudelLib).report!.lines.some((line) => /square/.test(line))).toBe(false);
  });

  it('finds two layers in the same register, and two layers that sound the same', () => {
    const acid = layer('acid', 'lead', 'note("[a1 c2]*4").s("sawtooth")');
    const report = checkSong(song([layer('bass2', 'bass', 'note("[a1 c2]*4").s("sawtooth")'), { ...acid, role: 'arp' }]), strudelLib).report!;
    expect(report.lines.some((line) => /same register/.test(line))).toBe(true);
    expect(report.lines.some((line) => /same rhythm and notes/.test(line))).toBe(true);
  });
});

describe('motifs', () => {
  const withMotif = (layers: Layer[]) => song(layers, { motifs: { a: '0 ~ 3 5' } });

  it('lets layers share a motif, and writes the notes for strudel.cc', async () => {
    const bass = layer('bass', 'bass', 'n(motif("a")).scale("A1:minor").s("sawtooth")');
    const notes = onsets(layerPattern(bass, withMotif([bass]), strudelLib)).map((hap: any) => hap.value.note);
    expect(notes).toEqual(['A1', 'D2', 'F2']); // degrees 0, 3 and 5 of A minor
    const { toStrudelCode } = await import('../shared/song.ts');
    expect(toStrudelCode(withMotif([bass]))).toContain('bass: n("0 ~ 3 5").scale("A1:minor")');
  });

  it('rejects an unknown motif and a motif in more than two layers', () => {
    const unknown = checkSong(song([layer('bass', 'bass', 'n(motif("b")).scale("A1:minor").s("sawtooth")')]), strudelLib);
    expect(unknown.issues[0].message).toMatch(/no motif "b"/);
    const three = ['bass', 'acid', 'stab'].map((id, i) => layer(id, 'lead', `n(motif("a")).add(${i * 7}).scale("A1:minor").s("sawtooth")`));
    const { issues } = checkSong(withMotif(three), strudelLib);
    expect(issues.map((issue) => issue.id)).toEqual(['stab']);
  });

  it('sets and removes motifs with checked notes', () => {
    const start = song([]);
    expect(applyOps(start, [{ op: 'set_motif', name: 'a', notes: '0 3 [5 7]' }], 'Bob', noRestore).song.motifs).toEqual({ a: '0 3 [5 7]' });
    expect(applyOps(start, [{ op: 'set_motif', name: 'a', notes: 'fetch(1)' }], 'Bob', noRestore).errors[0].message).toMatch(/scale degrees/);
    const removed = applyOps(withMotif([]), [{ op: 'set_motif', name: 'a', notes: '' }], 'Bob', noRestore).song;
    expect(removed.motifs).toEqual({});
  });

  it('accepts motif("name") in the validator, and nothing else as its argument', async () => {
    const { validateLayer } = await import('../shared/validate.ts');
    expect(validateLayer('n(motif("a")).s("sawtooth")').ok).toBe(true);
    expect(validateLayer('n(motif("a b")).s("sawtooth")').ok).toBe(false);
    expect(validateLayer('n(motif(s("bd"))).s("sawtooth")').ok).toBe(false);
  });
});

describe('kick rules', () => {
  it('keeps the kick on the beat', () => {
    const start = song([layer('kick', 'drums', 's("bd*4").bank("RolandTR909")')]);
    const timing = { start: 0, style: 'cut' as const, bars: 1 };
    const { errors } = applyOps(start, [{ op: 'vary', id: 'kick', kinds: ['offbeat'], timing }], 'Bob', noRestore);
    expect(errors[0].message).toMatch(/off the beat/);
    expect(applyOps(start, [{ op: 'vary', id: 'kick', kinds: ['fill'], timing }], 'Bob', noRestore).errors).toEqual([]);
  });
});
