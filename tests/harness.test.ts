import { describe, expect, it } from 'vitest';
import { enforce, tempoNote, tempoPolicy } from '../server/harness.ts';
import type { AgentTurn, Song } from '../shared/schema.ts';

const SONG: Song = {
  version: 3, bpm: 132, root: 'A', scale: 'minor',
  layers: [{ id: 'kick', role: 'drums', code: 's("bd*4")', muted: false, author: 'Alice', since: 1 }],
};
const say = (...texts: string[]) => texts.map((text) => ({ author: 'Bob', text }));
const turn = (ops: AgentTurn['ops']): AgentTurn => ({ plan: '', ops, when: 'next_phrase', reply: '', summary: '' });

describe('tempo policy', () => {
  it('locks the tempo when nobody asks for another one, also for a new style', () => {
    for (const text of ['make it breakbeat', 'more like electro breakbeat', 'now back to techy stabby synth', 'add a 909 kick', 'more space in the mix']) {
      expect(tempoPolicy(SONG, say(text))).toEqual({ kind: 'locked', bpm: 132 });
    }
  });

  it('allows a tempo change when a user asks for one', () => {
    expect(tempoPolicy(SONG, say('a bit faster please'))).toEqual({ kind: 'asked', bpm: null, by: 'Bob' });
    expect(tempoPolicy(SONG, say('kan het wat sneller?'))).toMatchObject({ kind: 'asked', bpm: null });
    expect(tempoPolicy(SONG, say('go to 140 bpm'))).toMatchObject({ kind: 'asked', bpm: 140 });
    expect(tempoPolicy(SONG, say('jungle at 170'))).toMatchObject({ kind: 'asked', bpm: 170 });
  });

  it('leaves the tempo free for an empty song', () => {
    expect(tempoPolicy({ ...SONG, layers: [] }, say('start a dark techno groove'))).toEqual({ kind: 'free' });
  });

  it('tells the agent the rule for this turn', () => {
    expect(tempoNote({ kind: 'locked', bpm: 132 }, SONG)).toMatch(/locked at 132 bpm/);
    expect(tempoNote({ kind: 'asked', bpm: 140, by: 'Bob' }, SONG)).toMatch(/Bob asks for 140 bpm/);
  });
});

describe('enforce', () => {
  it('removes a tempo change that nobody asked for', () => {
    const t = turn([{ op: 'set_tempo', bpm: 140 }, { op: 'set_key', root: 'A', scale: 'minor' }]);
    const notes = enforce(t, { kind: 'locked', bpm: 132 }, SONG);
    expect(t.ops).toEqual([{ op: 'set_key', root: 'A', scale: 'minor' }]);
    expect(notes[0]).toMatch(/removed set_tempo 140/);
  });

  it('uses the number that the user asked for, and limits a step without a number', () => {
    const asked = turn([{ op: 'set_tempo', bpm: 150 }]);
    enforce(asked, { kind: 'asked', bpm: 140, by: 'Bob' }, SONG);
    expect(asked.ops).toEqual([{ op: 'set_tempo', bpm: 140 }]);
    const vague = turn([{ op: 'set_tempo', bpm: 160 }]);
    enforce(vague, { kind: 'asked', bpm: null, by: 'Bob' }, SONG);
    expect(vague.ops).toEqual([{ op: 'set_tempo', bpm: 142 }]);
  });

  it('rounds the timing to allowed values', () => {
    const t = turn([{ op: 'set_layer', id: 'pad', role: 'pad', code: 'note("a3")', muted: false, timing: { start: 6, style: 'fade', bars: 7 } }]);
    enforce(t, { kind: 'locked', bpm: 132 }, SONG);
    expect(t.ops[0]).toMatchObject({ timing: { start: 4, style: 'fade', bars: 8 } });
  });
});
