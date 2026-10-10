// Plays the room song with @strudel/web, without Strudel's evaluate(). Each
// layer goes through the same validator and interpreter as on the server.
// Safety: a voice cap, a gain curve, the hap gate and a master limiter.
// Sync: the player follows the room clock, so every listener hears the same
// bar at the same time, and a change with a transition lands on one beat.
import * as strudel from '@strudel/web';
import type { StrudelLib } from '../../shared/interpret.ts';
import { layerPattern, layerSignature } from '../../shared/layer.ts';
import { clockAt, roomCycle, type Timeline } from '../../shared/protocol.ts';
import type { Song } from '../../shared/schema.ts';
import { changeEnd, transitionLayer, type LayerChange } from '../../shared/transition.ts';
import { gateValue } from './hap-gate.ts';
import type { ServerClock } from './server-clock.ts';

const lib: StrudelLib = { Pattern: strudel.Pattern, mini: (source) => strudel.m(source, 0), scope: strudel };

const MAX_POLYPHONY = 64;
const SOUND_MAPS = ['tidal-drum-machines', 'dirt-samples', 'uzu-drumkit', 'vcsl', 'piano', 'mridangam'];
// The player corrects its phase when it is this many cycles away from the room clock.
const MAX_DRIFT_CYCLES = 0.02;
const RESYNC_MS = 5000;

// This must run before initStrudel(), because the first call sets the options.
// Without it, the voice cap is off (setMaxPolyphony(undefined) gives NaN).
const audioReady: Promise<void> = strudel.initAudioOnFirstClick({ maxPolyphony: MAX_POLYPHONY });

// --- master limiter: compressor, then a soft clipper, then the volume ---

let limiterInput: AudioNode | null = null;
let master: GainNode | null = null;
let volume = 0.8;
const routed = new WeakSet<AudioNode>();

function softClipCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    const size = Math.abs(x);
    const y = size <= 0.6 ? size : 0.6 + 0.4 * Math.tanh((size - 0.6) / 0.4);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

// Superdough connects its output straight to the speakers, and it makes a new
// output node after a reset. So every event checks that the output goes through the limiter.
function ensureLimiter() {
  const ac: AudioContext = strudel.getAudioContext();
  if (!limiterInput) {
    const compressor = new DynamicsCompressorNode(ac, { threshold: -12, knee: 6, ratio: 12, attack: 0.003, release: 0.25 });
    const clipper = new WaveShaperNode(ac, { curve: softClipCurve(), oversample: '2x' });
    master = new GainNode(ac, { gain: volume });
    compressor.connect(clipper).connect(master).connect(ac.destination);
    limiterInput = compressor;
  }
  const controller = strudel.getSuperdoughAudioController();
  // The kick ducks orbit 2 (sidechain). Superdough makes an orbit at its first sound, so make them all now.
  for (let orbit = 0; orbit <= 3; orbit++) controller.getOrbit(orbit);
  const output: AudioNode | null = controller.output.destinationGain;
  if (output && !routed.has(output)) {
    output.disconnect();
    output.connect(limiterInput);
    routed.add(output);
  }
}

// The hap gate: every event passes here on its way to the audio engine.
function gatedOutput(hap: any, deadline: number, duration: number, cps: number, t: number) {
  if (hap.value === null || typeof hap.value !== 'object' || !gateValue(hap.value)) return;
  ensureLimiter();
  return strudel.webaudioOutput(hap, deadline, duration, cps, t);
}

let replReady: Promise<any> | null = null;

function initRepl(): Promise<any> {
  replReady ??= (async () => {
    const repl = await strudel.initStrudel({
      defaultOutput: gatedOutput,
      prebake: () => Promise.all([
        strudel.registerZZFXSounds(),
        ...SOUND_MAPS.map((name) => strudel.samples(`/sounds/${name}.json`)),
      ]),
    });
    strudel.setGainCurve((value: unknown) => (typeof value === 'number' ? Math.min(1, Math.max(0, value)) : value));
    return repl;
  })();
  return replReady;
}

// Loads the samples of the coming bars before they play. Without this, the
// first hits of a new sound are lost while the sample downloads.
function preload(pattern: any, from: number, cycles = 8) {
  let haps: any[];
  try {
    haps = pattern.queryArc(Math.max(0, from), Math.max(0, from) + cycles);
  } catch {
    return;
  }
  const seen = new Set<string>();
  for (const hap of haps) {
    const value = hap.value;
    if (value === null || typeof value !== 'object' || typeof value.s !== 'string') continue;
    const key = typeof value.bank === 'string' ? `${value.bank}_${value.s}` : value.s;
    const id = `${key}:${value.n ?? 0}:${value.note ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const sound = strudel.getSound(key);
    if (sound?.data?.type !== 'sample') continue;
    strudel.getSampleBuffer({ ...value, s: key }, sound.data.samples).catch(() => undefined);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A query error in one layer must not silence the other layers.
function guard(pattern: any, onError: (message: string) => void): any {
  return new strudel.Pattern((state: unknown) => {
    try {
      return pattern.query(state);
    } catch (error) {
      onError((error as Error).message);
      return [];
    }
  });
}

export type LayerErrors = Record<string, string>;
export type LayerPreview = { t: number; length: number; velocity: number; midi: number | null; sound: string | null }[];

const outputLatencyMs = () => {
  const context: AudioContext = strudel.getAudioContext();
  return (context.outputLatency || context.baseLatency || 0) * 1000;
};
// The scheduler plans events about 0.1 s ahead of the audio clock.
const SCHEDULER_LEAD_MS = 100;

// One layer as this listener hears it. `pattern` includes a running transition;
// after room cycle `settles`, the plain pattern sounds the same. The signature
// holds what makes the layer sound different (code, variations, automations,
// swing). A removed layer has no signature and no plain pattern, and stays only
// while it fades out.
type Track = { signature: string | null; plain: any | null; pattern: any | null; settles: number };

export class Player {
  playing = false;
  private repl: any = null;
  private clocks: Timeline = [];
  private tracks = new Map<string, Track>();
  private offset = 0; // local scheduler cycle + offset = room cycle
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempoTimer: ReturnType<typeof setTimeout> | null = null;
  private schedulerCps: number | null = null;
  private mutes = new Set<string>();
  private solo: string | null = null;
  private errors: LayerErrors = {};

  constructor(private serverClock: ServerClock, private onErrors: (errors: LayerErrors) => void) {}

  // Call this from a click handler: browsers start audio only after a user gesture.
  async start() {
    const context: AudioContext = strudel.getAudioContext();
    void context.resume();
    this.repl = await initRepl();
    await Promise.race([audioReady, sleep(1500)]);
    strudel.setMaxPolyphony(MAX_POLYPHONY);
    ensureLimiter();
    this.schedulerCps = null;
    this.applyTempo();
    preload(this.mix(), this.roomNow());
    await this.repl.setPattern(strudel.silence, true);
    this.playing = true;
    // The scheduler needs a few ticks before its cycle position is exact.
    setTimeout(() => this.resync(true), 400);
    this.timer = setInterval(() => this.resync(), RESYNC_MS);
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    if (this.tempoTimer) clearTimeout(this.tempoTimer);
    this.timer = null;
    this.repl?.stop();
  }

  setVolume(value: number) {
    volume = value;
    if (master) master.gain.setTargetAtTime(value, master.context.currentTime, 0.05);
  }

  // A new song from the server. Each changed layer cuts, fades or filters as
  // `changes` says, from room cycle `applyAt`. Without `applyAt` (a snapshot), or
  // while the player is stopped, the song replaces the old one at once.
  setSong(song: Song, clocks: Timeline, applyAt: number | null, changes: Record<string, LayerChange> = {}) {
    this.clocks = clocks;
    if (this.repl) this.applyTempo();
    const now = this.roomNow();
    const errors: LayerErrors = {};
    const targets = new Map<string, { signature: string; plain: any }>();
    for (const layer of song.layers) {
      if (layer.muted) continue;
      try {
        const plain = guard(layerPattern(layer, song, lib), (message) => this.reportError(layer.id, message));
        targets.set(layer.id, { signature: layerSignature(layer, song), plain });
      } catch (error) {
        errors[layer.id] = (error as Error).message;
      }
    }
    for (const id of new Set([...this.tracks.keys(), ...targets.keys()])) {
      const track = this.tracks.get(id);
      const target = targets.get(id) ?? null;
      if ((track?.signature ?? null) === (target?.signature ?? null)) continue; // unchanged
      const change = this.playing && applyAt !== null ? changes[id] ?? { at: applyAt, style: 'cut' as const, bars: 0 } : null;
      if (!change) {
        this.tracks.set(id, { signature: target?.signature ?? null, plain: target?.plain ?? null, pattern: target?.plain ?? null, settles: -Infinity });
        continue;
      }
      const from = track ? (track.settles <= now ? track.plain : track.pattern) : null;
      const pattern = transitionLayer(lib, from, target?.plain ?? null, change);
      this.tracks.set(id, { signature: target?.signature ?? null, plain: target?.plain ?? null, pattern, settles: changeEnd(change) });
      if (target && replReady) preload(target.plain, change.at);
    }
    this.errors = errors;
    this.onErrors({ ...errors });
    this.cleanUp(now);
    if (this.playing) this.apply();
  }

  // Local mute and solo change only what this listener hears.
  setLocal(mutes: Set<string>, solo: string | null) {
    this.mutes = new Set(mutes);
    this.solo = solo;
    if (this.playing) this.apply();
  }

  // The room cycle now, for the transition labels in the UI.
  roomNow(): number {
    return this.clocks.length ? roomCycle(this.clocks, this.serverClock.now()) : 0;
  }

  // All audible layers, in room cycles.
  private mix(): any {
    const now = this.roomNow();
    const parts: any[] = [];
    for (const [id, track] of this.tracks) {
      const audible = this.solo ? this.solo === id : !this.mutes.has(id);
      const pattern = track.settles <= now ? track.plain : track.pattern;
      if (audible && pattern) parts.push(pattern);
    }
    return parts.length ? strudel.stack(...parts) : strudel.silence;
  }

  // Removed layers leave when their fade-out is over.
  private cleanUp(now: number) {
    for (const [id, track] of this.tracks) if (track.signature === null && track.settles <= now) this.tracks.delete(id);
  }

  private reportError(id: string, message: string) {
    if (this.errors[id] === message) return;
    this.errors = { ...this.errors, [id]: message };
    this.onErrors(this.errors);
  }

  // Sets the scheduler tempo to the clock segment it plans for, and sets a timer
  // for the next segment (a tempo change on a bar line).
  private applyTempo() {
    if (this.tempoTimer) clearTimeout(this.tempoTimer);
    this.tempoTimer = null;
    if (!this.repl || !this.clocks.length) return;
    const leadMs = outputLatencyMs() + SCHEDULER_LEAD_MS;
    const planned = this.serverClock.now() + leadMs;
    const target = clockAt(this.clocks, planned);
    if (target.cps !== this.schedulerCps) {
      this.repl.setCps(target.cps);
      if (this.schedulerCps !== null && this.playing) setTimeout(() => this.resync(true), 400);
      this.schedulerCps = target.cps;
    }
    const next = this.clocks.find((clock) => clock.serverMs > planned);
    if (next) this.tempoTimer = setTimeout(() => this.applyTempo(), next.serverMs - planned);
  }

  // Finds the offset between the local scheduler and the room clock. The output
  // latency of the device (for example Bluetooth) counts, so the speakers line up.
  private resync(force = false) {
    if (!this.playing || !this.clocks.length) return;
    this.cleanUp(this.roomNow());
    const room = roomCycle(this.clocks, this.serverClock.now() + outputLatencyMs());
    const offset = Math.round((room - this.repl.scheduler.now()) * 1000) / 1000;
    if (!force && Math.abs(offset - this.offset) < MAX_DRIFT_CYCLES) return;
    this.offset = offset;
    this.apply();
  }

  // The events of one layer in one bar, for a visual preview (a step grid or a
  // mini piano roll). `t` is the position in the bar (0 to 1), `velocity` 0 to
  // 1, `midi` the note number of a pitched event. Works also when stopped.
  preview(id: string, bar = Math.floor(this.roomNow())): LayerPreview {
    const track = this.tracks.get(id);
    const pattern = track?.plain;
    if (!pattern) return [];
    try {
      return pattern.queryArc(bar, bar + 1)
        .filter((hap: any) => hap.whole && hap.hasOnset())
        .map((hap: any) => {
          const value = hap.value ?? {};
          let midi: number | null = typeof value.note === 'number' ? value.note : null;
          if (typeof value.note === 'string') {
            try {
              midi = strudel.noteToMidi(value.note);
            } catch {
              midi = null;
            }
          }
          const velocity = (typeof value.velocity === 'number' ? value.velocity : 1) * (typeof value.gain === 'number' ? Math.min(1, value.gain) : 1);
          return { t: Number(hap.whole.begin) - bar, length: Number(hap.whole.end) - Number(hap.whole.begin), velocity, midi, sound: typeof value.s === 'string' ? value.s : null };
        });
    } catch {
      return [];
    }
  }

  // For tests in the browser console: the room cycle that this listener hears now.
  debug() {
    const local = this.playing ? this.repl.scheduler.now() : null;
    return {
      playing: this.playing, offset: this.offset, cps: this.schedulerCps, layers: [...this.tracks.keys()],
      heardCycle: local === null ? null : local + this.offset, roomCycle: this.roomNow(),
    };
  }

  private apply() {
    void this.repl.setPattern(this.mix().early(this.offset), true);
  }
}
