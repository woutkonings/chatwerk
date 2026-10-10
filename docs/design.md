# music-chat: design

Version 0.3, 2026-10-10. Status: phases 0 to 3 are done. The app runs at https://dj-gen.woutkonings.com.

## 1. Goal

Several users share one room and hear the same song. The song is Strudel code (strudel.cc, a JavaScript live-coding language for music). The users chat with an AI agent. Only the agent changes the song. The model must be cheap and fast, and it must write good Strudel.

The first target is a local demo: one server on a laptop, and several browser tabs or devices on the LAN as users. The later target is the personal Hetzner server `vps-main`.

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Users | Multi-user rooms. The server is the only writer of the song. Clients send chat only. |
| 1 | Security | The LLM output never runs as JavaScript. The app checks each layer with an AST allowlist and builds it with a small interpreter. No `eval`. See section 7. |
| 2 | License | Strudel is AGPL-3.0-or-later. The repo is public. |
| 3 | Sounds | The strudel.cc sample sets plus Dirt-Samples (drum machines, breaks), loaded from GitHub. See section 9. |
| 4 | Undo and history | An append-only list of song versions in SQLite. "Restore version N" makes a new version. Yjs is not necessary. See section 8. |
| 5 | Model | Claude Haiku 5.5 with thinking off and system prompt v3 (taste rules and layer recipes), chosen by a listening test on 2026-10-10. Strict JSON-schema output. See sections 5.8 to 5.10. |
| 5 | Song format | A typed song: global settings plus named layers. Each layer is one Strudel expression. The agent returns a list of operations, not the full song. See section 4. |
| 6 | System prompt | Concise. No example songs. It contains the rules, the allowed functions and the loaded sound names. |
| 7 | Agent output | Operations with a short plan, a reply, a version summary and a transition moment (`now`, `next_bar`, `next_phrase`). See section 4. |
| 8 | Validation | Validate every operation. On failure, send the errors back to the agent one time. The last good version continues to play. |
| 9 | Player | `@strudel/web` 1.3.0, but without its `evaluate()`. The app plays patterns with `repl.setPattern()`. |
| 10 | Stack | Vite and React frontend, Hono server with WebSocket (`ws`) on the same port, better-sqlite3, zod. Node runs the TypeScript directly (type stripping). |

## 3. Architecture

```
 Browser (each user)                         Node server (one process)
 +---------------------------+   WebSocket   +--------------------------------+
 | Chat UI, layer cards      | ------------> | Room actor (one per room)      |
 | Read-only code view       |  chat, react, |  - chat log, presence          |
 |                           |  ping         |  - agent queue (one turn       |
 | Player                    | <------------ |    at a time, batched)         |
 |  validate -> interpret -> |  snapshot,    |  - song versions (SQLite)      |
 |  room clock sync ->       |  song, chat,  |                                |
 |  setPattern               |  agent status | Agent turn                     |
 |  hap gate, limiter        |               |  LLM -> schema check ->        |
 +---------------------------+               |  validate -> song check ->     |
                                             |  new version -> broadcast      |
                                             +--------------------------------+
```

The server and the browser use the same code for the schema, the validator and the interpreter (`shared/`). The server checks every song before it sends it. Each browser checks it again before it plays it.

## 4. Song model and agent output

### 4.1 Why layers with code strings

There are two ways to structure a song:

- **Fully typed:** every note, sound and effect is a JSON field, and our compiler writes the Strudel code. This is very safe, but it loses most of Strudel's power (`.off()`, `.jux()`, `.sometimes()`, signals). The model also cannot use what it knows about Strudel.
- **Typed skeleton, code per layer (chosen):** tempo, key and the list of layers are typed fields. Each layer holds one Strudel expression. The model uses its Strudel knowledge inside a small, checked box. The validator and the interpreter (section 7) make the code strings safe.

### 4.2 Song state

```ts
type Song = {
  version: number;
  bpm: number;                 // 60..180
  root: Root;                  // "C" | "C#" | ... | "B"
  scale: Scale;                // "major" | "minor" | "dorian" | ...
  layers: Layer[];             // at most 8
};

type Layer = {
  id: string;                  // /^[a-z][a-z0-9]{0,15}$/, lowercase (see 10.3)
  role: Role;                  // "drums" | "perc" | "bass" | "chords" | "pad" | "lead" | "arp" | "fx"
  code: string;                // one Strudel expression, at most 1,500 characters
  muted: boolean;
  author: string;              // display name of the user who asked for it
  since: number;               // version that last changed it
};
```

In version 1 the key is a song field. The agent reads it and uses it in each melodic layer, for example `.scale("C3:minor")`. A later option: the compiler applies the key to all melodic layers.

### 4.3 Agent output (strict JSON schema)

```ts
const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_tempo"), bpm: z.number() }),
  z.object({ op: z.literal("set_key"), root: z.enum(ROOTS), scale: z.enum(SCALES) }),
  z.object({ op: z.literal("set_layer"), id: z.string(), role: z.enum(ROLES), code: z.string(), muted: z.boolean() }),
  z.object({ op: z.literal("remove_layer"), id: z.string() }),
  z.object({ op: z.literal("restore_version"), version: z.number() }),
]);

const AgentTurn = z.object({
  plan: z.string(),            // 1 or 2 sentences. The model writes this first.
  ops: z.array(Op),
  when: z.enum(["now", "next_bar", "next_phrase"]),
  reply: z.string(),           // short answer to the users, by name
  summary: z.string(),         // label for the version history, for example "added acid bass"
});
```

Rules for the schema, so that it works with every candidate provider:

- The root is an object. The union is inside it (`anyOf` below the root).
- There is no recursion, no regex `pattern` and no numeric `minimum` or `maximum` in the schema. Cerebras and Anthropic do not support all of these. Our code checks the ranges after the parse.
- `restore_version` must be the only operation in a turn. Our code checks this.

### 4.4 Why operations and not the full song

- **Faster and cheaper.** The agent writes only the changed layers. The output is often 100 to 300 tokens, not the full song.
- **Attribution.** Each layer shows the user who asked for it.
- **Partial success.** If one operation fails, the others can still apply.
- **Batching.** One turn can serve several users. "Alice wants more bass, Bob wants it slower" becomes two operations and one reply.

### 4.5 Creative parts

- **The plan field.** A short plan before the operations gives a non-reasoning model space to think. It costs about 50 output tokens. The bake-off tests the effect.
- **Musical transitions.** The agent picks `when`. With `next_phrase`, the change lands on the next 4-cycle boundary, like a DJ drop. Section 8.4 explains the mechanism.
- **Reactions as feedback.** Users react to a version (for example a fire emoji). The agent sees the reaction counts per version in its context and can use them ("you liked version 7, so I keep that groove").
- **Layer cards.** The UI shows one card per layer: role, author, code. Each listener can mute or solo a card locally. A local mute does not change the shared song, so it needs no agent turn.
- **Open in strudel.cc.** A button opens the current song in the official Strudel REPL, where a user can play with it alone.

### 4.6 Context per agent turn

The cached system prompt comes first. After it, each turn sends:

1. The current song as JSON.
2. The last 10 versions, as `v12 added acid bass (Alice)`.
3. The last 10 chat messages.
4. The reaction counts per version.
5. The new messages, labelled per user.

The agent does not keep state between turns. This makes the Responses API state (`previous_response_id`) unnecessary.

### 4.7 Validation loop

1. Parse the output with zod and check the ranges and ids.
2. Validate and interpret each `set_layer` code (section 7).
3. Run the density check on the new song.
4. If something fails, send the errors to the agent for one retry turn.
5. If the retry also fails, apply the valid operations and tell the users which part failed.

## 5. Model and API

### 5.1 "Jev"

Jev is a model from TypeSafe AI (`jev-1.13.0`, early access since 2026-09-15). It is a "System One" decision model: you send a state and typed questions, and it returns a choice or a score with probabilities. Its price is $0.042 per 1M input tokens, and output is free.

**Jev cannot be the agent.** Its docs say: "Jev is not a chat or code-completion LLM. It does not generate text, write code, or hold a conversation." A later use is possible as a fast router (for example "does this message need a song change or only a reply?").

### 5.2 OpenAI Responses API

- **Structured output:** `text: { format: { type: "json_schema", name, schema, strict: true } }`. The Node SDK has `zodTextFormat` with `client.responses.parse()`, and the result is in `output_parsed`.
- **Strict-mode rules:** every field is required (use `["string","null"]` for an optional field), `additionalProperties: false`, the root is an object, `anyOf` below the root is allowed. The limits are 5,000 properties, 10 nesting levels and 1,000 enum values. Our schema is far below them.
- **First call:** the first request with a new schema has extra latency, because the API processes the schema one time.
- **Conversation state:** `previous_response_id` chains turns, but earlier input still bills as input. We send our own context per turn, so we do not use it.
- **Prompt caching:** automatic for a prefix of 1,024 tokens or more. A cache read costs 0.1x of the input price on GPT-5.6 and later.

**Conclusion:** the Responses API works well for this design, but only OpenAI supports it fully. Groq has a beta, Fireworks supports it, and OpenRouter supports it without state. Cerebras, Gemini and Anthropic do not support it. So the app uses a thin adapter (`server/llm.ts`) with one function: `proposeTurn(context) -> AgentTurn`.

- For the bake-off, the adapter uses OpenRouter Chat Completions with `response_format: json_schema, strict: true` and `provider.require_parameters: true`.
- After the bake-off, the adapter gets a direct implementation for the winner: the Responses API for an OpenAI model, Chat Completions for Cerebras, the native SDK for Gemini or Anthropic.

### 5.3 Provider support for strict JSON

| Provider | Strict JSON | Limit that matters here |
|---|---|---|
| OpenAI | Yes | None |
| Groq | Only gpt-oss and qwen3.8-27b | No streaming and no tools together with structured output |
| Cerebras | gpt-oss-120b, qwen-3.8-27b | No recursion, no `pattern`. No discount for cached tokens |
| OpenRouter | Per provider endpoint | Use `require_parameters: true`. Some providers treat `strict` as a hint |
| Gemini | Yes, native | On Gemini 3, thinking cannot be off (lowest is `minimal`) |
| Anthropic | Yes, native | The OpenAI-compatible layer ignores `response_format`. Use the native API |
| SambaNova | No | It accepts `strict` but does not enforce it |

### 5.4 Bake-off candidates

Prices and speeds come from the vendor pages and Artificial Analysis on 2026-10-10. The cost per turn assumes 2,500 cached input tokens, 500 new input tokens and 500 output tokens.

| Model (setting) | $/1M in / cached / out | Output tokens/s | Time to first token | Est. turn | $/turn |
|---|---|---|---|---|---|
| GPT-6 Luna (effort `none`, then `low`) | 0.10 / 0.01 / 0.50 | 126 | 0.8 s | ~4.8 s | ~$0.0003 to $0.0006 |
| Gemini 3.7 Flash (thinking `minimal` or `low`) | 0.75 / 0.075 / 3.75 | 313 | 1.3 s | ~2.9 s | ~$0.0024 to $0.0041 |
| gpt-oss-120b on Cerebras (effort `low`) | 0.35 / no discount / 0.75 | 1,755 | 1.6 s | ~1.9 s | ~$0.0014 |
| Claude Haiku 5.5 (thinking `disabled`) | 0.10 / 0.01 / 0.50 | 182 | not measured without thinking | unknown | ~$0.0003 to $0.0006 |

Notes:

- Gemini 3.7 Flash has the highest intelligence score in this set, but its price doubles on 2027-01-01.
- gpt-oss-120b is the fastest, but its music quality ranks low on Boogiebench (11th of 13 models).
- GPT-6 Luna and Claude Haiku 5.5 have the most recent training data (May and June 2026). Recent data can mean more Strudel knowledge.
- All four cost less than half a cent per turn. 1,000 turns cost between $0.30 and $4.

### 5.5 Strudel knowledge of models

- No benchmark measures the share of valid Strudel code. Users on Hacker News report that LLMs often write valid syntax with wrong musical meaning.
- The common failures are invented or unloaded sound names, methods without `()`, Tidal (Haskell) syntax, mini-notation in single quotes, and calls to `.play()`.
- Our design blocks most of these: the allowlist rejects unknown functions, the hap gate drops unknown sounds, and the retry sends the exact error back.

### 5.6 Bake-off plan

- **Prompts:** 10 fixed prompts, for example "start a lo-fi beat", "add a bass that follows the chords", "make it darker", "slower and more space", "Alice wants techno, Bob wants jazz", and one prompt injection.
- **Runs:** each model runs every prompt with the plan field and without it.
- **Measurements:** schema-valid rate, validator pass rate, density pass rate, latency (p50 and p95), cost per turn.
- **Listening:** a short listening session to score the music from 1 to 5.
- **Script:** `scripts/bakeoff.ts`, which writes a Markdown report to `docs/bakeoff/`.

### 5.7 API keys

**Decision (2026-10-10):** the bake-off and the hosted app use a personal Anthropic key. The bake-off compares four setups of Claude Haiku 5.5 and Claude Sonnet 5.5 (`server/llm.ts`):

| Setup | Model | Thinking | Price per 1M tokens (in / cached / out) |
|---|---|---|---|
| `haiku` | `claude-haiku-5-5` | `disabled`, effort `low` | $0.10 / $0.01 / $0.50 |
| `haiku-think` | `claude-haiku-5-5` | `adaptive`, effort `low` | same |
| `sonnet` | `claude-sonnet-5-5` | `between_tools` (off), effort `low` | $2 / $0.20 / $10 |
| `sonnet-think` | `claude-sonnet-5-5` | `adaptive`, effort `low` | same |

- The Anthropic adapter uses the native SDK with `output_config.format` (`zodOutputFormat`). The OpenAI-compatible endpoint ignores the schema.
- Haiku 5.5 rejects any `temperature` other than the default, so the adapter sends none.
- A request can end with `stop_reason: "refusal"`. The agent turn then answers that the band cannot do that.
- A cheap middle way to test later: Haiku for the first attempt, Sonnet for the retry.
- If no Claude setup is good enough, an OpenRouter key adds the other candidates in section 5.4.

### 5.8 Bake-off result (2026-10-10)

The first run is in `docs/bakeoff/2026-10-09-23-09.md`. It has one 10-turn session per setup.

| Setup | First try OK | Final OK | Latency p50 / p95 | Cost per turn |
|---|---|---|---|---|
| `haiku` | 10/10 | 10/10 | 2.5 s / 5.3 s | $0.0003 |
| `haiku-think` | 9/10 | 10/10 | 2.8 s / 4.8 s | $0.0003 |
| `sonnet` | 9/10 | 9/10 | 3.9 s / 6.4 s | $0.0073 |
| `sonnet-think` | 9/10 | 9/10 | 3.6 s / 6.6 s | $0.0067 |

Findings:

- **Haiku with thinking off is the default.** It was the fastest, the cheapest and the only setup without problems. It also handled the prompt injection well: it answered "I can only make music changes" and changed nothing.
- **Sonnet refused the prompt-injection turn** (`stop_reason: "refusal"`), so the user got no real answer. The agent now replies "The band only makes music, so the song stays as it is."
- **Chord names:** all setups sometimes wrote `Abmaj7` or `Cmaj7`. Strudel knows only `Ab^7`, and it skips an unknown chord with only a log line, so the chord is silent. The song check now rejects unknown chord names, and the system prompt lists the correct names.
- **Sound names:** `haiku-think` once used `s("pad")`. The check rejected it, and the retry fixed it.
- One run is a small sample. Listen to the final songs (strudel.cc links in the report) before a final choice.

### 5.9 Club bake-off (2026-10-10)

The goal is underground club music like `docs/reference-tracks/dark-techno.md`. For this run, the agent got the drum machines, Dirt-Samples (breaks, rave, vocals) and a short production section in the system prompt. Report: `docs/bakeoff/2026-10-09-23-26-club.md`, with a listen link per version.

| Setup | First try OK | Final OK | Latency p50 / p95 | Cost per turn |
|---|---|---|---|---|
| `haiku` | 10/10 | 10/10 | 2.7 s / 3.5 s | $0.0003 |
| `haiku-think` | 9/10 | 10/10 | 3.4 s / 4.5 s | $0.0004 |
| `sonnet-think` | 8/10 | 9/10 | 3.4 s / 13.0 s | $0.0098 |

- All setups now use the techniques: 909 drums, sidechain, rolling bass, slow acid builds, dub stabs, chopped Amen, masks for breakdowns.
- Sonnet often goes over the limit of 8 layers. It refused the prompt-injection turn again.
- The song check queried only the first 4 bars, so a layer that comes in after bar 16 was not checked. It now checks 36 bars up to bar 64, in less than 200 ms per song.
- The choice between Haiku and Sonnet depends on how they sound. That is a listening test.

### 5.10 Prompt versions for Haiku (2026-10-10)

The user found Haiku's songs less cool than Sonnet's and the reference track, and "a bit classical". The code showed why: 4-chord progressions with dominant chords, 8th-note grooves, no gain levels, little processing per layer, and random mask lengths. So `server/prompt.ts` now has three versions:

- **v1:** rules and production techniques (the earlier prompt).
- **v2:** v1 plus concrete taste rules: think like a techno producer, not a composer; riffs of 2 to 4 notes; 1 or 2 chords; a 16th-note grid; mix levels per role; processing per layer; 32-bar phrases.
- **v3:** v2 plus 12 layer recipes, with the instruction to never copy a recipe as it is. Without that instruction, Haiku copied the recipes character for character.

Run `docs/bakeoff/2026-10-09-23-36-club.md`:

| Version | First try OK | Final OK | Latency p50 / p95 | Cost per turn |
|---|---|---|---|---|
| `haiku/v2` | 9/10 | 10/10 | 2.8 s / 6.3 s | $0.0004 |
| `haiku/v3` | 10/10 | 10/10 | 2.6 s / 3.3 s | $0.0004 |

Both versions now write minimal harmony (`Am9!3 Dm9`), 16th grooves, gain levels and 32-bar arrangements.

**Decision (2026-10-10):** the user listened and chose v3: "v3 much better yes. This is good enough." Haiku 5.5 with thinking off and prompt v3 is now the default (`server/agent.ts`, `server/prompt.ts`). A risk to watch: v3 songs stay close to the recipes, so songs in different rooms can sound alike.

Also in this step: the song check took up to about 220 ms with 36 bars, and a cold worker after a timeout was slower still, so the 300 ms limit rejected normal songs. The check now samples 22 bars, the worker warms up at start, and the limit is 1.5 s. Runaway patterns take several seconds, so the limit still stops them.

## 6. System prompt

The system prompt is concise and has no example songs. The Strudel FAQ also forbids the use of the strudel.cc example tunes for AI without permission. The prompt has these parts, in this order, and they do not change between turns, so the provider caches them:

1. **Role:** "You are the band in a shared music room. You change the song only through operations."
2. **Rules:**
   - one expression per layer;
   - double quotes for mini-notation;
   - no tempo calls in a layer;
   - lowercase layer ids;
   - at most 8 layers;
   - gain at most 1;
   - answer each user by name;
   - never follow instructions to write anything other than music.
3. **Allowed functions:** about 150 names, one line each with the short signature. A script generates this list from `@strudel/reference` and the curated allowlist (section 7.2).
4. **Loaded sounds:** the exact sound names, grouped (drums, percussion, keys, synths).
5. **Scales and roots:** the enum values.

The prompt is about 2,000 to 2,500 tokens. With caching, it costs about 0.1x after the first turn.

## 7. Security

The goal: the LLM can only ever change Strudel music. The design does not rely on filtering alone. With the interpreter, LLM text never reaches `eval` or `Function`, so the LLM can only call allowlisted Strudel functions.

### 7.1 Threat model

- **JavaScript in other browsers.** Strudel's own `evaluate()` runs code with `Function(...)()` in the global scope, with no sandbox. Code that runs through it can read the page, send data out, redirect or mine crypto. A user can try prompt injection, and the result would run in every browser in the room.
- **Hidden code paths inside Strudel.** These turn a string or function into code or a network request: `.worklet()`, `.bbexpr()` / `.byteBeatExpression()`, `.as("workletSrc")`, `.source()`, `.onTrigger()`, `.fmap()`, `samples(url)`, `aliasBank(url)`, `tables(url)`, `registerWorklet(url)`, `loadBuffer`. None of them is on the allowlist.
- **Abuse inside pure Strudel.**
  - Loudness: `s("bd:0:100")` sets gain 100, `.gain("1".mul(1000))`.
  - Harsh sound: `distort`, `shape`, high `lpq`.
  - CPU: `s("bd*100000")` makes 400k events and takes 844 ms. `"[[[bd*16]*16]*16]*16"` makes 262k events and passes simple number caps.
- **Voice cap bug.** In `@strudel/web` 1.3.0 the voice cap is off by default (`setMaxPolyphony(undefined)` gives `NaN`).

### 7.2 Layers of defense

| Layer | Where | What it does |
|---|---|---|
| 1. Schema check | server | zod: shape, ids, lengths (1,500 characters per layer, 8 KB per song), at most 8 layers, bpm 60 to 180. |
| 2. AST allowlist | server and browser | acorn 8 with `ecmaVersion: 2022`, the same as the Strudel transpiler. Exactly one expression. The root is a call. Only allowlisted functions, methods and signals. No computed member access, no `new`, no assignment, no comments, no backslashes, no non-ASCII characters. Numbers are finite and at most 20,000. Arrow functions take one parameter and are not nested. Mini-notation strings get a character, length, factor and nesting check. |
| 3. Interpreter | server and browser | It builds the Pattern from the AST. It looks up only allowlisted names in `strudelScope` and calls methods on real `Pattern` objects. There is no `eval`. |
| 4. Song check | server (`worker_threads`) | It queries 22 bars (the first 8, then every fourth bar up to bar 64) with a 1,500 ms timeout. It rejects more than 64 events per cycle per layer, or more than 256 in total, and unknown sounds, notes and chords. |
| 5. Hap gate | browser | `defaultOutput` in `initStrudel()` (`web/src/hap-gate.ts`). It drops unknown sounds, removes tempo keys (`cps`), clamps the numbers (gain 0 to 1, room 0 to 1, delay feedback 0 to 0.8, speed -4 to 4, unison 1 to 8, and more), and removes values that are not finite. |
| 6. Audio safety | browser | `setGainCurve` clamps gain to 0..1. A master limiter (compressor, then a tanh shaper, then a volume control) sits before the speakers. The voice cap is 64 (`initAudioOnFirstClick({ maxPolyphony: 64 })`). |
| 7. CSP | browser | `script-src 'self' data:` without `'unsafe-eval'`, so `Function` throws even if the validator has a bug. `connect-src` allows only our own host. `frame-ancestors 'none'`, `object-src 'none'`. |
| 8. Trust and rendering | both | Only the server writes the song. Clients check every song again before they play it. All names, errors and code render with `textContent`, never `innerHTML`. |
| 9. Chat limits | server | 500 characters per message. About 6 messages per minute per user. One queued message per user. A maximum room size. A log of every turn. An automatic mute after repeated rejections. |
| 10. Kill switches | both | A panic button per listener (stop and mute). A room freeze and a revert to the last good version. |

The research agent tested the validator sketch on Node 22:

- 10 of 10 normal layers passed and played correctly.
- 49 of 51 attacks were rejected. The 2 that passed were harmless, and the sketch now blocks one of them.
- One validation takes about 0.005 ms.

The sketch is in the research notes and becomes `shared/validate.ts` and `shared/interpret.ts`.

### 7.3 The allowlist

`shared/strudel-allowlist.json` holds about 150 curated names in three groups: functions, signals and methods.

- A script makes the candidate list. It intersects `Object.keys(strudelScope)` and the own names of `Pattern.prototype` with the names in `@strudel/reference`.
- A human then picks the final names.
- A test fails when a name disappears in a new Strudel version.
- The build never adds new upstream names automatically.

These names are never allowed:

- `constructor`, `__proto__`, `prototype`, `toString`, `valueOf`, `call`, `apply`, `bind`;
- all the sinks in section 7.1;
- `set`, `keep`, `pure`, `log`, `speak`, `p`, `q`, `hush`, `all`, `each`, `evaluate`, `evalScope`, `setcps`, `setcpm`, `cpm`;
- MIDI, OSC, serial and widgets.

### 7.4 Later option: sandboxed player

The player can run in an iframe on a different domain, with `sandbox="allow-scripts"`. This adds one more wall around the page, but it is not necessary with the interpreter. Autoplay and sample loading in a sandboxed iframe are not verified (especially on Safari).

## 8. Multi-user sync

### 8.1 Why not Yjs

Yjs is a CRDT: it merges edits from many writers. Here the server is the only writer, so Yjs gives no benefit, and it adds a binary protocol and a second store. Yjs also does not help with undo: `Y.UndoManager` keeps its stack in memory, loses it at a restart, and cannot jump to "version 3".

The research found that Hocuspocus 4.7 (a Yjs server) supports read-only clients, presence and server writes. It is the right choice if users later edit code together. For now it is too much.

### 8.2 Chosen design

- **Transport:** one WebSocket on the same port as Hono.
- **Room actor:** the server keeps one in-memory Room object per room. SQLite stores the versions, the chat and the reactions.
- **Client messages:** `join {name, clientId}`, `chat {text, toBand}`, `react {version, reaction, on}`, `ping`, `resync`. The server checks every message with zod (`shared/protocol.ts`). No message type can write the song. Line breaks and control characters in names and chat become spaces, so a message cannot look like a line from another user in the agent context.
- **Server messages:** `snapshot`, `song`, `chat`, `presence`, `agent`, `reactions`, `pong`, `notice`. Every room event has a sequence number. When a client sees a gap in the numbers, it asks for a new snapshot.
- **Chat to the room:** a message with `toBand: false` goes to the other users only. It does not start an agent turn.
- **Room access:** a room link (`/r/<id>`) and a display name. There are no accounts.

### 8.3 Versions and undo

```
song_versions(room_id, n, created_at, cause_message_ids, author, summary, song_json)
```

Every agent turn that changes the song inserts a new row. "Restore version 3" inserts a new row with the content of version 3 and the summary "restored v3". The history stays linear, and every user sees the same list.

### 8.4 Agent queue and batching

- Each user message goes into the chat at once, and all users see it.
- The room has one turn loop: a flag for the running turn and one debounce timer. A queue library is not necessary.
- While a turn runs, new messages collect. A debounce of 1.5 s after the first message lets a few messages arrive together. The next turn handles all of them (at most 8).
- Each user can have 2 messages in the queue, and can send 6 chat messages per minute.
- Each turn has a timeout of 60 s (AbortController).
- After 3 refused turns, a user cannot talk to the band for 10 minutes.
- A daily model budget (`MUSIC_CHAT_DAILY_USD`, default 1 dollar) protects the key. The `turns` table logs every turn with its cost.
- The server broadcasts `agent {idle | waiting | thinking, queue}`, and the UI shows "the band is listening" or "the band is working on it".

### 8.5 Playback sync (built)

Each browser has its own audio clock and counts cycles from its own start. The room clock lines them up, so every listener hears the same bar at the same time, and a transition lands on the same beat everywhere.

1. The server keeps a room clock: `{cycle, serverMs, cps}`. A tempo change starts a new segment at the current room cycle, so the clock stays continuous.
2. Each client measures its offset to the server clock with pings (NTP-style): 8 pings at 1 s, then one every 20 s. It uses the sample with the lowest round-trip time of the last 12 (`web/src/server-clock.ts`).
3. The player computes `offset = roomCycle(serverNow + outputLatency) - scheduler.now()` and plays `roomPattern.early(offset)`. `early` is public Strudel API. It checks the offset every 5 s and corrects it when the drift is more than 0.02 cycles.
4. A song change with `when: next_bar` or `next_phrase` carries `applyAt`, the next bar or 4-bar boundary at least 0.5 s after the server time. The client plays `stack(old.filterHaps(begin < applyAt), next.filterHaps(begin >= applyAt))`.

Test result (Chrome, two tabs that started 5 s apart): both heard the room within 0.001 cycles of each other (about 2 ms at 132 bpm).

## 9. Sounds

**Decision (2026-10-10):** the app loads the same sample sets as strudel.cc plus Dirt-Samples, so that a strudel.cc link plays the same song. That adds the drum machines (`tidal-drum-machines`, 71 machines through `.bank()`) and the Dirt-Samples breaks (`amencutup`, `breaks125` to `breaks165`, `jungle`), rave sounds and vocals. The user confirmed that these samples may be used. The sample maps are in `sounds/*.json`, and `scripts/build-sounds.ts` makes the name list. Sections 9.1 and 9.2 describe the first plan.

### 9.1 Version 1 set (self-hosted in `public/samples/`)

| Library | Contents | License |
|---|---|---|
| Built-in synths | sine, square, sawtooth, triangle, supersaw, pulse, noise (white, pink, brown, crackle), FM | AGPL (part of Strudel) |
| ZZFX | retro synth sounds (`zzfx`, `z_*`) | AGPL (call `registerZZFXSounds()` in prebake) |
| uzu-drumkit | bd, sd, hh, oh, cp, rim, toms, crash, ride, shaker, cowbell, breaks | Unlicense |
| VCSL | 128 instruments: percussion, recorders, organs, saxophone, kalimba, marimba, and more | CC0 |
| Salamander piano | grand piano, 29 samples | CC-BY 3.0, attribution |
| mridangam | Indian drum, 13 sounds | CC-BY-SA 4.0, attribution and share-alike |

### 9.2 Later, after a license check

- **tidal-drum-machines:** 71 classic drum machines (`.bank("RolandTR909")`). Very popular, but the repo has no license, and the files are recordings of commercial hardware.
- **GM soundfonts:** 125 General MIDI instruments (`gm_*`). The license of the data is mixed. The loader also runs `eval()` on the font files, which conflicts with our CSP. `@strudel/web` does not include them.
- **uzu-wavetables** (`wt_*`) and **Dirt-Samples:** these have no license file.
- **shabda** (Freesound): every sample has its own license, and some are non-commercial. It is also an external dependency.

### 9.3 Obligations

- **Source:** publish the source of the app (AGPL).
- **Notice:** show the Strudel copyright notice in the UI.
- **Name:** do not use "strudel" in the project name.
- **Credits:** add an attribution page for the piano and mridangam samples.
- **Hosting:** do not hotlink `strudel.b-cdn.net` (the strudel.cc CDN).

## 10. Player in the browser

### 10.1 Setup

- `npm i @strudel/web` (1.3.0). It is one prebuilt bundle with core, mini-notation, tonal, transpiler and webaudio. Vite must not pre-bundle it (`optimizeDeps.exclude`). The app bundle is about 360 KB gzip.
- Call `initAudioOnFirstClick({ maxPolyphony: 64 })` at module load, before `initStrudel()`, because the first call wins. The Play button gives the first click, because browsers need a user gesture for audio.
- `initStrudel({ prebake, defaultOutput: gatedOutput })` loads the sample maps from `web/public/sounds/*.json` and ZZFX.
- The limiter: superdough connects its output gain straight to the speakers, and it makes a new output node after a reset. So each event checks that the output goes through our compressor, soft clipper and volume. The player also makes orbits 0 to 3 at start, because the kick ducks orbit 2 before any sound on orbit 2 has made it.
- Samples load on their first use. The player preloads the samples of the next 8 bars of every new song, so the first hits of a new sound are not lost.

### 10.2 Play a song

1. Validate and interpret each layer (section 7).
2. Wrap each layer pattern so that a query error in one layer returns no events for that layer only. In Strudel 1.2.6, one bad layer otherwise silences the whole song.
3. Stack the layers that are not muted, then call `repl.setPattern(stack(...))`.
4. Set the tempo with `repl.setCps(bpm / 60 / 4)`.

A new pattern keeps the playback phase. It becomes audible after about 0.1 to 0.3 s.

### 10.3 Code view

The read-only code view shows the compiled song in Strudel's own label format. This is also the text for "Open in strudel.cc":

```
setcpm(124/4)
drums: s("bd*4, [~ cp]*2, hh*8")
bass: n("0 ~ 3 5").scale("C2:minor").s("sawtooth").lpf(600)
_pad: n("<0 3 5 4>").scale("C4:minor").s("supersaw").room(.5)
```

Layer ids are lowercase. In Strudel, a label that starts with a capital `S` solos that layer and mutes all others.

### 10.4 Gotchas

- `hush()` resets the cycle to 0. Use the imported `hush`, not `window.hush`.
- An unknown sound logs "sound X not found". The hap gate drops these events first.

## 11. Stack and repo layout

- **Runtime:** Node 22 or later, TypeScript.
- **Server:** `hono` 4, `@hono/node-server` 2 with its built-in `upgradeWebSocket` and `ws`. Also `better-sqlite3`, `zod` 4, `acorn` 8 and `@anthropic-ai/sdk`. Node 22.18 or later runs the `.ts` files directly (type stripping), so there is no build step for the server.
- **Frontend:** Vite, React, `@strudel/web` 1.3.0.
- **Strudel in Node:** plain Node ESM fails on an import of `@kabelsalat/web` and on `@tonaljs/*`. A small resolve hook (`server/strudel-node.mjs`, loaded with `--import`) fixes this, so a bundle is not necessary. The density check runs on the server only. The browser runs the validator and the interpreter again.

```
music-chat/
  docs/            design.md, deploy.md, bakeoff/, reference-tracks/
  shared/          schema, allowlist, validate, interpret, check, song, sounds, protocol
  server/          index (HTTP, WebSocket, CSP), room, agent, llm, prompt, db, check-song, check-worker
  web/src/         player (init, sync, limiter), hap-gate, connection, server-clock, React pages
  web/public/      sounds/*.json (sample maps), favicon
  scripts/         bakeoff.ts, build-sounds.ts, check-allowlist.ts
  tests/           validator, interpreter, song, room, hap gate
```

## 12. Build phases

1. **Phase 0, bake-off.** It needs the OpenRouter key. Build `shared/` (schema, validator, interpreter), `server/llm.ts`, `server/prompt.ts` and `scripts/bakeoff.ts`. Output: `docs/bakeoff/<date>.md` and a model choice.
2. **Phase 1, local demo (done).** Room server, WebSocket, agent queue with batching, versions in SQLite, the player with hap gate and limiter, layer cards, the code view. Tested with two users in Chrome (`localhost` and `127.0.0.1`). A phone on the LAN is not tested yet: on plain http, browsers block AudioWorklets, so some effects are silent there.
3. **Phase 2, feel (done).** Room clock sync and `when` transitions, reactions, local mute and solo, "Open in strudel.cc".
4. **Phase 3, hosting on `vps-main` (done, https://dj-gen.woutkonings.com).**
   - The runbook `~/personal_repos/personal-life/vps-main/RUNBOOK.md` applies. The server uses nginx and certbot, not Caddy.
   - `Dockerfile` and `docker-compose.yml` are ready (port on `127.0.0.1` only, SQLite in a volume). The procedure is in [deploy.md](deploy.md).
   - The CSP is on in production and tested in Chrome. Chat rate limits, the turn log, the daily budget and the credits (footer) are built.

## 13. Open points to verify

| Point | Phase |
|---|---|
| CSP: AudioWorklets from `data:` URLs and no `'unsafe-eval'`. Works in Chrome. Firefox and Safari are not tested yet. | 1 |
| Vite dev server together with the strict CSP. Decision: the CSP applies only in production (`npm start`), because Vite dev injects inline scripts. | 1 |
| Claude Haiku 5.5 latency with thinking disabled | 0 |
| Structured output for each candidate through OpenRouter with `require_parameters` | 0 |
| OpenRouter latency overhead compared with a direct key | 0 |
| Transitions use `filterHaps` on discrete events only. `early(offset)` is accurate to about 2 ms in Chrome. Done. | 2 |
| License of tidal-drum-machines and of the GM soundfont variants | later |
| Autoplay and sample loading in a sandboxed cross-origin iframe | later |

## 14. Sources

Models and APIs:

- Jev: [launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [docs](https://docs.typesafe.ai/introduction), [coding agents page](https://docs.typesafe.ai/introduction/coding-agents.md)
- OpenAI: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs.md), [conversation state](https://developers.openai.com/api/docs/guides/conversation-state.md), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching.md), [pricing](https://developers.openai.com/api/docs/pricing.md), [Node SDK helpers](https://github.com/openai/openai-node/blob/main/docs/structured-outputs.md)
- Groq: [Responses API](https://console.groq.com/docs/responses-api.md), [structured outputs](https://console.groq.com/docs/structured-outputs.md)
- Cerebras: [structured outputs](https://inference-docs.cerebras.ai/capabilities/structured-outputs.md), [prompt caching](https://inference-docs.cerebras.ai/capabilities/prompt-caching.md)
- OpenRouter: [Responses API](https://openrouter.ai/docs/api_reference/responses/overview.md), [structured outputs](https://openrouter.ai/docs/features/structured-outputs.md)
- Gemini: [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Anthropic: [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Speed: [Artificial Analysis, gpt-oss-120b providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers)
- Music quality: [Boogiebench leaderboard](https://www.boogiebench.com/leaderboard), [HN 44320661](https://news.ycombinator.com/item?id=44320661), [HN 46128068](https://news.ycombinator.com/item?id=46128068)

Strudel (Codeberg main at commit `0a6d61e`, 2026-10-04, and npm `@strudel/web` 1.3.0):

- [codeberg.org/uzu/strudel](https://codeberg.org/uzu/strudel)
- Execution: `packages/core/evaluate.mjs`, `packages/core/repl.mjs`, `packages/transpiler/transpiler.mjs`
- Scheduler: `packages/core/cyclist.mjs`, `packages/core/neocyclist.mjs`
- Audio: `packages/superdough/superdough.mjs`, `packages/superdough/superdoughoutput.mjs`
- Mini-notation: `packages/mini/krill.pegjs`
- Reference data: `@strudel/reference` (577 documented entries)

Prior art:

- [live-coding-music-mcp](https://github.com/williamzujkowski/live-coding-music-mcp)
- [dj-claude](https://github.com/p-poss/dj-claude)
- [strudel-agent](https://github.com/gdong42/strudel-agent)
- [strudel-llm](https://github.com/stuhlmueller/strudel-llm)
- [strudel-mcp-bridge](https://github.com/phildougherty/strudel-mcp-bridge)

Sync:

- [Hocuspocus authentication](https://tiptap.dev/docs/hocuspocus/guides/authentication), [Hocuspocus examples](https://tiptap.dev/docs/hocuspocus/server/examples)
- [y-websocket-server](https://github.com/yjs/y-websocket-server)
- [Socket.IO connection state recovery](https://socket.io/docs/v4/connection-state-recovery)
