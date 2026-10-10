// One agent turn: ask the model, apply the harness rules (tempo, timing),
// apply its operations, check the new song, and retry one time with the
// problems. If the retry also has problems, apply only the operations that
// pass. The song changes only when every check passes.
import type Anthropic from '@anthropic-ai/sdk';
import type { MixReport } from '../shared/protocol.ts';
import type { AgentTurn, Song } from '../shared/schema.ts';
import { applyOps, type OpError } from '../shared/song.ts';
import { checkSongInWorker } from './check-song.ts';
import { enforce, keyLocked, keyNote, modeNote, reportNote, setNote, tempoNote, tempoPolicy } from './harness.ts';
import { proposeTurn, type SetupName, type Usage } from './llm.ts';
import { buildSystemPrompt, buildTurnMessage, type PromptVariant, type TurnContext } from './prompt.ts';

const MAX_ATTEMPTS = 2;

export type Attempt = { latencyMs: number; costUsd: number; usage: Usage; problems: string[] };

export type AgentOutcome = {
  song: Song;
  changed: boolean;
  turn: AgentTurn | null;
  reply: string;
  problems: string[]; // problems that remain after the last attempt
  attempts: Attempt[];
  harness: string[]; // changes that the harness made to the agent's operations
  report: MixReport | null; // the mix report of the new song, when the song changed
};

type Evaluation = { song: Song; problems: string[]; badOps: Set<number>; report: MixReport | null };

async function evaluate(turn: AgentTurn, context: TurnContext, author: string, restore: (v: number) => Song | undefined): Promise<Evaluation> {
  const { song, errors } = applyOps(context.song, turn.ops, author, restore);
  const problems = errors.map((e: OpError) => `operation ${e.index + 1} (${e.op}): ${e.message}`);
  const badOps = new Set(errors.map((e) => e.index));
  if (song === context.song) return { song, problems, badOps, report: null };

  const changedIds = new Set(song.layers.filter((layer) => layer.since === song.version).map((layer) => layer.id));
  const check = await checkSongInWorker(song);
  for (const issue of check.issues) {
    if (issue.id !== '*' && !changedIds.has(issue.id)) continue; // older layers passed before
    problems.push(issue.id === '*' ? issue.message : `layer "${issue.id}" ${issue.message}`);
    turn.ops.forEach((op, index) => {
      if (issue.id === '*' || ('id' in op && op.id === issue.id)) badOps.add(index);
    });
  }
  return { song, problems, badOps, report: check.report };
}

export type TurnOptions = { prompt?: PromptVariant; signal?: AbortSignal };

export async function runAgentTurn(
  setup: SetupName,
  context: TurnContext,
  restore: (version: number) => Song | undefined,
  { prompt = 'v3', signal }: TurnOptions = {},
): Promise<AgentOutcome> {
  const system = buildSystemPrompt(prompt);
  const author = [...new Set(context.newMessages.map((m) => m.author))].join(', ');
  const policy = tempoPolicy(context.song, context.newMessages);
  const keyIsLocked = keyLocked(context.song, context.newMessages);
  const notes = [tempoNote(policy, context.song), keyNote(keyIsLocked, context.song)];
  if (context.set) notes.push(setNote(context.set, context.song.bpm));
  if (context.report) notes.push(reportNote(context.report, context.set?.energy ?? null));
  const mode = context.mode ? modeNote(context.mode) : null;
  if (mode) notes.push(mode);
  const user = buildTurnMessage({ ...context, notes });
  const attempts: Attempt[] = [];
  const harness: string[] = [];
  let retry: { assistant: Anthropic.ContentBlock[]; problems: string } | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await proposeTurn(setup, { system, user, retry }, signal);
    if (!result.ok) {
      attempts.push({ latencyMs: result.latencyMs, costUsd: result.costUsd, usage: result.usage, problems: [result.reason] });
      // A refusal usually follows a request that is not about music (see the bake-off).
      const reply = result.refused ? 'The band only makes music, so the song stays as it is.' : 'The band could not answer that. Please try again.';
      return { song: context.song, changed: false, turn: null, reply, problems: [result.reason], attempts, harness, report: null };
    }

    const turn = result.turn;
    harness.push(...enforce(turn, policy, context.song, keyIsLocked));
    const evaluation = await evaluate(turn, context, author, restore);
    attempts.push({ latencyMs: result.latencyMs, costUsd: result.costUsd, usage: result.usage, problems: evaluation.problems });
    if (evaluation.problems.length === 0) {
      return { song: evaluation.song, changed: evaluation.song !== context.song, turn, reply: turn.reply, problems: [], attempts, harness, report: evaluation.report };
    }
    if (attempt < MAX_ATTEMPTS) {
      retry = { assistant: result.assistant, problems: evaluation.problems.map((p) => `- ${p}`).join('\n') };
      continue;
    }

    // Last attempt: keep only the operations that passed, and check the result again.
    const goodOps = turn.ops.filter((_, index) => !evaluation.badOps.has(index));
    const partial = await evaluate({ ...turn, ops: goodOps }, context, author, restore);
    const song = partial.problems.length === 0 ? partial.song : context.song;
    const note = song === context.song ? ' (The change did not pass the checks, so the song stays as it was.)' : ' (Part of the change did not pass the checks.)';
    return { song, changed: song !== context.song, turn, reply: turn.reply + note, problems: evaluation.problems, attempts, harness, report: partial.report };
  }
  throw new Error('unreachable');
}
