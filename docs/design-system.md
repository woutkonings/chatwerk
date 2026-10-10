# Chatwerk: design system "Flyer"

Version 2, 2026-10-10. The app is called Chatwerk (it was music-chat; the repository keeps its old name). This document describes the visual direction, the design tokens, the components and the rules of the web UI. The live review page is `/styleguide` (in development: http://localhost:5173/styleguide).

Version 1 ("Booth", a dark hardware look) is replaced. The user found it too generic. Section 7.4 lists the patterns that we do not use again.

## 1. Direction: a flyer in two inks

The room reads like a club flyer, printed in two inks (riso blue and fluorescent pink) on uncoated paper. The calm of a Swiss studio sheet balances the poster: much white space, flush-left type, and hierarchy from size and layout instead of boxes.

The user picked this direction from three mockups (C "Flyer", then A "Studio", then B "Sleeve"), with the request to make it "a little bit less in your face". So the poster spirit stays, but the transport and the room information lead, and the loud parts are small.

Principles:

- **Two inks.** Everything is printed in blue on paper. Pink marks what is "now": the current phase, the playhead, the energy number, the ideas and the band.
- **Pink is rare.** Pink fills are small and light (a screen, not a block). Pink text uses the deep pink ink, so it passes AA.
- **Type does the work.** One typeface. Big bold numbers and names; small muted labels in sentence case. No capitals with letter-spacing, no monospace labels.
- **Rules, not boxes.** A strong blue rule opens a section; hairlines separate rows. Sections have no frame and no fill.
- **Show the music.** A layer shows its notes of the current bar (dots and a small piano roll). The code is behind a toggle.
- **Print, lightly.** A faint paper grain on the page and a halftone "sun" behind the phase name.

### 1.1 The name and the logo

Chatwerk is a pun on Kraftwerk, the pioneers of electronic music. The logo is an homage in our own drawing. We do not redraw or trace their logotype or any of their cover art: those are trademarks and artwork of the band.

- **Wordmark** (`Wordmark` in `components/Logo.tsx`): "Chatwerk" in our own dot-matrix letters on a grid of 5 by 7 dots, like the display of an old computer. The dots also echo the dot step grids of the line-up. "Chat" prints in blue, "werk" in pink. With `grid`, the unlit dots print in a light blue, like a display that is switched on (only at large sizes).
- **Mark** (`LogoMark`): a robot head from simple shapes: a blue screen with rounded corners, two paper eyes, a pink mouth and a pink antenna dot. It reads at 16 and 32 px (`web/public/favicon.svg` is the same drawing on a paper square).
- **The band** (`RobotRow`): four identical heads in a row, on the home page.
- **One ink:** with `ink="blue"`, every part prints in blue (the mouth in paper). Never print the logo in pink only.
- **Space and size:** keep at least one dot of space around the wordmark. From 48 px height the letters are round display dots; below that they print as solid pixels (squares that touch), so the word stays readable in the top bar. The unlit dots show only at large sizes. Below 16 px, use the mark alone.
- **Tagline** (home page): "The machines play. You tell them what to play." Our own words; we do not quote lyrics or song titles.

## 2. Inspiration

| Reference | What we take |
|---|---|
| Dekmantel and Freerotation festival posters | Big mixed-case grotesque type, a timetable of blocks, a strong colour field used with restraint. |
| Berghain and Panorama Bar month flyers | The line-up: names stacked in one bold weight. The layers of the song read as a line-up. |
| Risograph club flyers | Two inks on uncoated paper, overprint where the inks cross, a paper grain, halftone screens. |
| Ableton (the current light website) | Light, clean, generous space, one strong colour for the action. |
| Teenage Engineering product pages | Plain facts in a grid of small labels and larger values, lots of white space. |
| Swiss typography (Müller-Brockmann) | Flush-left text on a strict grid; hierarchy by size and weight only. |
| Kraftwerk, the "Computerwelt" and "Die Mensch-Maschine" eras (as an idea, not as artwork) | A dot-matrix display for the wordmark; machines as the band; a strict, calm grid. |
| Atelier Triay, Bricolage Grotesque | One expressive grotesque with optical sizes: tight and poster-like at 56px, open and readable at 14px. |

## 3. Files

| Path | Content |
|---|---|
| `web/src/design/tokens.css` | All design tokens (custom properties). |
| `web/src/design/base.css` | The reset, the paper (colour and grain on `html`), the focus ring, the text helpers, reduced motion. |
| `web/src/design/Styleguide.tsx`, `Styleguide.css`, `mock.ts` | The `/styleguide` page and its mock room data, including mock layer previews. |
| `web/src/ui/` | Generic components without room logic. Each has its own CSS file. `index.ts` exports all. |
| `web/src/components/` | Feature components of the room and the home page. `format.ts` has the pure helpers (labels, times, timeline geometry). |
| `web/src/styles.css` | Page layouts only: the home page, the name form, the room grid. |

The only font package is `@fontsource-variable/bricolage-grotesque` (5.3.0, pinned, SIL Open Font License 1.1), loaded with `standard.css` (weight 200 to 800, width 75 to 100, optical size 12 to 96). The production CSP allows no external fonts, so there is no font CDN. Code uses the system monospace font.

## 4. Tokens

The tokens have three layers:

1. **Primitives**: the paper (`--paper-50` to `--paper-300`), the blue ink and its screens (`--blue`, `--blue-deep`, `--blue-60`, `--blue-35`, `--blue-20`, `--blue-10`), and the pink ink (`--pink`, `--pink-deep`, `--pink-20`, `--pink-10`), plus sizes. Components never use primitives.
2. **Semantic tokens**: the meaning, for example `--color-text`, `--color-accent`, `--color-band`. Components use only these.
3. **Component tokens**: local custom properties inside one component, for example `--button-bg`, `--idea`, `--key-color`.

### 4.1 Colour

| Group | Tokens | Rule |
|---|---|---|
| Paper | `--color-bg`, `--color-bg-sunken`, `--color-surface-1`, `-2`, `-3` | bg is the page (with the grain). sunken is a well (code). surface-2 is a field. surface-3 is a light blue screen for hover. surface-1 is paper: sections have no fill. |
| Rules | `--color-border-subtle`, `--color-border`, `--color-border-strong`, `--color-border-control` | border is the hairline between rows. strong is the 2px rule on top of a section. control is the edge of a field, a switch or a pill (blue, 6.6:1). |
| Text | `--color-text`, `-secondary`, `-muted`, `-faint`, `-inverse` | Muted (5.6:1) is the lowest level for text that a user must read. Faint is for decoration and disabled text only. |
| Action | `--color-action`, `-hover`, `-ink` | The blue fill of the main action (Play, Send, the primary button). Text on it is `--color-action-ink`. |
| Accent (pink) | `--color-accent`, `-fill`, `-soft`, `-wash` | accent is the deep pink ink for text and lines (5.1:1). fill is the bright fluorescent pink for small shapes only (2.7:1, never text). soft and wash are light screens behind blue text. |
| Band | `--color-band`, `-soft` | The band speaks in pink ink: its name, the thin mark beside its messages, the rule of its section. |
| Signals | `--color-warn`, `--color-danger` (+ `-soft`) | Two inks only: warnings and errors are pink ink with an icon and a sentence. |
| Mixer | `--color-mute`, `--color-solo` | Mute is printed blue, solo pink. |
| Roles | `--color-role-*` | All blue in this theme. The role name and the shape of the pattern identify a layer. The tokens stay for a future theme. |
| Energy | `--color-energy-1` to `-10`, `--color-energy-off` | The two inks mix from blue (1) to pink (10). |
| Ideas | `--color-idea-*` | All pink ink in this theme. The kind shows as an icon and a word. |

Contrast on the paper (`#f3efe7`): text 6.6, secondary 8.2, muted 5.6 (4.9 on the pink screen), accent 5.1 (4.5 on the pink screen), text on the blue action 6.6. The bright pink fill (2.7) and faint blue (2.7) never carry text.

### 4.2 Typography

| Token | Value | Use |
|---|---|---|
| `--font-sans`, `--font-display` | Bricolage Grotesque Variable | All text. Optical sizing is automatic. |
| `--font-mono` | the system monospace font | Code only (the code view, the code of a layer). |
| `--text-xs` to `--text-5xl`, `--text-hero` | 12px to 80px, and a fluid hero size | Body is `--text-md` (16px). Labels are `--text-sm`. Layer names are `--text-2xl`. The tempo, the phase and the energy are `--text-4xl`. |
| `--weight-*` | 400, 500, 600, 700, 800 | 800 for display numbers and the phase; 700 for names and titles; 500 for body emphasis. |
| `--leading-*` | 0.9 to 1.6 | `none` for display, `tight` for names, `snug` for UI text, `normal` for body. |
| `--tracking-*` | -0.04em, -0.015em, 0 | Large type sits tight (`display`); titles are `tight`; body is `normal`. Never positive letter-spacing. |

Rules:

- Sentence case everywhere. No text in capitals.
- Numbers that change (bars, times, counts, the tempo) use tabular figures (`font-variant-numeric: tabular-nums` or `.t-num`).
- Helpers: `.t-label` (small, muted, sentence case), `.t-num`, `.t-display`, `.t-muted`, `.visually-hidden`.

### 4.3 Space, size and shape

- `--space-*`: a 4px grid up to 96px (`--space-24`). Sections sit 48 to 64px apart; rows have 16 to 20px of padding. `--gutter` is 20px on a phone and 48px from 960px.
- `--size-control-sm/md/lg`: 32px, 40px, 52px. `--size-touch` is 44px, the smallest tap target on a touch screen. `--size-play` is 72px.
- `--radius-sm/md/lg/pill`: 6px, 12px, 16px, 999px. Buttons, keys and segmented controls are pills and circles; fields use `md`; stickers and wells use `lg`.
- `--border-width` 1px (hairlines), `--border-width-strong` 1.5px (controls), `--rule-width` 2px (section rules, the band mark).

### 4.4 Print effects

- `--texture-grain`: a faint noise texture on `html`, so the whole page is paper.
- `--texture-halftone`: a dot screen of the bright pink, for the quiet "sun" behind the phase name.
- `--blend-overprint` (multiply): only where two inks meet. The current logo does not need it; the token stays for posters and future marks.
- Depth is flat print. `--shadow-pop` is the only shadow, for floating things (the inline invite field).

### 4.5 Motion

`--duration-instant/fast/base/slow` (80ms to 420ms) and `--ease-out`, `--ease-in-out`, `--ease-linear`. The playhead moves linearly on the 500ms timer of the room cycle. With `prefers-reduced-motion: reduce`, `base.css` stops all transitions and animations; the beat dots, the pulses, the spinner and the home demo stop by their own code.

### 4.6 Layers and breakpoints

- `--z-base` 0, `--z-raised` 1, `--z-sticky` 10 (top bar, room tabs), `--z-overlay` 100 (the inline invite field), `--z-toast` 200.
- Breakpoints (literal values in media queries): `sm` 480px, `md` 760px, `lg` 960px (the chat column; below it, tabs), `xl` 1280px.
- Container queries: the stage puts the band next to the deck at 940px; the idea bar shows one row of four at 640px; a timetable slot hides its time under 64px and its name under 40px.

### 4.7 Themes

The default theme is "flyer" on `:root` and `:root[data-theme='flyer']`. To add a theme:

1. Add a block `:root[data-theme='<name>'] { ... }` in `tokens.css`.
2. Override the semantic tokens only (section 4.1, the print effects and the shadow). Keep the primitives.
3. Set `color-scheme` in the block.
4. Check the contrast of every text token, the 3:1 of `--color-border-control` and of the accent lines.
5. Set `data-theme` on `<html>`, and change the paper colour in `web/index.html` (it shows before the CSS loads).

## 5. Components

### 5.1 UI kit (`web/src/ui/`)

| Component | Props (main) | Look |
|---|---|---|
| `Button` | `variant` primary, secondary, ghost, danger; `size` sm, md, lg; `icon`, `iconEnd`, `loading`, `block` | A pill. Primary: blue fill. Secondary: blue outline. Ghost: text, underlined on hover. Danger: pink outline. |
| `ButtonLink` | as `Button`, on an `<a>` | "Open in strudel.cc". |
| `IconButton` | `label` (required), `icon`, `variant`, `size` | A circle. The label is the accessible name and the tooltip. |
| `ToggleKey` | `pressed`, `onPressedChange`, `label`, `tone` mute, solo, accent, band | A round key with a letter; printed solid when on (mute blue, solo pink). |
| `Switch` | `checked`, `onCheckedChange`, `label`, `description` | A pill switch, blue when on. A native checkbox with `role="switch"`. |
| `SegmentedControl` | `value`, `options`, `onChange`, `label` | A pill group; the chosen option is printed blue. A radio group. |
| `Slider` | `value`, `onChange`, `label`, `min`, `max`, `step`, `format`, `icon` | A thin blue line with a round thumb. |
| `Input` | `size`, `leading`, `invalid`, `mono`, and all input props | A field with a 1.5px blue edge and 12px corners. |
| `Chip` | `icon`, `selected` | A small outlined pill (the suggestions in an empty room). |
| `Badge` | `tone`, `variant` outline, soft, solid; `color` | A small status in sentence case. |
| `Led` | `tone`, `pulse`, `label`, `size` | A status dot; an open ring for "off". |
| `Meter` | `value`, `max`, `segments`, `target`, `tone`, `label` | A row of printed squares in the energy inks, with a pink target tick. `role="meter"`. |
| `ProgressBar` | `value`, `label`, `color` | A thin line (automation progress). |
| `Readout` | `label`, `value`, `unit`, `size`, `tone` | A small muted label above a bold value. |
| `UserChip` | `name`, `you`, `band`, `compact` | An initial in a circle and the name; "you" is printed solid. |
| `Spinner` | `size`, `label` | Three dots. |
| `Notice` | `tone`, `title`, `onDismiss` | A message on a light pink screen, with a pink ink icon. |
| `EmptyState` | `icon`, `title`, `actions`, `size` | A dashed outline with a title and actions. |
| `Panel` | `title`, `icon`, `meta`, `actions`, `padding`, `tone` default, sunken, band | A section: a strong rule on top and a title. `sunken` is a well; `band` has a pink rule. |
| `Disclosure` | `summary`, `meta`, `defaultOpen`, `variant` | A section that opens and closes, with a hairline on top. |
| Icons (`icons.tsx`) | `size`, `title` | Inline SVG, 24px grid, 1.75px round strokes. `ICONS` lists all. The reactions use `FlameIcon`, `DanceIcon` and `SleepIcon`. |
| `useMediaQuery` | a query | True while the query matches. |

### 5.2 Feature components (`web/src/components/`)

| Component | Data |
|---|---|
| `TopBar` (with `InviteButton`, `ConnectionStatus`, `Presence`) | room id, connection status (a dot and a word), listeners |
| `RoomTabs` | phone only: the stage or the chat view, the unread count, play and stop |
| `Transport` (with `SongReadouts`, `BeatLights`) | a round blue play button, the tempo as the biggest number, key, swing, version, volume, four beat dots |
| `SetTimeline` | `SetState`, the room cycle, bpm: the phase name with the halftone sun, readouts, and the timetable of blocks (the top edge of a block follows the energy ramp; the current block has a pink screen and a pink outline; the playhead is a pink line). A click on a phase sends "Move the set to the <phase> now" to the band. |
| `SuggestionBar`, `SuggestionChip` | `SuggestionState`, `mineVotes`, the notice, the room cycle and my name; `applySuggestion` and `voteSuggestion` |
| `EnergyMeter`, `MixReport`, `BandPanel` | the energy as a big pink number against the target, the report lines, the agent status and the autopilot switch |
| `AgentStatus`, `AutopilotToggle` | agent state; autopilot on or off |
| `LayerGrid` (the "Line-up"), `LayerCard`, `PatternView`, `AutomationBadge` | layers, the previews from `player.preview()`, errors, transition labels, automations, variations, local mute and solo, the code behind a toggle |
| `CodeView` | the song as Strudel code, "Open in strudel.cc", copy |
| `VersionHistory` | versions and reactions (drawn icons, not emoji) |
| `ChatPanel` (with `ChatLog`, `ChatMessage`, `Composer`) | chat, notice, "To the band" or "To the room" |
| `HomeHero`, `JoinForm`, `SetPreview`, `NameForm` | the home page and the name form |
| `Logo`, `Wordmark`, `LogoMark`, `RobotRow`, `Footer` | the dot-matrix wordmark, the robot mark, the four heads of the band, the credits |

### 5.3 The line-up and the music previews

`LayerGrid` asks `getPreview(id, bar)` (in the room: `player.preview(id, bar)`) for every layer once per bar and when the song changes. `PatternView` draws the events of one bar on 16 steps:

- Unpitched events (drums, percussion, effects): a dot per hit; the size is the velocity.
- Pitched events: a small piano roll; the height is the pitch, the length is the note length, the opacity is the velocity.
- Faint dots mark the steps, thin lines mark the beats. A soloed layer prints in pink; a quiet layer (muted, or silent while a solo is on) fades.

### 5.4 Ideas (suggestions)

- **Sticker:** a light pink screen, corners of 16px, a tilt of at most 1 degree (it straightens on hover and focus). On top: the kind as an icon and a word in pink ink; then the label (bold, at most 2 lines) and the detail (muted, at most 2 lines, the full text as the tooltip).
- **Instant mode:** a click sends the idea; the sticker shows "Sending to the room" with a blue outline, and the others wait. `lastApplied` from the server shows for every listener: "Mila's idea lands in 2 bars: <label>", then "plays now". During `cooldownUntil`, the header says "Next idea in N bars" and the stickers are disabled.
- **Vote mode (roadmap):** each sticker shows votes / needed as a count and as small segments, and "Vote" or "Your vote" (`aria-pressed`).
- **Layout:** two by two in a narrow panel, one row of four from 640px.

### 5.5 Empty and loading states

- **No set** (before the first song): "Not started" and the default arc as a dashed timetable.
- **No report:** before the first song, "Nothing to hear yet"; after a song without a report, the meter shows the target only.
- **No layers:** "The room is silent" with four suggestions that send to the band.
- **No ideas:** before the first song, nothing; with a song, a quiet line under a rule.
- **No chat:** "No messages yet. Tell the band what you want to hear."
- **Band busy:** the agent status pulses in pink, and the chat log shows a pending band line.
- **Offline:** a pink dot and "Offline"; the composer, the suggestions, the phase clicks, the ideas and the autopilot switch are disabled.

## 6. Layout

- **Desktop (960px and wider):** the top bar, then the stage (flexible) and the chat column (380px, sticky, full height under the top bar, a hairline on its left). The footer sits at the bottom of the stage.
- **Stage:** the deck (transport and set), the ideas under it, the band (next to them on a wide stage), the line-up, the code and the versions. Sections sit 48 to 64px apart.
- **Phone and small tablet (under 960px):** the top bar, then the room tabs (play or stop, Stage with the phase, Chat with the unread count). One view at a time. A server notice shows at the top of the stage when the chat is hidden. The room works at 375px wide.

## 7. Rules

### 7.1 Naming and CSS

- One CSS file per component, next to its `.tsx`. The component imports it.
- UI kit classes start with `ui-` (`.ui-button`). Feature classes have no prefix (`.layer`). Parts use `__`, states use `is-` or ARIA attributes, variants and sizes use data attributes (`data-variant`, `data-size`).
- Use semantic tokens for every colour, size, radius, shadow and duration. A local value is a component token.
- Plain CSS with custom properties. No CSS framework.

### 7.2 Accessibility

- Every control has a visible focus ring: 2px blue with a 3px gap (`:focus-visible`).
- Every icon-only control has a label (`IconButton` requires one).
- The chat log, the agent status, the phase name and the idea countdown are `aria-live="polite"`.
- Colour never carries meaning alone: a state also has a word, a shape or a position.
- Pink text is always the deep pink ink; the bright pink never carries text.
- Touch targets are at least 44px on a coarse pointer.
- User text and band text render as React text. Never use `dangerouslySetInnerHTML`.

### 7.3 Writing in the UI

- Short, plain sentences in sentence case.
- Name the band "the band" ("The band" in a heading). Name a listener's own items "you" or "for me" ("Mute drums for me").
- Use the room words: room, set, phase, layer, line-up, idea, version, bar.

### 7.4 Do not use (the "generic AI tool" look)

- Dark graphite panels with a neon accent, and glows.
- Small capitals with letter-spacing, monospace fonts as a style, condensed display capitals.
- A border around every box; cards inside cards.
- Gradient meters, "LIVE" pills, sparkle icons for AI, emoji.
- Large pink fills; text in the bright pink.

## 8. Add a component

1. Decide the place: generic (`ui/`) or room-specific (`components/`).
2. Write the `.tsx` with typed props and a one-line comment that says what it is.
3. Write the `.css` with semantic tokens only. Start with type and space; add a rule only where a section starts.
4. Add it to `ui/index.ts` when it is a UI kit component.
5. Add a specimen to `/styleguide`, with mock data in `design/mock.ts` when it needs room data.
6. Check it at 375px, with the keyboard, with reduced motion, and the contrast of any new colour on the paper.
