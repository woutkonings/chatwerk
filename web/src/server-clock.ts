// Estimates the server time in the browser, NTP style. Each ping/pong pair
// gives a sample; the sample with the shortest round trip is the most exact.
// Old samples expire, so the estimate follows a slow clock drift.
const MAX_SAMPLES = 12;

type Sample = { rtt: number; offset: number; at: number };

export class ServerClock {
  private samples: Sample[] = [];

  static localMs(): number {
    return performance.timeOrigin + performance.now();
  }

  // `sentMs` is the local time of the ping, `serverMs` the server time in the pong.
  addSample(sentMs: number, serverMs: number) {
    const now = ServerClock.localMs();
    const rtt = now - sentMs;
    if (rtt < 0 || rtt > 5000) return;
    this.samples.push({ rtt, offset: serverMs - (sentMs + rtt / 2), at: now });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  get synced(): boolean {
    return this.samples.length >= 3;
  }

  get offsetMs(): number {
    if (!this.samples.length) return 0;
    return this.samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  }

  now(): number {
    return ServerClock.localMs() + this.offsetMs;
  }
}
