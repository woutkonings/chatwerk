// The song versions, newest first, with the reactions of the room. The band sees the counts.
// The reactions are small drawn icons (a flame, a dancer, a sleeper), not emoji.
import { useMemo, type ComponentType } from 'react';
import { REACTIONS, type Reaction, type ReactionCounts, type VersionInfo } from '../../../shared/protocol.ts';
import { DanceIcon, Disclosure, FlameIcon, SleepIcon, cx, type IconProps } from '../ui/index.ts';
import { formatClock } from './format.ts';
import './VersionHistory.css';

const REACTION_ICON: Record<Reaction, ComponentType<IconProps>> = { fire: FlameIcon, dance: DanceIcon, meh: SleepIcon };

export type VersionHistoryProps = {
  versions: VersionInfo[];
  reactions: ReactionCounts;
  mine: Set<string>; // "version:reaction"
  current: number; // the version that plays now
  onReact: (version: number, reaction: Reaction) => void;
};

export function VersionHistory({ versions, reactions, mine, current, onReact }: VersionHistoryProps) {
  const newest = useMemo(() => [...versions].reverse(), [versions]);
  if (newest.length === 0) return null;
  return (
    <Disclosure className="history" summary="Versions" meta={`${versions.length}`} defaultOpen>
      <ol role="list" className="history__list">
        {newest.map((version) => (
          <li key={version.n} className={cx('history__item', version.n === current && 'is-current')}>
            <span className="history__n">v{version.n}</span>
            <span className="history__summary">
              {version.summary || 'change'}
              {version.n === current && <span className="history__now">now playing</span>}
            </span>
            <span className="history__meta">{version.author}, {formatClock(version.at)}</span>
            <span className="history__reactions">
              {REACTIONS.map((reaction) => {
                const count = reactions[version.n]?.[reaction] ?? 0;
                const Icon = REACTION_ICON[reaction];
                const on = mine.has(`${version.n}:${reaction}`);
                return (
                  <button key={reaction} type="button" className={cx('reaction', on && 'is-on')} aria-pressed={on}
                    onClick={() => onReact(version.n, reaction)} title={reaction}
                    aria-label={`${reaction} for version ${version.n}${count > 0 ? `, ${count}` : ''}`}>
                    <Icon size={16} />
                    {count > 0 && <span className="reaction__count" aria-hidden="true">{count}</span>}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}
