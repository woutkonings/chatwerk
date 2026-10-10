// The mix report: what the band "hears". Code renders a few bars of the song
// without audio and measures it: an energy estimate, register clashes, a
// square groove, layers that sound the same, an empty low end. The report goes
// into the next agent turn, so the model gets ears, and the UI shows it.
import type { Finding, MixReport } from './protocol.ts';
import type { Role, Song } from './schema.ts';

// One rendered layer: its role and its events over the measured bars.
export type RenderedLayer = { id: string; role: Role; haps: any[]; cycles: number };

const KICKS = /^(bd|kick|clubkick|hardkick|reverbkick|gabba|909|808bd)$/i;
const PITCHED: ReadonlySet<Role> = new Set(['bass', 'chords', 'pad', 'lead', 'arp']);

const stepOf = (hap: any) => Math.round((Number(hap.whole.begin) % 1) * 16) % 16;
const soundOf = (value: any) => (typeof value?.s === 'string' ? value.s : '');

function midiOf(value: any, noteToMidi: (note: string) => number): number | null {
  if (typeof value?.note === 'number') return value.note;
  if (typeof value?.note === 'string') {
    try {
      return noteToMidi(value.note);
    } catch {
      return null;
    }
  }
  return null;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const noteName = (midi: number) => `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export function mixReport(song: Song, layers: RenderedLayer[], noteToMidi: (note: string) => number): MixReport {
  const lines: string[] = [];
  const findings: Finding[] = [];
  const audible = layers.filter((layer) => layer.haps.length > 0);
  const perCycle = (layer: RenderedLayer) => layer.haps.length / layer.cycles;

  // Energy: a rough 1 to 10 scale from the parts that drive a club track.
  // Calibration: kick, hats and a filtered bass are about 5; a full peak with
  // 7 or 8 layers and open filters is about 9; pads alone are about 2.
  const kick = audible.find((layer) => {
    const onQuarters = layer.haps.filter((hap) => KICKS.test(soundOf(hap.value)) && stepOf(hap) % 4 === 0).length;
    return onQuarters / layer.cycles >= 3.5;
  });
  const bass = audible.some((layer) => layer.role === 'bass');
  const hats = audible.some((layer) => layer !== kick && (layer.role === 'drums' || layer.role === 'perc') && perCycle(layer) >= 12);
  const total = audible.reduce((sum, layer) => sum + perCycle(layer), 0);
  // Brightness counts the pitched layers: open filters on bass, chords and leads lift a track.
  const cutoffs = audible
    .filter((layer) => PITCHED.has(layer.role))
    .flatMap((layer) => layer.haps.map((hap) => (typeof hap.value?.cutoff === 'number' ? hap.value.cutoff : 8000)));
  const brightness = cutoffs.length ? Math.min(1, Math.max(0, Math.log(median(cutoffs) / 200) / Math.log(50))) : 0;
  let energy = 0.5 + (kick ? 1.5 : 0) + (bass ? 1 : 0) + (hats ? 0.5 : 0);
  energy += Math.min(2, total / 40) + Math.min(2.5, audible.length * 0.35) + brightness * 1.5;
  energy = Math.round(Math.min(10, Math.max(1, energy)) * 2) / 2;

  if (!kick && !bass && audible.length) {
    lines.push('No low end: no four-on-the-floor kick and no bass.');
    findings.push({ kind: 'lowend', ids: [] });
  }

  // Register: two pitched layers low in the mix around the same note blur together.
  const pitched = audible
    .filter((layer) => PITCHED.has(layer.role))
    .map((layer) => {
      const notes = layer.haps.map((hap) => midiOf(hap.value, noteToMidi)).filter((midi): midi is number => midi !== null);
      return { id: layer.id, center: notes.length ? median(notes) : null };
    })
    .filter((layer): layer is { id: string; center: number } => layer.center !== null);
  for (let i = 0; i < pitched.length; i++) {
    for (let j = i + 1; j < pitched.length; j++) {
      const [a, b] = [pitched[i], pitched[j]];
      if (Math.abs(a.center - b.center) <= 4 && Math.min(a.center, b.center) < 60) {
        lines.push(`${a.id} and ${b.id} sit in the same register (around ${noteName(Math.round((a.center + b.center) / 2))}); move one an octave up or down.`);
        findings.push({ kind: 'register', ids: [a.id, b.id] });
      }
    }
  }

  // Groove: hits on the odd 16ths (and a shuffle) make syncopation.
  const groove = audible.filter((layer) => layer !== kick && layer.role !== 'pad' && layer.role !== 'chords');
  const hits = groove.flatMap((layer) => layer.haps.map(stepOf));
  const odd = hits.filter((step) => step % 2 === 1).length;
  if (hits.length >= 8 && odd / hits.length < 0.1 && !(song.swing && song.swing > 0)) {
    lines.push('The groove is square: almost no hits on the odd 16ths. Add syncopation (ghost notes, an offbeat or syncopated bass, euclid(5,16) or (7,16) percussion) or a light swing.');
    findings.push({ kind: 'square', ids: groove.map((layer) => layer.id) });
  }

  // Sameness: two layers with the same rhythm and the same notes.
  const fingerprints = new Map<string, string>();
  for (const layer of audible) {
    if (layer.haps.length < 4) continue;
    const print = layer.haps.map((hap) => `${stepOf(hap)}:${midiOf(hap.value, noteToMidi) ?? soundOf(hap.value)}`).join(' ');
    const twin = fingerprints.get(print);
    if (twin) {
      lines.push(`${twin} and ${layer.id} play the same rhythm and notes; make one of them different.`);
      findings.push({ kind: 'same', ids: [twin, layer.id] });
    }
    else fingerprints.set(print, layer.id);
  }

  if (total > 100) {
    lines.push(`Very busy: about ${Math.round(total)} events per bar. Thin out a layer.`);
    findings.push({ kind: 'busy', ids: [] });
  }
  return { energy, lines: lines.slice(0, 5), findings };
}
