import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The Strudel packages need the same Node loader fix as the server.
    execArgv: ['--import', './server/strudel-node.mjs'],
  },
});
