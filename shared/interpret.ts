// Builds a Strudel pattern from a validated layer without eval. It walks the
// syntax tree and calls only allowlisted functions from the Strudel scope and
// allowlisted methods on real Pattern objects. So agent text never runs as
// JavaScript, and the page can forbid eval in its Content-Security-Policy.
import { FUNCTION_SET, METHOD_SET, SIGNAL_SET } from './allowlist.ts';
import { constantNumber, parseLayer, validateLayer } from './validate.ts';

// What the interpreter needs from Strudel. The server loads it from the
// separate packages, the browser from @strudel/web.
export type StrudelLib = {
  Pattern: any;
  mini: (source: string) => unknown;
  scope: Record<string, any>;
  motifs?: Record<string, string>; // the motifs of the song, for motif("a")
};

type Binding = { name: string; value: unknown } | null;

export function buildLayer(source: string, lib: StrudelLib): any {
  const verdict = validateLayer(source);
  if (!verdict.ok) throw new Error(verdict.reason);
  const { Pattern, mini, scope } = lib;

  const evaluate = (node: any, binding: Binding): any => {
    switch (node.type) {
      case 'Literal':
        // Every string is mini-notation, so a raw string never reaches a control.
        return typeof node.value === 'string' ? mini(node.value) : node.value;
      case 'TemplateLiteral':
        return mini(node.quasis[0].value.cooked);
      case 'ArrayExpression':
        return node.elements.map((element: any) => evaluate(element, binding));
      case 'UnaryExpression':
      case 'BinaryExpression':
        return constantNumber(node);
      case 'Identifier': {
        if (binding && node.name === binding.name) return binding.value;
        const known = FUNCTION_SET.has(node.name) || SIGNAL_SET.has(node.name);
        if (!known || !Object.hasOwn(scope, node.name)) throw new Error(`"${node.name}" is not available`);
        return scope[node.name];
      }
      case 'ArrowFunctionExpression': {
        const name = node.params[0].name;
        return (value: unknown) => evaluate(node.body, { name, value });
      }
      case 'CallExpression': {
        if (node.callee.type === 'Identifier' && node.callee.name === 'motif') {
          const name = node.arguments[0].value as string;
          const notes = lib.motifs && Object.hasOwn(lib.motifs, name) ? lib.motifs[name] : undefined;
          if (notes === undefined) throw new Error(`there is no motif "${name}"`);
          return mini(notes);
        }
        const args = node.arguments.map((arg: any) => evaluate(arg, binding));
        if (node.callee.type === 'Identifier') {
          return Reflect.apply(evaluate(node.callee, binding), undefined, args);
        }
        const receiver = evaluate(node.callee.object, binding);
        const name = node.callee.property.name;
        if (!(receiver instanceof Pattern) || !METHOD_SET.has(name)) throw new Error(`".${name}" needs a pattern`);
        // Some methods (add, sub, mul, ...) are getters, so read them with the pattern as receiver.
        const method = Reflect.get(Pattern.prototype, name, receiver);
        if (typeof method !== 'function') throw new Error(`".${name}" is not a method in this Strudel version`);
        return Reflect.apply(method, receiver, args);
      }
    }
    throw new Error(`${node.type} is not supported`);
  };

  const pattern = evaluate(parseLayer(source), null);
  if (!(pattern instanceof Pattern)) throw new Error('the layer does not make a pattern');
  return pattern;
}
