// A small clickable tag, for example a suggestion that the user can send with one click.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import './Chip.css';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; selected?: boolean };

export function Chip({ icon, selected, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} className={cx('ui-chip', className)} aria-pressed={selected} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
