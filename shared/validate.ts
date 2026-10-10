// Checks one agent layer before anything runs it. A layer is one Strudel
// expression. The check is an allowlist: it accepts only a small set of syntax
// and only the Strudel names in allowlist.ts. It parses with acorn and the same
// options as the Strudel transpiler, so both see the same syntax tree.
//
// The checks on numbers and mini-notation are early feedback for the agent.
// The real limits are the density check (density.ts) and the clamps in the player.
import { parse, type Node } from 'acorn';
import { FUNCTION_SET, METHOD_SET, SIGNAL_SET } from './allowlist.ts';

export type Verdict = { ok: true } | { ok: false; reason: string };

export const PARSE_OPTIONS = { ecmaVersion: 2022, sourceType: 'script' } as const;

const MAX_SOURCE = 1500;
const MAX_NODES = 400;
const MAX_DEPTH = 32;
const MAX_ARGS = 16;
const MAX_NUMBER = 20000;
const MAX_MINI = 256;
const MAX_MINI_FACTOR = 32;
const MAX_MINI_NESTING = 6;
const MINI_CHARS = /^[A-Za-z0-9 \n~\-#.^_:,|!?@*/<>[\]{}()%'+]*$/;

// Allowed range for the first argument when it is a constant number.
const LIMITS: Record<string, [number, number]> = {
  fast: [1 / 64, 32], slow: [1 / 64, 64], hurry: [1 / 8, 8], ply: [1, 8], segment: [1, 64],
  seg: [1, 64], chop: [1, 32], striate: [1, 32], echo: [1, 8], gain: [0, 2], velocity: [0, 1],
  postgain: [0, 2], speed: [-4, 4], room: [0, 4], size: [0, 10], roomsize: [0, 10],
  delayfeedback: [0, 0.95], lpq: [0, 30], resonance: [0, 30], hpq: [0, 30], bpq: [0, 30],
  shape: [0, 0.95], distort: [0, 5], crush: [1, 16], coarse: [1, 64], orbit: [0, 3],
};

class Reject extends Error {}
const reject = (message: string): never => {
  throw new Reject(message);
};

// Mini-notation is parsed by Strudel's own grammar and never runs as code.
// These checks catch huge or deeply nested strings early.
function checkMini(text: string) {
  if (text.length > MAX_MINI) reject(`mini-notation longer than ${MAX_MINI} characters`);
  if (!MINI_CHARS.test(text)) reject(`mini-notation "${text}" has a character that is not allowed`);
  for (const match of text.matchAll(/[*!%@]\s*(\d+(?:\.\d+)?)/g)) {
    if (Number(match[1]) > MAX_MINI_FACTOR) reject(`mini-notation factor "${match[0]}" is above ${MAX_MINI_FACTOR}`);
  }
  for (const match of text.matchAll(/\(\s*-?\d+\s*,\s*(\d+)/g)) {
    if (Number(match[1]) > MAX_MINI_FACTOR) reject(`euclid steps in "${match[0]})" are above ${MAX_MINI_FACTOR}`);
  }
  for (const match of text.matchAll(/(-?\d+)\s*\.\.\s*(-?\d+)/g)) {
    if (Math.abs(Number(match[2]) - Number(match[1])) > MAX_MINI_FACTOR) reject(`mini-notation range "${match[0]}" is too long`);
  }
  let depth = 0;
  for (const char of text) {
    if ('[<{('.includes(char) && ++depth > MAX_MINI_NESTING) reject('mini-notation nests too deep');
    if (']>})'.includes(char)) depth--;
  }
}

// Folds number arithmetic such as `1/8` or `-0.25`. Returns undefined for anything else.
export function constantNumber(node: any): number | undefined {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
    const value = constantNumber(node.argument);
    if (value === undefined) return undefined;
    return node.operator === '-' ? -value : value;
  }
  if (node.type === 'BinaryExpression' && ['+', '-', '*', '/'].includes(node.operator)) {
    const left = constantNumber(node.left);
    const right = constantNumber(node.right);
    if (left === undefined || right === undefined) return undefined;
    switch (node.operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      default: return left / right;
    }
  }
  return undefined;
}

// Parses a layer and returns its expression. Throws Reject on any problem.
export function parseLayer(source: string): Node {
  if (source.trim().length === 0) reject('the layer is empty');
  if (source.length > MAX_SOURCE) reject(`the layer is longer than ${MAX_SOURCE} characters`);
  if (!/^[\x20-\x7E\n]*$/.test(source)) reject('the layer has a character outside plain ASCII');
  if (source.includes('\\')) reject('the layer has a backslash');
  const comments: unknown[] = [];
  let program: any;
  try {
    program = parse(source, { ...PARSE_OPTIONS, onComment: comments as any });
  } catch (error) {
    reject(`syntax error: ${(error as Error).message}`);
  }
  if (comments.length) reject('the layer has a comment');
  const statement = program.body[0];
  if (program.body.length !== 1 || statement.type !== 'ExpressionStatement' || statement.directive !== undefined) {
    reject('the layer must be exactly one expression');
  }
  if (statement.expression.type !== 'CallExpression') reject('the layer must be a function call');
  return statement.expression;
}

export function validateLayer(source: string): Verdict {
  try {
    const root = parseLayer(source);
    let count = 0;

    const visit = (node: any, depth: number, param: string | null): void => {
      if (++count > MAX_NODES) reject('the layer is too large');
      if (depth > MAX_DEPTH) reject('the layer nests too deep');
      switch (node.type) {
        case 'Literal':
          if (typeof node.value === 'string') return checkMini(node.value);
          if (typeof node.value === 'number') {
            if (!Number.isFinite(node.value) || Math.abs(node.value) > MAX_NUMBER) reject(`number ${node.raw} is out of range`);
            return;
          }
          if (typeof node.value === 'boolean') return;
          return reject(`literal ${node.raw} is not allowed`);
        case 'TemplateLiteral':
          if (node.expressions.length) reject('a template string must not contain ${...}');
          return checkMini(node.quasis[0].value.cooked);
        case 'ArrayExpression':
          for (const element of node.elements) {
            if (!element || element.type === 'SpreadElement') reject('arrays must not have holes or spreads');
            visit(element, depth + 1, param);
          }
          return;
        case 'UnaryExpression':
        case 'BinaryExpression': {
          const value = constantNumber(node);
          if (value === undefined || !Number.isFinite(value)) reject('arithmetic is allowed only on plain numbers');
          return;
        }
        case 'Identifier':
          if (node.name === param || FUNCTION_SET.has(node.name) || SIGNAL_SET.has(node.name)) return;
          return reject(`unknown name "${node.name}"`);
        case 'ArrowFunctionExpression': {
          if (param) reject('arrow functions must not be nested');
          if (node.async || node.params.length !== 1 || node.params[0].type !== 'Identifier' || node.body.type === 'BlockStatement') {
            reject('an arrow function must look like x => x.method(...)');
          }
          const name = node.params[0].name;
          if (!/^[a-z]$/.test(name) || FUNCTION_SET.has(name)) reject('the arrow parameter must be one letter, for example x');
          return visit(node.body, depth + 1, name);
        }
        case 'CallExpression': {
          if (node.optional) reject('optional calls are not allowed');
          if (node.arguments.length > MAX_ARGS) reject('too many arguments');
          const callee = node.callee;
          let name: string;
          if (callee.type === 'Identifier') {
            if (!FUNCTION_SET.has(callee.name)) reject(`unknown function "${callee.name}"`);
            name = callee.name;
          } else if (callee.type === 'MemberExpression' && !callee.computed && !callee.optional && callee.property.type === 'Identifier') {
            name = callee.property.name;
            if (!METHOD_SET.has(name)) reject(`unknown method ".${name}"`);
            const receiver = callee.object;
            const receiverOk =
              receiver.type === 'CallExpression' ||
              receiver.type === 'TemplateLiteral' ||
              (receiver.type === 'Literal' && typeof receiver.value === 'string') ||
              (receiver.type === 'Identifier' && (SIGNAL_SET.has(receiver.name) || receiver.name === param));
            if (!receiverOk) reject(`".${name}" must be called on a pattern`);
            visit(receiver, depth + 1, param);
          } else {
            return reject('only Strudel functions and methods can be called');
          }
          for (const arg of node.arguments) {
            if (arg.type === 'SpreadElement') reject('spread arguments are not allowed');
            visit(arg, depth + 1, param);
          }
          const limit = LIMITS[name];
          const first = node.arguments[0] ? constantNumber(node.arguments[0]) : undefined;
          if (limit && first !== undefined && (first < limit[0] || first > limit[1])) {
            reject(`${name}(${first}) is out of range ${limit[0]}..${limit[1]}`);
          }
          return;
        }
        default:
          // Member access without a call, this, new, assignment, sequences, ?., await,
          // import(), tagged templates, objects, conditionals, logical operators, regex.
          return reject(`${node.type} is not allowed`);
      }
    };

    visit(root, 0, null);
    return { ok: true };
  } catch (error) {
    if (error instanceof Reject) return { ok: false, reason: error.message };
    return { ok: false, reason: `validator error: ${(error as Error).message}` };
  }
}
