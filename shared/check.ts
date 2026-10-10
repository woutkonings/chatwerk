// Builds every layer of a song and queries a few cycles without audio. It
// finds layers that fail to build, layers with too many events, and unknown
// sound, note and chord names. The server runs it in a worker with a timeout
// (server/check-song.ts), because a dense pattern can block the thread.
import type { Song } from './schema.ts';
import { buildLayer, type StrudelLib } from './interpret.ts';
import { KNOWN_SOUNDS } from './sounds.ts';
import { parseLayer } from './validate.ts';

// The bars to check: the first 8, then every fourth bar up to bar 64. Layers often
// come in later through mask("<0!16 1!16>"), so the first bars alone are not enough.
export const CHECK_CYCLES: readonly number[] = [
  ...Array.from({ length: 8 }, (_, i) => i),
  ...Array.from({ length: 14 }, (_, i) => 8 + i * 4),
];
export const MAX_EVENTS_PER_CYCLE_LAYER = 64;
export const MAX_EVENTS_PER_CYCLE_SONG = 256;

export type LayerIssue = { id: string; message: string };
export type CheckResult = { issues: LayerIssue[]; eventsPerCycle: Record<string, number> };

// Chord symbols that Strudel's voicing dictionaries know, for example "m7" or "^7".
function chordSymbols(lib: StrudelLib): Set<string> {
  const registry = (lib.scope.voicingRegistry ?? {}) as Record<string, { dictionary?: object }>;
  return new Set(Object.values(registry).flatMap((entry) => Object.keys(entry.dictionary ?? {})));
}

// Strudel skips an unknown chord with only a log line, so the chord is silent.
// This finds chord names in the mini-notation of chord("...") calls.
function unknownChords(code: string, symbols: Set<string>): string[] {
  const unknown = new Set<string>();
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    const isChordCall = node.type === 'CallExpression' &&
      ((node.callee.type === 'Identifier' && node.callee.name === 'chord') ||
        (node.callee.type === 'MemberExpression' && node.callee.property.name === 'chord'));
    const arg = isChordCall ? node.arguments[0] : undefined;
    const text = arg?.type === 'Literal' ? arg.value : arg?.type === 'TemplateLiteral' ? arg.quasis[0].value.cooked : undefined;
    if (typeof text === 'string') {
      for (const word of text.split(/[\s<>[\]{}(),|!@*/%~.:_?]+/)) {
        if (!word || /^\d+(\.\d+)?$/.test(word)) continue; // counts and lengths, as in "Am9!3" or "/4"
        const match = /^[A-G][#b]?(.*)$/.exec(word);
        if (!match || !symbols.has(match[1])) unknown.add(word);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && 'type' in value) visit(value);
    }
  };
  visit(parseLayer(code));
  return [...unknown];
}

export function checkSong(song: Song, lib: StrudelLib): CheckResult {
  const issues: LayerIssue[] = [];
  const eventsPerCycle: Record<string, number> = {};
  const noteToMidi = lib.scope.noteToMidi as (note: string) => number;
  const symbols = chordSymbols(lib);
  let total = 0;

  for (const layer of song.layers) {
    const fail = (message: string) => issues.push({ id: layer.id, message });
    let haps: any[];
    try {
      const pattern = buildLayer(layer.code, lib);
      haps = CHECK_CYCLES.flatMap((cycle) => pattern.queryArc(cycle, cycle + 1));
    } catch (error) {
      fail(`does not build: ${(error as Error).message}`);
      continue;
    }

    const perCycle = new Map<number, number>();
    const unknownSounds = new Set<string>();
    const badNotes = new Set<string>();
    for (const hap of haps) {
      if (!hap.whole) continue; // a continuous signal, not an event
      const cycle = Math.floor(Number(hap.whole.begin));
      perCycle.set(cycle, (perCycle.get(cycle) ?? 0) + 1);
      const value = hap.value;
      if (value === null || typeof value !== 'object') continue;
      if (typeof value.s === 'string') {
        const sound = typeof value.bank === 'string' ? `${value.bank}_${value.s}` : value.s;
        if (!KNOWN_SOUNDS.has(sound)) unknownSounds.add(sound);
      }
      if (typeof value.note === 'string') {
        try {
          noteToMidi(value.note);
        } catch {
          badNotes.add(value.note);
        }
      }
    }

    const peak = Math.max(0, ...perCycle.values());
    eventsPerCycle[layer.id] = peak;
    if (!layer.muted) total += peak;
    if (peak > MAX_EVENTS_PER_CYCLE_LAYER) fail(`has ${peak} events in one cycle, the maximum is ${MAX_EVENTS_PER_CYCLE_LAYER}`);
    if (unknownSounds.size) fail(`uses unknown sounds: ${[...unknownSounds].join(', ')}`);
    if (badNotes.size) fail(`uses invalid note names: ${[...badNotes].join(', ')}`);
    const badChords = unknownChords(layer.code, symbols);
    if (badChords.length) fail(`uses unknown chord names: ${badChords.join(', ')} (write C^7 for major 7, Cm7 for minor 7)`);
  }

  if (total > MAX_EVENTS_PER_CYCLE_SONG) {
    issues.push({ id: '*', message: `the song has ${total} events in one cycle, the maximum is ${MAX_EVENTS_PER_CYCLE_SONG}` });
  }
  return { issues, eventsPerCycle };
}
