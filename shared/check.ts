// Builds every layer of a song and queries a few cycles without audio. It
// finds layers that fail to build, layers with too many events, unknown sound,
// note and chord names, a scale in another key, and two delay settings on one
// effect bus. It also makes the mix report. The server runs it in a worker with
// a timeout (server/check-song.ts), because a dense pattern can block the thread.
import type { StrudelLib } from './interpret.ts';
import { layerPattern } from './layer.ts';
import type { MixReport } from './protocol.ts';
import { mixReport, type RenderedLayer } from './report.ts';
import { MAX_MOTIF_LAYERS, type Song } from './schema.ts';
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
export type CheckResult = { issues: LayerIssue[]; eventsPerCycle: Record<string, number>; report: MixReport | null };
// The mix report measures the first bars.
const REPORT_CYCLES = 8;

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

// The literal strings of all calls to a function or method, for example scale("A2:minor").
function callStrings(code: string, name: string): string[] {
  const found: string[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    const isCall = node.type === 'CallExpression' &&
      ((node.callee.type === 'Identifier' && node.callee.name === name) ||
        (node.callee.type === 'MemberExpression' && node.callee.property.name === name));
    const arg = isCall ? node.arguments[0] : undefined;
    const text = arg?.type === 'Literal' ? arg.value : arg?.type === 'TemplateLiteral' ? arg.quasis[0].value.cooked : undefined;
    if (typeof text === 'string') found.push(text);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && 'type' in value) visit(value);
    }
  };
  visit(parseLayer(code));
  return found;
}

// Scales in another key than the song. The song key is the shared harmony.
function foreignScales(code: string, song: Song, noteToMidi: (note: string) => number): string[] {
  const pitchClass = (root: string) => {
    try {
      return noteToMidi(`${root}4`) % 12;
    } catch {
      return -1;
    }
  };
  const songRoot = pitchClass(song.root);
  const foreign = new Set<string>();
  for (const text of callStrings(code, 'scale')) {
    for (const word of text.split(/[\s<>[\]{}(),|!@*/%~.?]+/)) {
      const match = /^([A-G][#b]?)-?\d*:([a-z:]+)$/i.exec(word);
      if (match && (pitchClass(match[1]) !== songRoot || match[2].toLowerCase() !== song.scale)) foreign.add(word);
    }
  }
  return [...foreign];
}

export function checkSong(song: Song, lib: StrudelLib): CheckResult {
  const issues: LayerIssue[] = [];
  const eventsPerCycle: Record<string, number> = {};
  const noteToMidi = lib.scope.noteToMidi as (note: string) => number;
  const symbols = chordSymbols(lib);
  let total = 0;
  const rendered: RenderedLayer[] = [];
  const buses = new Map<number, { id: string; time: number; feedback: number }[]>();

  for (const layer of song.layers) {
    const fail = (message: string) => issues.push({ id: layer.id, message });
    let haps: any[];
    try {
      const pattern = layerPattern(layer, song, lib);
      haps = CHECK_CYCLES.flatMap((cycle) => pattern.queryArc(cycle, cycle + 1));
    } catch (error) {
      fail(`does not build: ${(error as Error).message}`);
      continue;
    }
    if (!layer.muted) {
      const onsets = haps.filter((hap) => hap.whole && Number(hap.whole.begin) < REPORT_CYCLES && hap.hasOnset());
      rendered.push({ id: layer.id, role: layer.role, haps: onsets, cycles: REPORT_CYCLES });
      const echo = onsets.find((hap) => typeof hap.value?.delay === 'number' && hap.value.delay > 0)?.value;
      if (echo) {
        const orbit = typeof echo.orbit === 'number' ? echo.orbit : 1;
        const bus = buses.get(orbit) ?? [];
        bus.push({ id: layer.id, time: echo.delaytime ?? 0.25, feedback: echo.delayfeedback ?? 0.5 });
        buses.set(orbit, bus);
      }
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
    const scales = foreignScales(layer.code, song, noteToMidi);
    if (scales.length) fail(`uses scale ${scales.join(', ')}, but the song is in ${song.root} ${song.scale}; use the song key`);
  }

  // A motif in many layers makes them sound the same.
  const motifUsers = new Map<string, string[]>();
  for (const layer of song.layers) {
    if (!layer.code.includes('motif(')) continue;
    for (const name of new Set(callStrings(layer.code, 'motif'))) motifUsers.set(name, [...(motifUsers.get(name) ?? []), layer.id]);
  }
  for (const [name, users] of motifUsers) {
    if (users.length <= MAX_MOTIF_LAYERS) continue;
    for (const id of users.slice(MAX_MOTIF_LAYERS)) {
      issues.push({ id, message: `uses motif "${name}", which ${users.length - 1} other layers use already; use a motif in at most ${MAX_MOTIF_LAYERS} layers` });
    }
  }

  // Delay settings are shared per orbit, so two settings on one orbit fight.
  for (const [orbit, bus] of buses) {
    const first = bus[0];
    for (const other of bus.slice(1)) {
      if (Math.abs(other.time - first.time) > 1e-6 || Math.abs(other.feedback - first.feedback) > 1e-6) {
        const message = `uses delaytime ${other.time} and delayfeedback ${other.feedback} on orbit ${orbit}, but layer "${first.id}" uses ${first.time} and ${first.feedback} there; one orbit has one delay, so use the same values or another orbit (0 to 3)`;
        issues.push({ id: other.id, message });
      }
    }
  }

  if (total > MAX_EVENTS_PER_CYCLE_SONG) {
    issues.push({ id: '*', message: `the song has ${total} events in one cycle, the maximum is ${MAX_EVENTS_PER_CYCLE_SONG}` });
  }
  return { issues, eventsPerCycle, report: mixReport(song, rendered, noteToMidi) };
}
