// Plays the room song with @strudel/web, without Strudel's evaluate(). Each
// layer goes through the same validator and interpreter as on the server.
// Safety: a voice cap, a gain curve, the hap gate and a master limiter.
// Sync: the player follows the room clock, so every listener hears the same
// bar at the same time, and a change with a transition lands on one beat.
import * as strudel from '@strudel/web';
import { buildLayer, type StrudelLib } from '../../shared/interpret.ts';
import { cycleAt, type RoomClock } from '../../shared/protocol.ts';
import type { Song } from '../../shared/schema.ts';
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

export class Player {
  playing = false;
  private repl: any = null;
  private song: Song | null = null;
  private clock: RoomClock | null = null;
  private roomPattern: any = strudel.silence; // the song in room cycles
  private offset = 0; // local scheduler cycle + offset = room cycle
  private timer: ReturnType<typeof setInterval> | null = null;
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
    if (this.clock) this.repl.setCps(this.clock.cps);
    preload(this.compose(), this.roomNow());
    await this.repl.setPattern(strudel.silence, true);
    this.playing = true;
    // The scheduler needs a few ticks before its cycle position is exact.
    setTimeout(() => this.resync(true), 400);
    this.timer = setInterval(() => this.resync(), RESYNC_MS);
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.repl?.stop();
  }

  setVolume(value: number) {
    volume = value;
    if (master) master.gain.setTargetAtTime(value, master.context.currentTime, 0.05);
  }

  // A new song from the server. With `applyAt`, the change lands at that room cycle.
  setSong(song: Song, clock: RoomClock, applyAt: number | null) {
    const tempoChanged = this.clock !== null && this.clock.cps !== clock.cps;
    this.song = song;
    this.clock = clock;
    const next = this.compose();
    if (replReady) preload(next, applyAt ?? this.roomNow());
    if (this.playing && applyAt !== null && applyAt > this.roomNow()) {
      const at = applyAt;
      this.roomPattern = strudel.stack(
        this.roomPattern.filterHaps((hap: any) => hap.whole && hap.whole.begin < at),
        next.filterHaps((hap: any) => hap.whole && hap.whole.begin >= at),
      );
    } else {
      this.roomPattern = next;
    }
    if (!this.playing) return;
    if (tempoChanged) {
      this.repl.setCps(clock.cps);
      setTimeout(() => this.resync(true), 400);
    }
    this.apply();
  }

  // Local mute and solo change only what this listener hears.
  setLocal(mutes: Set<string>, solo: string | null) {
    this.mutes = new Set(mutes);
    this.solo = solo;
    if (!this.song) return;
    this.roomPattern = this.compose();
    if (this.playing) this.apply();
  }

  private compose(): any {
    const song = this.song;
    if (!song) return strudel.silence;
    const errors: LayerErrors = {};
    const parts: any[] = [];
    for (const layer of song.layers) {
      let pattern: any;
      try {
        pattern = buildLayer(layer.code, lib);
      } catch (error) {
        errors[layer.id] = (error as Error).message;
        continue;
      }
      const audible = this.solo ? this.solo === layer.id : !layer.muted && !this.mutes.has(layer.id);
      if (audible) parts.push(guard(pattern, (message) => this.reportError(layer.id, message)));
    }
    this.errors = errors;
    this.onErrors({ ...errors });
    return parts.length ? strudel.stack(...parts) : strudel.silence;
  }

  private reportError(id: string, message: string) {
    if (this.errors[id] === message) return;
    this.errors = { ...this.errors, [id]: message };
    this.onErrors(this.errors);
  }

  private roomNow(): number {
    return this.clock ? cycleAt(this.clock, this.serverClock.now()) : 0;
  }

  // Finds the offset between the local scheduler and the room clock. The output
  // latency of the device (for example Bluetooth) counts, so the speakers line up.
  private resync(force = false) {
    if (!this.playing || !this.clock) return;
    const context: AudioContext = strudel.getAudioContext();
    const latencyMs = (context.outputLatency || context.baseLatency || 0) * 1000;
    const room = cycleAt(this.clock, this.serverClock.now() + latencyMs);
    const offset = Math.round((room - this.repl.scheduler.now()) * 1000) / 1000;
    if (!force && Math.abs(offset - this.offset) < MAX_DRIFT_CYCLES) return;
    this.offset = offset;
    this.apply();
  }

  // For tests in the browser console: the room cycle that this listener hears now.
  debug() {
    const local = this.playing ? this.repl.scheduler.now() : null;
    return { playing: this.playing, offset: this.offset, cps: this.clock?.cps, heardCycle: local === null ? null : local + this.offset, roomCycle: this.roomNow() };
  }

  private apply() {
    void this.repl.setPattern(this.roomPattern.early(this.offset), true);
  }
}
