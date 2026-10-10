// Lets Node load the Strudel packages. Some dependencies point "main" at a
// build file that is missing or lacks the named exports that Strudel uses.
// This hook sends those imports to a build file that exists and fits the
// caller (ES module for import, CommonJS for require). Load it with `--import`.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const BROKEN_MAIN = /^(@kabelsalat\/web|@tonaljs\/[a-z-]+)$/;

registerHooks({
  resolve(specifier, context, next) {
    if (!BROKEN_MAIN.test(specifier)) return next(specifier, context);
    const pkgUrl = next(`${specifier}/package.json`, context).url;
    const isRequire = context.conditions?.includes('require');
    const candidates = isRequire ? ['dist/index.cjs', 'dist/index.js'] : ['dist/index.mjs'];
    for (const file of candidates) {
      const url = pkgUrl.replace(/package\.json$/, file);
      if (existsSync(fileURLToPath(url))) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
