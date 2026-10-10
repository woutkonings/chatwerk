// The WebSocket messages between the browser and the server. The server checks
// every client message with zod. No client message can change the song: only
// an agent turn on the server makes a new version.
import { z } from 'zod';
import { WHEN, type Song } from './schema.ts';
import type { SetState } from './set.ts';
import type { SuggestionState } from './suggest.ts';
import type { LayerChange } from './transition.ts';

export const ROOM_ID = /^[a-z0-9][a-z0-9-]{2,31}$/;
export const MAX_CHAT_LENGTH = 500;
export const MAX_NAME_LENGTH = 24;

// Reactions to a song version. The agent sees the counts per version.
export const REACTIONS = ['fire', 'dance', 'meh'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<Reaction, string> = { fire: '🔥', dance: '🕺', meh: '😴' };

// Control characters and line breaks become spaces, so one chat message can
// never look like several lines (or other users) in the agent context.
const singleLine = (max: number) =>
  z.string().transform((text) => text.replace(/[\p{C}\s]+/gu, ' ').trim()).pipe(z.string().min(1).max(max));

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: singleLine(MAX_NAME_LENGTH),
    clientId: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/),
  }),
  z.object({ type: z.literal('chat'), text: singleLine(MAX_CHAT_LENGTH), toBand: z.boolean() }),
  z.object({ type: z.literal('react'), version: z.number().int().min(1), reaction: z.enum(REACTIONS), on: z.boolean() }),
  z.object({ type: z.literal('ping'), t: z.number() }),
  z.object({ type: z.literal('resync') }),
  // Autopilot: when nobody asks for anything, the band makes small mutations by itself.
  z.object({ type: z.literal('autopilot'), on: z.boolean() }),
  // Apply a suggestion (instant mode), or vote for one (vote mode, on the roadmap).
  z.object({ type: z.literal('apply'), id: z.string().max(40) }),
  z.object({ type: z.literal('vote'), id: z.string().max(40), on: z.boolean() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export type ChatKind = 'user' | 'band' | 'system';
export type ChatEntry = { id: number; at: number; author: string; kind: ChatKind; text: string; toBand: boolean };
export type VersionInfo = { n: number; at: number; author: string; summary: string };
export type User = { id: string; name: string };
// idle: nothing to do. waiting: messages collect before the next turn. thinking: a turn runs.
export type AgentState = { status: 'idle' | 'waiting' | 'thinking'; queue: number };
export type ReactionCounts = Record<number, Partial<Record<Reaction, number>>>;
// The room clock: the room is at `cycle` at server time `serverMs`, and moves `cps` cycles per second.
export type RoomClock = { cycle: number; serverMs: number; cps: number };
// Clock segments sorted by time. A segment in the future is a tempo change on a bar boundary.
export type Timeline = RoomClock[];
export type When = (typeof WHEN)[number];
// What the band "hears": an energy estimate (1 to 10) and short findings about the mix.
// `findings` holds the same findings as data, for the suggestions.
export type Finding = { kind: 'lowend' | 'register' | 'square' | 'same' | 'busy'; ids: string[] };
export type MixReport = { energy: number; lines: string[]; findings?: Finding[] };

export type ServerMessage =
  | {
      type: 'snapshot';
      seq: number;
      room: string;
      you: User;
      song: Song;
      versions: VersionInfo[];
      chat: ChatEntry[];
      users: User[];
      agent: AgentState;
      reactions: ReactionCounts;
      mine: { version: number; reaction: Reaction }[];
      clocks: Timeline;
      set: SetState | null; // null until the first song
      autopilot: boolean;
      report: MixReport | null;
      suggestions: SuggestionState | null;
    }
  // A new song version. Changed layers switch at room cycle `applyAt`, or as `changes` says per layer.
  | {
      type: 'song';
      seq: number;
      song: Song;
      version: VersionInfo;
      clocks: Timeline;
      applyAt: number;
      changes: Record<string, LayerChange>;
      report: MixReport | null;
    }
  // The set moved to another phase (by time, by the band, or at the first song).
  | { type: 'set'; seq: number; set: SetState }
  | { type: 'autopilot'; seq: number; on: boolean; by: string }
  // New ideas for the current version (after every change, phase move and reaction).
  | { type: 'suggestions'; seq: number; suggestions: SuggestionState }
  | { type: 'chat'; seq: number; entry: ChatEntry }
  | { type: 'presence'; seq: number; users: User[] }
  | { type: 'agent'; seq: number; agent: AgentState }
  | { type: 'reactions'; seq: number; version: number; counts: Partial<Record<Reaction, number>> }
  // Not part of the room state, so without a sequence number.
  | { type: 'pong'; t: number; serverMs: number }
  | { type: 'notice'; text: string };

export function cycleAt(clock: RoomClock, serverMs: number): number {
  return clock.cycle + ((serverMs - clock.serverMs) / 1000) * clock.cps;
}

export function timeAtCycle(clock: RoomClock, cycle: number): number {
  return clock.serverMs + ((cycle - clock.cycle) / clock.cps) * 1000;
}

// The segment that is active at a server time.
export function clockAt(timeline: Timeline, serverMs: number): RoomClock {
  let active = timeline[0];
  for (const clock of timeline) if (clock.serverMs <= serverMs) active = clock;
  return active;
}

export function roomCycle(timeline: Timeline, serverMs: number): number {
  return cycleAt(clockAt(timeline, serverMs), serverMs);
}

export function cpsFromBpm(bpm: number): number {
  return bpm / 60 / 4;
}
