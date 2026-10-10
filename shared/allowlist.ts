// The Strudel names that agent code may use. Everything else is rejected.
// Add names by hand only, after you check what they do. Never add a name that
// runs code, loads a URL, changes the tempo or touches the page (see DENIED).
// `npm run allowlist:check` checks that every name exists in Strudel.

// Top-level functions: pattern constructors, controls and curried transforms
// (for example `every(4, rev)` or `every(3, fast(2))`).
export const FUNCTIONS = [
  // constructors
  's', 'sound', 'note', 'n', 'chord', 'stack', 'cat', 'seq', 'sequence', 'fastcat', 'slowcat',
  'arrange', 'polymeter', 'run', 'irand', 'choose', 'chooseCycles', 'randcat', 'wchoose', 'wrandcat',
  // curried transforms, used as arguments
  'rev', 'fast', 'slow', 'ply', 'palindrome', 'iter', 'degrade', 'degradeBy', 'early', 'late',
  'hurry', 'chop', 'striate', 'add', 'sub', 'mul', 'speed', 'crush', 'coarse', 'room', 'gain',
  'lpf', 'hpf', 'pan', 'shape', 'delay', 'vowel', 'velocity', 'transpose',
] as const;

// Signals: continuous patterns that are used as values, for example `sine.range(200, 2000)`.
export const SIGNALS = [
  'sine', 'cosine', 'saw', 'isaw', 'tri', 'square', 'rand', 'perlin', 'silence',
] as const;

// Methods on patterns.
export const METHODS = [
  // time and structure
  'fast', 'slow', 'early', 'late', 'ply', 'hurry', 'rev', 'palindrome', 'iter', 'iterBack', 'chunk',
  'linger', 'segment', 'seg', 'range', 'rangex', 'euclid', 'euclidRot', 'euclidLegato', 'struct',
  'mask', 'every', 'firstOf', 'lastOf', 'sometimes', 'often', 'rarely', 'almostNever',
  'almostAlways', 'someCycles', 'sometimesBy', 'degrade', 'degradeBy', 'off', 'jux', 'juxBy',
  'superimpose', 'layer', 'echo', 'echoWith', 'swing', 'swingBy', 'inside', 'outside', 'zoom',
  'compress', 'ribbon', 'arp', 'arpWith',
  // samples
  'chop', 'striate', 'slice', 'splice', 'loopAt', 'fit', 'begin', 'end', 'cut', 'speed', 'bank',
  // notes and harmony
  's', 'sound', 'n', 'note', 'scale', 'transpose', 'scaleTranspose', 'voicing', 'rootNotes',
  'anchor', 'dict', 'mode',
  // arithmetic
  'add', 'sub', 'mul', 'div', 'round', 'floor',
  // envelope and length
  'clip', 'legato', 'sustain', 'attack', 'decay', 'release', 'att', 'dec', 'rel', 'adsr',
  // level and space
  'gain', 'velocity', 'postgain', 'pan', 'orbit', 'room', 'size', 'roomsize', 'delay',
  'delaytime', 'delayfeedback', 'dry',
  // filters
  'lpf', 'cutoff', 'lpq', 'resonance', 'hpf', 'hcutoff', 'hpq', 'bpf', 'bpq', 'vowel', 'ftype',
  'lpenv', 'lpattack', 'lpdecay', 'lpsustain', 'lprelease', 'hpenv',
  // colour and modulation
  'crush', 'coarse', 'shape', 'distort', 'phaser', 'phaserdepth', 'vib', 'vibmod', 'fm', 'fmh',
  'fmi', 'unison', 'spread', 'detune',
  // sidechain: a kick with duckorbit(2) ducks every sound on orbit 2
  'duckorbit', 'duckattack', 'duckdepth',
] as const;

// Names that must never be allowed. A test checks that the lists above contain none of them.
export const DENIED = [
  // JavaScript escape routes
  'constructor', '__proto__', 'prototype', 'toString', 'valueOf', 'call', 'apply', 'bind',
  // Strudel paths from a string or a function to code, or to a URL
  'worklet', 'bbexpr', 'byteBeatExpression', 'as', 'source', 'src', 'onTrigger', 'fmap',
  'withValue', 'samples', 'aliasBank', 'tables', 'registerWorklet', 'rawdsp', 'dspWorklet',
  'loadBuffer', 'K', 'compileKabel', 'evaluate', 'evalScope',
  // raw values, logging, global state and tempo
  'set', 'keep', 'pure', 'log', 'speak', 'p', 'q', 'hush', 'all', 'each', 'setGainCurve',
  'setMaxPolyphony', 'setcps', 'setcpm', 'setCps', 'setCpm', 'cpm', 'cps',
  // widgets and external outputs
  'slider', 'midi', 'osc', 'mqtt', 'serial', 'pianoroll', 'punchcard', 'scope', 'spiral',
] as const;

export const FUNCTION_SET: ReadonlySet<string> = new Set(FUNCTIONS);
export const SIGNAL_SET: ReadonlySet<string> = new Set(SIGNALS);
export const METHOD_SET: ReadonlySet<string> = new Set(METHODS);
