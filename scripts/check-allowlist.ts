// Checks that every allowlisted name exists in the installed Strudel version
// and that no denied name is on the allowlist. Run: npm run allowlist:check
import { DENIED, FUNCTIONS, METHODS, SIGNALS } from '../shared/allowlist.ts';
import { strudelLib } from '../server/strudel-lib.ts';

const { Pattern, scope } = strudelLib;
const problems: string[] = [];

const hasMethod = (name: string) => {
  for (let o = Pattern.prototype; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    if (Object.getOwnPropertyDescriptor(o, name)) return true;
  }
  return false;
};

for (const name of FUNCTIONS) if (typeof scope[name] !== 'function') problems.push(`function missing: ${name}`);
for (const name of SIGNALS) if (!(scope[name] instanceof Pattern)) problems.push(`signal missing: ${name}`);
for (const name of METHODS) if (!hasMethod(name)) problems.push(`method missing: ${name}`);
const allowed = new Set<string>([...FUNCTIONS, ...SIGNALS, ...METHODS]);
for (const name of DENIED) if (allowed.has(name)) problems.push(`denied name is allowed: ${name}`);

console.log(`${FUNCTIONS.length} functions, ${SIGNALS.length} signals, ${METHODS.length} methods`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('allowlist ok');
