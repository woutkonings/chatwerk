// A short status label in sentence case. `color` overrides the tone colour.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import './Badge.css';

export type BadgeTone = 'neutral' | 'accent' | 'band' | 'warn' | 'danger';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  variant?: 'outline' | 'soft' | 'solid';
  color?: string; // a CSS colour, normally a token: var(--color-role-bass)
  icon?: ReactNode;
};

export function Badge({ tone = 'neutral', variant = 'outline', color, icon, className, style, children, ...rest }: BadgeProps) {
  return (
    <span className={cx('ui-badge', className)} data-tone={tone} data-variant={variant}
      style={color ? ({ ...style, '--badge-color': color } as CSSProperties) : style} {...rest}>
      {icon}
      {children}
    </span>
  );
}
