import { describe, expect, it } from 'vitest';
import { strudelLib } from '../server/strudel-lib.ts';
import { checkSong } from '../shared/check.ts';
import { EMPTY_SONG, type Op, type Song } from '../shared/schema.ts';
import { applyOps, toStrudelCode } from '../shared/song.ts';
import { DRUM_BANKS, KNOWN_SOUNDS, SOUND_GROUPS } from '../shared/sounds.ts';
import { RECIPES } from '../server/prompt.ts';

const noRestore = () => undefined;
const layer = (id: string, code: string): Op => ({ op: 'set_layer', id, role: 'drums', code, muted: false });

describe('applyOps', () => {
  it('adds, replaces and removes layers', () => {
    let { song, errors } = applyOps(EMPTY_SONG, [layer('drums', 's("bd*4")'), layer('hats', 's("hh*8")')], 'Alice', noRestore);
    expect(errors).toEqual([]);
    expect(song.version).toBe(1);
    ({ song } = applyOps(song, [layer('drums', 's("bd*2")'), { op: 'remove_layer', id: 'hats' }], 'Bob', noRestore));
    expect(song.layers).toEqual([{ id: 'drums', role: 'drums', code: 's("bd*2")', muted: false, author: 'Bob', since: 2 }]);
  });

  it('reports bad operations and keeps the good ones', () => {
    const { song, errors } = applyOps(EMPTY_SONG, [layer('drums', 's("bd*4")'), layer('Bad', 's("bd")'), { op: 'set_tempo', bpm: 400 }], 'Alice', noRestore);
    expect(errors.map((e) => e.index)).toEqual([1, 2]);
    expect(song.layers.map((l) => l.id)).toEqual(['drums']);
  });

  it('keeps the same song when nothing applies', () => {
    expect(applyOps(EMPTY_SONG, [], 'Alice', noRestore).song).toBe(EMPTY_SONG);
    expect(applyOps(EMPTY_SONG, [{ op: 'remove_layer', id: 'x' }], 'Alice', noRestore).song).toBe(EMPTY_SONG);
  });

  it('restores an earlier version as a new version', () => {
    const v1 = applyOps(EMPTY_SONG, [layer('drums', 's("bd*4")')], 'Alice', noRestore).song;
    const v2 = applyOps(v1, [layer('drums', 's("bd*2")')], 'Alice', noRestore).song;
    const v3 = applyOps(v2, [{ op: 'restore_version', version: 1 }], 'Bob', (n) => (n === 1 ? v1 : undefined)).song;
    expect(v3.version).toBe(3);
    expect(v3.layers[0].code).toBe('s("bd*4")');
  });

  it('allows restore_version only on its own', () => {
    const { errors } = applyOps(EMPTY_SONG, [{ op: 'restore_version', version: 1 }, { op: 'set_tempo', bpm: 100 }], 'Bob', noRestore);
    expect(errors[0].message).toContain('only operation');
  });

  it('writes Strudel code with labels', () => {
    const { song } = applyOps(EMPTY_SONG, [layer('drums', 's("bd*4")'), { ...layer('pad', 'note("c3")'), muted: true } as Op], 'Alice', noRestore);
    expect(toStrudelCode(song)).toBe(`samples('github:tidalcycles/dirt-samples')\nsetcpm(120/4)\ndrums: s("bd*4")\n_pad: note("c3")`);
  });
});

describe('checkSong', () => {
  const songWith = (code: string): Song => ({ ...EMPTY_SONG, layers: [{ id: 'x', role: 'drums', code, muted: false, author: 'A', since: 1 }] });

  it('passes a normal layer', () => {
    expect(checkSong(songWith('s("bd*4, hh*8")'), strudelLib).issues).toEqual([]);
  });

  it('flags a layer with too many events', () => {
    expect(checkSong(songWith('s("[[bd*16]*16]")'), strudelLib).issues[0].message).toContain('256 events');
  });

  it('flags unknown sounds, also through a bank', () => {
    expect(checkSong(songWith('s("bd kazoo")'), strudelLib).issues[0].message).toContain('kazoo');
    expect(checkSong(songWith('s("bd").bank("RolandTR909")'), strudelLib).issues).toEqual([]);
    expect(checkSong(songWith('s("bd").bank("Casio9000")'), strudelLib).issues[0].message).toContain('Casio9000_bd');
  });

  it('knows every sound that the system prompt offers', () => {
    const offered = Object.entries(SOUND_GROUPS).filter(([group]) => !group.startsWith('drum machines')).flatMap(([, names]) => names);
    expect(offered.filter((name) => !KNOWN_SOUNDS.has(name))).toEqual([]);
    for (const bank of DRUM_BANKS) expect(KNOWN_SOUNDS.has(`${bank}_bd`)).toBe(true);
  });

  it.each(RECIPES)('passes the check for the %s recipe', (_, code) => {
    expect(checkSong(songWith(code), strudelLib).issues).toEqual([]);
  });

  it('plays the break and sample techniques from the system prompt', () => {
    for (const code of ['s("amencutup*8").n("0 1 2 3 4 5 6 7")', 's("breaks165").fit()', 's("breaks165").loopAt(2).chop(8)', 's("breaks165").splice(8, "0 1 <2 6> 3 4 5 6 7")']) {
      expect(checkSong(songWith(code), strudelLib).issues).toEqual([]);
    }
  });

  it('flags markup in a sound name (the validator lets mini-notation through)', () => {
    expect(checkSong(songWith('s("<script>alert(1)</script>")'), strudelLib).issues.length).toBeGreaterThan(0);
  });

  it('checks sounds that come in late in the arrangement', () => {
    expect(checkSong(songWith('s("industrial*2").bank("RolandTR909").mask("<0!16 1!16>")'), strudelLib).issues[0].message).toContain('RolandTR909_industrial');
  });

  it('flags chord names that Strudel does not know', () => {
    expect(checkSong(songWith('chord("<Cm7 Ab^7 Bb G7sus>").voicing()'), strudelLib).issues).toEqual([]);
    expect(checkSong(songWith('chord("<Cm7 Abmaj7 Bb>").voicing()'), strudelLib).issues[0].message).toContain('Abmaj7');
  });

  it('flags invalid note names', () => {
    expect(checkSong(songWith('note("cm3 c3")'), strudelLib).issues[0].message).toContain('cm3');
  });
});
