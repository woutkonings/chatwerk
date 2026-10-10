// A listener: a square avatar with the initial, and the name. "You" gets the accent.
import { cx } from './cx.ts';
import './UserChip.css';

export type UserChipProps = { name: string; you?: boolean; band?: boolean; compact?: boolean; className?: string };

export function UserChip({ name, you, band, compact, className }: UserChipProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span className={cx('ui-user', you && 'is-you', band && 'is-band', compact && 'is-compact', className)}
      title={you ? `${name} (you)` : name}>
      <span className="ui-user__avatar" aria-hidden="true">{initial}</span>
      <span className={compact ? 'visually-hidden' : 'ui-user__name'}>{name}{you && <span className="visually-hidden"> (you)</span>}</span>
    </span>
  );
}
