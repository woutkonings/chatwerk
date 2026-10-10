// Ideas: up to 4 small changes that any listener can play with one click. Code makes them (no model call),
// so they are instant and free. Instant mode: a click applies the idea at the next phrase for everyone.
// Vote mode (roadmap): a click toggles my vote, and the idea plays when it has enough votes.
import { useEffect, useId, useState, type ComponentType, type CSSProperties } from 'react';
import type { SuggestMode, SuggestionKind, SuggestionState, SuggestionView } from '../../../shared/suggest.ts';
import {
  ArrowDownIcon, ArrowUpIcon, ColourIcon, DropIcon, HistoryIcon, Led, Panel, PhaseIcon, SpaceIcon, StepsIcon,
  WrenchIcon, cx, type IconProps,
} from '../ui/index.ts';
import './SuggestionBar.css';

export const KIND_LABEL: Record<SuggestionKind, string> = {
  'energy-up': 'Energy up', 'energy-down': 'Energy down', groove: 'Groove', colour: 'Colour', space: 'Space',
  drop: 'Drop', phase: 'Set phase', restore: 'Restore', fix: 'Fix',
};

const KIND_ICON: Record<SuggestionKind, ComponentType<IconProps>> = {
  'energy-up': ArrowUpIcon, 'energy-down': ArrowDownIcon, groove: StepsIcon, colour: ColourIcon, space: SpaceIcon,
  drop: DropIcon, phase: PhaseIcon, restore: HistoryIcon, fix: WrenchIcon,
};

// The longest time that a chip waits for an answer from the server.
const SEND_TIMEOUT_MS = 12_000;

export type SuggestionBarProps = {
  suggestions: SuggestionState | null;
  mineVotes: Set<string>;
  onApply: (id: string) => void;
  onVote: (id: string) => void;
  notice: string | null; // a new notice (for example a cooldown) means that the room refused the click
  cycle: number; // the room cycle now, for the countdowns
  you?: string; // my name, so my own idea reads "Your idea"
  hasSong: boolean;
  disabled?: boolean;
};

type Sent = { id: string; version: number | undefined };

export function SuggestionBar({ suggestions, mineVotes, onApply, onVote, notice, cycle, you, hasSong, disabled }: SuggestionBarProps) {
  const [sent, setSent] = useState<Sent | null>(null); // my click, before the new version arrives
  const version = suggestions?.version;

  // New ideas (the change is made) or a notice (the room refused the click) end the sending state.
  useEffect(() => {
    setSent(null);
  }, [version, notice]);

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(null), SEND_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [sent]);

  if (!suggestions || suggestions.items.length === 0) {
    if (!hasSong) return null;
    return (
      <p className="ideas-hint">
        {suggestions ? 'No ideas for this version. Ask the band in the chat.' : 'Ideas for the next change show here.'}
      </p>
    );
  }

  const { mode, items, needed, lastApplied, cooldownUntil } = suggestions;
  const cooldown = mode === 'instant' && cooldownUntil !== undefined && cooldownUntil > cycle ? Math.ceil(cooldownUntil - cycle) : 0;
  // The last applied idea shows for every listener until one bar after it lands.
  const last = lastApplied && cycle < lastApplied.at + 1 ? lastApplied : null;
  const lastBars = last ? Math.ceil(last.at - cycle) : 0;
  const who = last ? (last.by === you ? 'Your idea' : `${last.by}’s idea`) : '';
  return (
    <Panel className="ideas" padding="sm" title="Ideas"
      meta={mode === 'vote' ? `An idea plays at ${needed} votes`
        : cooldown > 0 ? `Next idea in ${cooldown} bar${cooldown === 1 ? '' : 's'}` : 'One click plays it for everyone at the next phrase'}>
      <div className="ideas__chips">
        {items.map((item) => (
          <SuggestionChip key={item.id} item={item} mode={mode} needed={needed} voted={mineVotes.has(item.id)}
            landing={sent?.id === item.id} disabled={disabled || (mode === 'instant' && (sent !== null || cooldown > 0))}
            onClick={() => {
              if (mode === 'vote') {
                onVote(item.id);
                return;
              }
              onApply(item.id);
              setSent({ id: item.id, version });
            }} />
        ))}
      </div>
      <p className="ideas__landing" aria-live="polite">
        {last && (
          <>
            <Led tone="accent" pulse={lastBars > 0} size="sm" />
            <span>
              {who} {lastBars > 0 ? `lands in ${lastBars} bar${lastBars === 1 ? '' : 's'}` : 'plays now'}: <strong>{last.label}</strong>
            </span>
          </>
        )}
      </p>
    </Panel>
  );
}

export type SuggestionChipProps = {
  item: SuggestionView;
  mode: SuggestMode;
  needed: number;
  voted?: boolean; // vote mode: I voted for this idea
  landing?: boolean; // instant mode: I clicked it, and the room makes the change
  disabled?: boolean;
  onClick: () => void;
};

export function SuggestionChip({ item, mode, needed, voted = false, landing = false, disabled, onClick }: SuggestionChipProps) {
  const detailId = useId();
  const Icon = KIND_ICON[item.kind];
  const vote = mode === 'vote';
  const label = vote
    ? `Vote for: ${item.label}. ${item.votes} of ${needed} votes.`
    : landing ? `${item.label}. Sending.` : `Play the idea: ${item.label}.`;
  return (
    <button type="button" className={cx('idea', landing && 'is-landing')} data-kind={item.kind} data-mode={mode}
      style={{ '--idea': `var(--color-idea-${item.kind})` } as CSSProperties} onClick={onClick} disabled={disabled}
      aria-label={label} aria-describedby={detailId} aria-pressed={vote ? voted : undefined} aria-busy={landing || undefined}
      title={item.detail}>
      <span className="idea__head">
        <Icon size={13} />
        <span className="idea__kind">{KIND_LABEL[item.kind]}</span>
        {landing && <Led tone="accent" pulse size="sm" className="idea__led" />}
        {vote && <span className="idea__count">{item.votes}/{needed}</span>}
      </span>
      <span className="idea__label">{item.label}</span>
      <span id={detailId} className="idea__detail">{landing ? 'Sending to the room…' : item.detail}</span>
      {vote && (
        <span className="idea__vote" aria-hidden="true">
          <span className="idea__segments">
            {Array.from({ length: Math.min(needed, 8) }, (_, i) => (
              <span key={i} className={cx('idea__segment', i < item.votes && 'is-lit')} />
            ))}
          </span>
          <span className="idea__vote-label">{voted ? 'Your vote' : 'Vote'}</span>
        </span>
      )}
    </button>
  );
}
