// Loads the Strudel pattern library in Node (no audio). The server uses it to
// build and query agent patterns. Run Node with `--import ./server/strudel-node.mjs`.
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal';
import type { StrudelLib } from '../shared/interpret.ts';

export const strudelLib: StrudelLib = {
  Pattern: core.Pattern,
  mini: (source: string) => mini.m(source, 0),
  scope: { ...core, ...mini, ...tonal },
};
