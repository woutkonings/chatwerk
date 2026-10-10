// Checks a song in a worker thread with a time limit. One worker stays alive
// between checks. After a timeout the worker is stopped and a new one starts.
import { Worker } from 'node:worker_threads';
import type { CheckResult } from '../shared/check.ts';
import type { Song } from '../shared/schema.ts';

const WORKER_URL = new URL('./check-worker.ts', import.meta.url);
const MEMORY_LIMIT_MB = 128;

let ready: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function startWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { resourceLimits: { maxOldGenerationSizeMb: MEMORY_LIMIT_MB } });
    worker.once('message', () => resolve(worker));
    worker.once('error', reject);
  });
}

// Checks run one at a time, because the worker answers messages in order.
// A normal song takes up to about 200 ms. The time limit stops runaway patterns, which take seconds.
export function checkSongInWorker(song: Song, timeoutMs = 1500): Promise<CheckResult> {
  const result = queue.then(() => runCheck(song, timeoutMs));
  queue = result.catch(() => undefined);
  return result;
}

async function runCheck(song: Song, timeoutMs: number): Promise<CheckResult> {
  ready ??= startWorker();
  const worker = await ready;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.off('message', onMessage);
      ready = null;
      void worker.terminate();
      resolve({ issues: [{ id: '*', message: `the song took longer than ${timeoutMs} ms to compute; make the layers less dense` }], eventsPerCycle: {} });
    }, timeoutMs);
    const onMessage = (message: { ok: boolean; result?: CheckResult; message?: string }) => {
      clearTimeout(timer);
      resolve(message.ok ? message.result! : { issues: [{ id: '*', message: `check failed: ${message.message}` }], eventsPerCycle: {} });
    };
    worker.once('message', onMessage);
    worker.postMessage(song);
  });
}

export async function stopCheckWorker() {
  const current = ready;
  ready = null;
  if (current) await (await current).terminate();
}
