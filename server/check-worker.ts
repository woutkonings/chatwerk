// Runs the song check off the main thread, so the parent can stop it with a
// timeout when a pattern is too dense to compute.
import { parentPort } from 'node:worker_threads';
import { checkSong } from '../shared/check.ts';
import type { Song } from '../shared/schema.ts';
import { strudelLib } from './strudel-lib.ts';

parentPort!.on('message', (song: Song) => {
  try {
    parentPort!.postMessage({ ok: true, result: checkSong(song, strudelLib) });
  } catch (error) {
    parentPort!.postMessage({ ok: false, message: (error as Error).message });
  }
});
// Warm up before the first real check, because a cold worker is several times slower.
const WARM_UP: Song = {
  version: 0, bpm: 130, root: 'A', scale: 'minor',
  layers: [
    's("bd*4, [~ cp]*2").bank("RolandTR909")',
    's("hh*16").velocity("[.6 .9 .7 1]*4").degradeBy(.1).pan(sine.slow(4))',
    'note("[~ a1 a1 a1]*4").s("sawtooth").lpf(sine.range(200, 600).slow(16)).sometimesBy(.2, x => x.transpose(12))',
    'chord("<Am9!3 Dm9>").struct("[~ ~ x ~] ~").voicing().s("sawtooth").mask("<0!8 1!24>")',
    's("amencutup*8").n("0 1 2 3 4 5 6 7")',
  ].map((code, i) => ({ id: `w${i}`, role: 'drums', code, muted: false, author: '', since: 0 })),
};
for (let i = 0; i < 3; i++) checkSong(WARM_UP, strudelLib);
parentPort!.postMessage({ ready: true });
