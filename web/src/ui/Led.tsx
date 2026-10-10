// A status dot. With a label it is an image for screen readers; without one it is decoration.
import { cx } from './cx.ts';
import './Led.css';

export type LedTone = 'accent' | 'band' | 'warn' | 'danger' | 'off';

export type LedProps = { tone?: LedTone; pulse?: boolean; label?: string; size?: 'sm' | 'md'; className?: string };

export function Led({ tone = 'accent', pulse, label, size = 'md', className }: LedProps) {
  return (
    <span className={cx('ui-led', pulse && 'is-pulsing', className)} data-tone={tone} data-size={size}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  );
}
