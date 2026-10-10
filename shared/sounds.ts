// The sounds that the app loads, and the groups that go into the system prompt.
// The app loads the same sample sets as strudel.cc, plus Dirt-Samples (breaks,
// rave sounds, vocals), so a strudel.cc link plays the same song. The full
// list of sample names is generated from web/public/sounds/*.json (shared/sound-names.ts).
import { SAMPLE_NAMES } from './sound-names.ts';

// Drum machines play through .bank(), for example s("bd*4").bank("RolandTR909").
export const DRUM_BANKS = [
  'RolandTR909', 'RolandTR808', 'RolandTR707', 'RolandTR606', 'LinnDrum', 'OberheimDMX',
  'AkaiMPC60', 'EmuSP12', 'RolandCompurhythm1000', 'SequentialCircuitsDrumtracks',
] as const;

const SYNTHS = ['sine', 'triangle', 'square', 'sawtooth', 'supersaw', 'pulse'];
const NOISE = ['white', 'pink', 'brown', 'crackle'];
const RETRO = ['z_sine', 'z_triangle', 'z_square', 'z_sawtooth', 'z_tan', 'z_noise'];

export const SOUND_GROUPS = {
  [`drum machines, through .bank(): ${DRUM_BANKS.join(' ')}. Sounds (not every bank has all)`]: [
    'bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd', 'cb', 'sh', 'perc',
  ],
  'breaks: amencutup is the Amen break in 32 slices (n 0 to 31); the others are full loops at the bpm in the name': [
    'amencutup', 'breaks125', 'breaks152', 'breaks157', 'breaks165', 'jungle', 'hardcore',
  ],
  'club and rave one-shots': [
    'clubkick', 'hardkick', 'reverbkick', 'gabba', 'stab', 'hoover', 'rave', 'rave2', 'house', 'techno',
    'industrial', 'realclaps', 'linnhats', 'glitch', 'bleep',
  ],
  'bass samples (pitched with note or n)': ['jvbass', 'jungbass', 'bassdm', 'moog', 'juno'],
  'vocals': ['yeah', 'mouth', 'speech', 'miniyeah', 'diphone'],
  'percussion': ['tabla', 'conga', 'bongo', 'cowbell', 'tambourine', 'shaker_small', 'woodblock', 'clave', 'mridangam_ta', 'mridangam_thom'],
  'keys and mallets (pitched)': ['piano', 'fmpiano', 'clavisynth', 'organ_full', 'marimba', 'vibraphone', 'kalimba', 'glockenspiel', 'tubularbells', 'harp'],
  'winds (pitched)': ['sax', 'saxello', 'recorder_tenor_sus', 'ocarina', 'harmonica', 'didgeridoo'],
  'synths (pitched)': SYNTHS,
  'noise': NOISE,
  'retro synths (pitched)': RETRO,
} as Record<string, readonly string[]>;

export const KNOWN_SOUNDS: ReadonlySet<string> = new Set([...SAMPLE_NAMES, ...SYNTHS, ...NOISE, ...RETRO]);
