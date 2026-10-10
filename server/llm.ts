// The model adapter. It asks the model for one agent turn as strict JSON and
// returns the parsed turn with usage numbers. Only this file knows the
// provider, so another provider needs only another implementation here.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AgentTurn } from '../shared/schema.ts';

type Effort = 'low' | 'medium' | 'high';

export type ModelSetup = {
  model: string;
  thinking: Anthropic.ThinkingConfigParam;
  effort: Effort;
  // US dollars per 1M tokens
  price: { input: number; cacheWrite: number; cacheRead: number; output: number };
};

const HAIKU_PRICE = { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 };
const SONNET_PRICE = { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 };

export const MODEL_SETUPS = {
  'haiku': { model: 'claude-haiku-5-5', thinking: { type: 'disabled' }, effort: 'low', price: HAIKU_PRICE },
  'haiku-think': { model: 'claude-haiku-5-5', thinking: { type: 'adaptive' }, effort: 'low', price: HAIKU_PRICE },
  'sonnet': { model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' }, effort: 'low', price: SONNET_PRICE },
  'sonnet-think': { model: 'claude-sonnet-5-5', thinking: { type: 'adaptive' }, effort: 'low', price: SONNET_PRICE },
} satisfies Record<string, ModelSetup>;

export type SetupName = keyof typeof MODEL_SETUPS;

export type Usage = { input: number; cacheWrite: number; cacheRead: number; output: number };

export type TurnResult =
  | { ok: true; turn: AgentTurn; usage: Usage; costUsd: number; latencyMs: number; assistant: Anthropic.ContentBlock[] }
  | { ok: false; refused: boolean; reason: string; usage: Usage; costUsd: number; latencyMs: number };

// One conversation step. `retry` holds the earlier answer and the problems in it.
export type TurnRequest = {
  system: string;
  user: string;
  retry?: { assistant: Anthropic.ContentBlock[]; problems: string };
};

let client: Anthropic | null = null;

export async function proposeTurn(setupName: SetupName, request: TurnRequest, signal?: AbortSignal): Promise<TurnResult> {
  const setup: ModelSetup = MODEL_SETUPS[setupName];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: request.user }];
  if (request.retry) {
    messages.push({ role: 'assistant', content: request.retry.assistant });
    messages.push({ role: 'user', content: `Some operations were rejected. Fix them and answer again with the full turn.\n${request.retry.problems}` });
  }

  const started = performance.now();
  client ??= new Anthropic();
  const response = await client.messages.parse(
    {
      model: setup.model,
      max_tokens: 4000,
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages,
      thinking: setup.thinking,
      output_config: { effort: setup.effort, format: zodOutputFormat(AgentTurn) },
    },
    { signal, timeout: 30_000, maxRetries: 1 },
  );
  const latencyMs = Math.round(performance.now() - started);

  const usage: Usage = {
    input: response.usage.input_tokens,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    output: response.usage.output_tokens,
  };
  const costUsd =
    (usage.input * setup.price.input + usage.cacheWrite * setup.price.cacheWrite +
      usage.cacheRead * setup.price.cacheRead + usage.output * setup.price.output) / 1_000_000;

  if (response.stop_reason === 'refusal') return { ok: false, refused: true, reason: 'the model refused the request', usage, costUsd, latencyMs };
  if (response.stop_reason === 'max_tokens') return { ok: false, refused: false, reason: 'the answer was too long', usage, costUsd, latencyMs };
  if (!response.parsed_output) return { ok: false, refused: false, reason: 'the answer did not match the schema', usage, costUsd, latencyMs };
  return { ok: true, turn: response.parsed_output, usage, costUsd, latencyMs, assistant: response.content };
}
