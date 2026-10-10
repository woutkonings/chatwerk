// The suggestion engine. Code makes candidate ideas from the current song,
// ranks them by the set phase and the mix report, and keeps the best few that
// differ. No model call, so it is instant and free. The ranker is a function
// type, so a decision model (for example Jev) can replace the heuristic later.
import type { MixReport } from '../shared/protocol.ts';
import { isKick } from '../shared/song.ts';
import { PHASE_LABEL, type SetPosition } from '../shared/set.ts';
import type { Layer, Op, Song, Timing } from '../shared/schema.ts';
import { MAX_SUGGESTIONS, type Suggestion, type SuggestionKind } from '../shared/suggest.ts';

export type SuggestContext = {
  song: Song;
  position: SetPosition | null;
  report: MixReport | null;
  favourite: { version: number; count: number } | null; // the version with the most reactions
  recentKinds: SuggestionKind[]; // the kinds of the last applied ideas
};

export type Candidate = Omit<Suggestion, 'id' | 'votes'>;
export type Ranker = (candidates: Candidate[], context: SuggestContext) => { candidate: Candidate; score: number }[];

const PITCHED = new Set(['bass', 'chords', 'pad', 'lead', 'arp']);
const COLOURABLE = new Set(['chords', 'pad', 'lead', 'arp', 'fx']);
const CUT: Timing = { start: 0, style: 'cut', bars: 1 };
const FILTER = (bars: number): Timing => ({ start: 0, style: 'filter', bars });

// The low-pass value that a layer holds now: an automation end value, or a plain number in the code.
function lowPass(layer: Layer): number | null {
  const automated = layer.automation?.find((a) => a.param === 'lpf');
  if (automated) return automated.to;
  const match = /\.lpf\((\d+(?:\.\d+)?)\)/.exec(layer.code);
  return match ? Number(match[1]) : null;
}

const setLayer = (layer: Layer, changes: Partial<Pick<Layer, 'code' | 'muted'>>, timing: Timing): Op =>
  ({ op: 'set_layer', id: layer.id, role: layer.role, code: changes.code ?? layer.code, muted: changes.muted ?? layer.muted, timing });

export function candidates(context: SuggestContext): Candidate[] {
  const { song, position, report, favourite } = context;
  const out: Candidate[] = [];
  const add = (kind: SuggestionKind, label: string, detail: string, ops: Op[], target: string | null) =>
    out.push({ kind, label, detail, ops, when: 'next_phrase', target });
  const live = song.layers.filter((layer) => !layer.muted);
  const kick = song.layers.find((layer) => layer.role === 'drums' && isKick(layer.code));
  const bass = song.layers.find((layer) => layer.role === 'bass');

  for (const layer of live) {
    const lpf = lowPass(layer);
    if (PITCHED.has(layer.role)) {
      const open = layer.role === 'bass' ? 1400 : 6000;
      const closed = layer.role === 'bass' ? 300 : 600;
      if (lpf === null || lpf < open * 0.6) {
        add('energy-up', `Open the ${layer.id} filter`, `${layer.id}: low-pass opens to ${open} Hz over 16 bars`,
          [{ op: 'automate', id: layer.id, param: 'lpf', to: open, start: 0, bars: 16 }], layer.id);
      }
      if (lpf === null || lpf > closed * 2) {
        add('energy-down', `Close the ${layer.id} filter`, `${layer.id}: low-pass closes to ${closed} Hz over 8 bars`,
          [{ op: 'automate', id: layer.id, param: 'lpf', to: closed, start: 0, bars: 8 }], layer.id);
      }
    }
    if ((layer.role === 'drums' || layer.role === 'perc') && !isKick(layer.code)) {
      const vary = layer.vary ?? [];
      const withVary = (kind: 'ghost' | 'busier' | 'thin' | 'shuffle') => [{ op: 'vary' as const, id: layer.id, kinds: [...vary, kind], timing: CUT }];
      if (vary.length < 3) {
        if (!vary.includes('ghost')) add('groove', `Ghost notes on ${layer.id}`, `${layer.id}: quiet hits a 16th after each hit`, withVary('ghost'), layer.id);
        if (!vary.includes('shuffle')) add('groove', `Shuffle ${layer.id}`, `${layer.id}: swung 16ths`, withVary('shuffle'), layer.id);
        if (!vary.includes('busier') && !vary.includes('thin')) {
          add('energy-up', `Busier ${layer.id}`, `${layer.id}: some hits double`, withVary('busier'), layer.id);
          add('energy-down', `Thin out ${layer.id}`, `${layer.id}: about 30% fewer hits`, withVary('thin'), layer.id);
        }
      }
    }
    if (COLOURABLE.has(layer.role)) {
      add('colour', `More space on ${layer.id}`, `${layer.id}: reverb grows over 8 bars`,
        [{ op: 'automate', id: layer.id, param: 'room', to: 0.6, start: 0, bars: 8 }], layer.id);
      add('colour', `Dub echoes on ${layer.id}`, `${layer.id}: delay grows over 8 bars`,
        [{ op: 'automate', id: layer.id, param: 'delay', to: 0.45, start: 0, bars: 8 }], layer.id);
    }
    if (layer !== kick && layer !== bass && live.length > 2) {
      add('space', `Take ${layer.id} out`, `${layer.id}: filters out over 8 bars and stays muted`, [setLayer(layer, { muted: true }, FILTER(8))], layer.id);
    }
  }

  for (const layer of song.layers.filter((l) => l.muted && l !== kick && l !== bass)) {
    add('energy-up', `Bring ${layer.id} back`, `${layer.id}: filters in over 8 bars`, [setLayer(layer, { muted: false }, FILTER(8))], layer.id);
  }

  const lowEnd = [kick, bass].filter((layer): layer is Layer => Boolean(layer));
  if (lowEnd.some((layer) => layer.muted)) {
    add('drop', 'Drop: kick and bass back', 'kick and bass cut in on the next phrase',
      lowEnd.filter((layer) => layer.muted).map((layer) => setLayer(layer, { muted: false }, CUT)), null);
  } else if (lowEnd.length && (!position || ['build', 'peak', 'journey'].includes(position.phase.kind))) {
    // A breakdown needs energy to break down from: not in the warm-up, the breakdown or the closing.
    add('space', 'Breakdown now', 'kick and bass filter out over 4 bars; the set moves to a breakdown',
      [{ op: 'set_phase', kind: 'breakdown' }, ...lowEnd.map((layer) => setLayer(layer, { muted: true }, FILTER(4)))], null);
  }

  if (live.some((layer) => layer.role === 'drums' || layer.role === 'perc')) {
    if (!song.swing) add('groove', 'Light swing', 'every layer gets a light shuffle', [{ op: 'set_swing', amount: 0.08 }], null);
    else add('groove', 'Straight groove', 'the shuffle goes away', [{ op: 'set_swing', amount: 0 }], null);
  }

  if (position?.next) {
    add('phase', `Go to the ${PHASE_LABEL[position.next.kind].toLowerCase()}`, `the set moves on from the ${PHASE_LABEL[position.phase.kind].toLowerCase()}; the band makes the transition`,
      [{ op: 'set_phase', kind: position.next.kind }], null);
  }

  if (favourite && favourite.version !== song.version && favourite.count > 0) {
    add('restore', `Back to v${favourite.version}`, `the version with ${favourite.count} reaction${favourite.count === 1 ? '' : 's'}`,
      [{ op: 'restore_version', version: favourite.version }], null);
  }

  for (const finding of report?.findings ?? []) {
    const layer = song.layers.find((l) => l.id === finding.ids[1]);
    if (!layer || layer.muted) continue;
    if (finding.kind === 'register' && !layer.code.endsWith('.transpose(12)')) {
      add('fix', `${layer.id} an octave up`, `${layer.id} and ${finding.ids[0]} stop blurring together`,
        [setLayer(layer, { code: `${layer.code}.transpose(12)` }, { start: 0, style: 'fade', bars: 2 })], layer.id);
    }
    if (finding.kind === 'same' && !isKick(layer.code) && !(layer.vary ?? []).includes('offbeat') && (layer.vary ?? []).length < 3) {
      add('fix', `Move ${layer.id} off the beat`, `${layer.id} stops doubling ${finding.ids[0]}`,
        [{ op: 'vary', id: layer.id, kinds: [...(layer.vary ?? []), 'offbeat'], timing: CUT }], layer.id);
    }
  }
  return out;
}

// A small, stable jitter per version, so the same song does not always show the same ideas.
function jitter(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 100) / 200;
}

export const heuristicRanker: Ranker = (list, context) => {
  const { song, position, report, recentKinds } = context;
  const gap = position && report ? position.energy - report.energy : 0;
  const found = new Set((report?.findings ?? []).map((f) => f.kind));
  const phase = position?.phase.kind;
  return list.map((candidate) => {
    let score = 1;
    switch (candidate.kind) {
      case 'energy-up': score += gap > 0.5 ? Math.min(3, gap) : gap < -1 ? -1 : 0; break;
      case 'energy-down': score += gap < -0.5 ? Math.min(3, -gap) : gap > 1 ? -1 : 0; break;
      case 'drop': score += (found.has('lowend') ? 2 : 0) + (phase === 'breakdown' && (position?.barsLeft ?? 0) > 16 ? -2 : 1); break;
      case 'space': score += phase === 'breakdown' || phase === 'closing' ? 1 : phase === 'peak' ? -1 : 0; break;
      case 'groove': score += found.has('square') ? 2 : 0.5; break;
      case 'colour': score += phase === 'journey' || phase === 'breakdown' || phase === 'warmup' ? 0.5 : 0; break;
      case 'phase': score += (position?.barsLeft ?? 999) < 64 ? 1.5 : -0.5; break;
      case 'restore': score += 0.5; break;
      case 'fix': score += 2.5; break;
    }
    if (recentKinds.slice(-2).includes(candidate.kind)) score -= 1.5;
    const target = song.layers.find((layer) => layer.id === candidate.target);
    if (target) score += Math.min(1, (song.version - target.since) / 10);
    return { candidate, score: score + jitter(`${song.version}:${candidate.label}`) };
  });
};

// The best ideas, each of another kind and for another layer.
export function pickSuggestions(context: SuggestContext, ranker: Ranker = heuristicRanker, limit = MAX_SUGGESTIONS * 2): Candidate[] {
  const ranked = ranker(candidates(context), context).sort((a, b) => b.score - a.score);
  const kinds = new Set<string>();
  const targets = new Set<string>();
  const picked: Candidate[] = [];
  for (const { candidate } of ranked) {
    if (kinds.has(candidate.kind) || (candidate.target && targets.has(candidate.target))) continue;
    kinds.add(candidate.kind);
    if (candidate.target) targets.add(candidate.target);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}
