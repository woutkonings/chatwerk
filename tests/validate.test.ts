import { describe, expect, it } from 'vitest';
import { DENIED, FUNCTIONS, METHODS, SIGNALS } from '../shared/allowlist.ts';
import { validateLayer } from '../shared/validate.ts';
import { ATTACKS, GOOD_LAYERS } from './layers.ts';

describe('validateLayer', () => {
  it.each(GOOD_LAYERS)('accepts %s', (layer) => {
    expect(validateLayer(layer)).toEqual({ ok: true });
  });

  it.each(ATTACKS)('rejects %s', (layer) => {
    expect(validateLayer(layer).ok).toBe(false);
  });

  it('gives a reason the agent can act on', () => {
    expect(validateLayer('s("bd").wobble(2)')).toEqual({ ok: false, reason: 'unknown method ".wobble"' });
  });
});

describe('allowlist', () => {
  it('contains no denied name', () => {
    const allowed = new Set<string>([...FUNCTIONS, ...SIGNALS, ...METHODS]);
    expect(DENIED.filter((name) => allowed.has(name))).toEqual([]);
  });
});
