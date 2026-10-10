// Applies agent operations to a song, and writes a song as Strudel code for
// people to read. Each operation either applies or gets an error message that
// goes back to the agent.
import {
  LAYER_ID, MAX_BPM, MAX_LAYERS, MAX_SONG_BYTES, MIN_BPM, ROLES, ROOTS, SCALES,
  type Op, type Song,
} from './schema.ts';
import { validateLayer } from './validate.ts';

export type OpError = { index: number; op: Op['op']; message: string };

export type ApplyResult = { song: Song; errors: OpError[] };

// `restore` returns an earlier version of the song, or undefined if there is none.
export function applyOps(
  song: Song,
  ops: Op[],
  author: string,
  restore: (version: number) => Song | undefined,
): ApplyResult {
  const version = song.version + 1;
  const errors: OpError[] = [];
  let next: Song = { ...song, version, layers: [...song.layers] };

  if (ops.some((op) => op.op === 'restore_version') && ops.length > 1) {
    return { song, errors: [{ index: 0, op: 'restore_version', message: 'restore_version must be the only operation' }] };
  }

  ops.forEach((op, index) => {
    const fail = (message: string) => errors.push({ index, op: op.op, message });
    switch (op.op) {
      case 'set_tempo':
        if (!Number.isFinite(op.bpm) || op.bpm < MIN_BPM || op.bpm > MAX_BPM) return fail(`bpm must be ${MIN_BPM} to ${MAX_BPM}`);
        next.bpm = Math.round(op.bpm);
        return;
      case 'set_key':
        if (!ROOTS.includes(op.root) || !SCALES.includes(op.scale)) return fail('unknown root or scale');
        next.root = op.root;
        next.scale = op.scale;
        return;
      case 'set_layer': {
        if (!LAYER_ID.test(op.id)) return fail(`layer id "${op.id}" must match ${LAYER_ID}`);
        if (!ROLES.includes(op.role)) return fail(`unknown role "${op.role}"`);
        const verdict = validateLayer(op.code);
        if (!verdict.ok) return fail(`layer "${op.id}": ${verdict.reason}`);
        const at = next.layers.findIndex((layer) => layer.id === op.id);
        if (at === -1 && next.layers.length >= MAX_LAYERS) return fail(`a song has at most ${MAX_LAYERS} layers`);
        const layer = { id: op.id, role: op.role, code: op.code, muted: op.muted, author, since: version };
        if (at === -1) next.layers.push(layer);
        else next.layers[at] = layer;
        return;
      }
      case 'remove_layer': {
        const at = next.layers.findIndex((layer) => layer.id === op.id);
        if (at === -1) return fail(`there is no layer "${op.id}"`);
        next.layers.splice(at, 1);
        return;
      }
      case 'restore_version': {
        const earlier = restore(op.version);
        if (!earlier) return fail(`there is no version ${op.version}`);
        next = { ...earlier, version, layers: earlier.layers.map((layer) => ({ ...layer })) };
        return;
      }
    }
  });

  // Each failed operation adds exactly one error. Without a change, keep the version.
  if (errors.length === ops.length) return { song, errors };
  if (JSON.stringify(next).length > MAX_SONG_BYTES) {
    return { song, errors: [...errors, { index: -1, op: 'set_layer', message: `the song is larger than ${MAX_SONG_BYTES} bytes` }] };
  }
  return { song: next, errors };
}

// The song in Strudel's own label format, for the code view and for strudel.cc.
export function toStrudelCode(song: Song): string {
  // strudel.cc preloads the other sample sets; Dirt-Samples (breaks, rave, vocals) must be loaded.
  const lines = [`samples('github:tidalcycles/dirt-samples')`, `setcpm(${song.bpm}/4)`];
  for (const layer of song.layers) lines.push(`${layer.muted ? '_' : ''}${layer.id}: ${layer.code}`);
  return lines.join('\n');
}

// A link that opens the song in the official Strudel REPL (same encoding as strudel.cc).
export function strudelUrl(song: Song): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(toStrudelCode(song))) binary += String.fromCharCode(byte);
  return `https://strudel.cc/#${encodeURIComponent(btoa(binary))}`;
}
