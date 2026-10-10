// A thin progress bar, 0 to 1. `color` overrides the accent, for example with a role colour.
import type { CSSProperties } from 'react';
import { cx } from './cx.ts';
import './ProgressBar.css';

export type ProgressBarProps = { value: number; label: string; color?: string; className?: string };

export function ProgressBar({ value, label, color, className }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className={cx('ui-progress', className)} role="progressbar" aria-label={label} aria-valuemin={0}
      aria-valuemax={100} aria-valuenow={percent}
      style={{ '--progress': `${percent}%`, ...(color ? { '--progress-color': color } : {}) } as CSSProperties}>
      <span className="ui-progress__fill" />
    </span>
  );
}
