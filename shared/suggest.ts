// Suggestions: small ideas that any listener can apply with one click. Code
// makes them from the current song, the set phase and the mix report, without
// a model call, so they are instant and free. Each one is a list of agent
// operations that the room checks before it shows the idea.
//
// Now: the first click applies the idea at the next phrase. Later (roadmap): a
// crowd vote, where an idea applies when enough listeners vote for it. The
// types carry the vote fields already, so the UI and the protocol do not change.
import type { When } from './protocol.ts';
import type { Op } from './schema.ts';

export const SUGGESTION_KINDS = ['energy-up', 'energy-down', 'groove', 'colour', 'space', 'drop', 'phase', 'restore', 'fix'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export type SuggestMode = 'instant' | 'vote';

// What the room shows. The operations stay on the server.
export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  label: string; // short, for the chip: "Open the acid filter"
  detail: string; // the effect: "acid: low-pass to 3000 Hz over 16 bars"
  votes: number; // vote mode only; 0 in instant mode
};

export type SuggestionState = {
  version: number; // the song version that the ideas belong to
  mode: SuggestMode;
  items: SuggestionView[];
  needed: number; // vote mode: the votes an idea needs; 1 in instant mode
  // The last applied idea, so every listener sees "Mila's idea lands in 2 bars".
  // `at` is the room cycle where it lands.
  lastApplied?: { label: string; by: string; at: number } | null; // the server always sends it
  cooldownUntil?: number; // the room cycle from which the next idea can apply (always sent)
};

// A suggestion on the server: the view plus its operations.
export type Suggestion = SuggestionView & { ops: Op[]; when: When; target: string | null };

// At most this many ideas at a time, and one applied idea per this many bars.
export const MAX_SUGGESTIONS = 4;
export const SUGGESTION_COOLDOWN_BARS = 8;
