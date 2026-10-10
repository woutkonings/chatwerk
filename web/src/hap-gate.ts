// The last check before a sound plays. Every event goes through this gate on
// its way to the audio engine. It drops unknown sounds, removes values that
// change the tempo, and clamps numbers to safe ranges, so a bad layer can never
// be very loud, very harsh or very heavy for the CPU.
import { KNOWN_SOUNDS } from '../../shared/sounds.ts';

// Value keys as Strudel names them (lpf sets "cutoff", hpf sets "hcutoff", and so on).
const RANGES: Record<string, [number, number]> = {
  gain: [0, 1], velocity: [0, 1], postgain: [0, 1], dry: [0, 1],
  room: [0, 1], roomsize: [0, 10],
  delay: [0, 1], delayfeedback: [0, 0.8], delaytime: [0, 2],
  speed: [-4, 4], begin: [0, 1], end: [0, 1], clip: [0, 8],
  cutoff: [20, 20000], hcutoff: [20, 20000], bandf: [20, 20000],
  resonance: [0, 30], hresonance: [0, 30], bandq: [0, 30],
  lpenv: [-8, 8], hpenv: [-8, 8],
  lpattack: [0, 4], lpdecay: [0, 4], lpsustain: [0, 1], lprelease: [0, 8],
  attack: [0, 4], decay: [0, 4], sustain: [0, 1], release: [0, 8],
  shape: [0, 0.9], distort: [0, 2], crush: [1, 16], coarse: [1, 64],
  pan: [0, 1], orbit: [0, 3], duckorbit: [0, 3],
  unison: [1, 8], detune: [0, 2], spread: [0, 1],
  fmi: [0, 16], fmh: [0, 16],
  phaserrate: [0, 20], phaserdepth: [0, 1],
  vib: [0, 20], vibmod: [0, 12],
  duckdepth: [0, 1], duckattack: [0, 2],
  n: [-128, 128], note: [0, 127], freq: [20, 20000],
};

// Keys that must never reach the scheduler or the audio engine.
const DENIED = ['cps', 'cpm', 'worklet', 'src', 'bbexpr'];

// Returns false when the event must not play. Changes the value in place,
// because the scheduler reads `cps` from the same object after the output call.
export function gateValue(value: Record<string, unknown>): boolean {
  for (const key of DENIED) delete value[key];
  if (typeof value.s === 'string') {
    const sound = typeof value.bank === 'string' ? `${value.bank}_${value.s}` : value.s;
    if (!KNOWN_SOUNDS.has(sound)) return false;
  } else if (value.s !== undefined) {
    return false;
  }
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    const number = value[key];
    if (typeof number !== 'number') continue;
    if (!Number.isFinite(number)) delete value[key];
    else value[key] = Math.min(max, Math.max(min, number));
  }
  if (typeof value.orbit === 'number') value.orbit = Math.round(value.orbit);
  return true;
}
