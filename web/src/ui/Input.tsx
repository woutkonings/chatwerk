// A one-line text field. With `leading`, an icon or a short text sits inside the field on the left.
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx.ts';
import './Input.css';

export type InputProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  size?: 'sm' | 'md' | 'lg';
  leading?: ReactNode;
  invalid?: boolean;
  mono?: boolean;
};

export function Input({ size = 'md', leading, invalid, mono, className, ...rest }: InputProps) {
  const input = (
    <input className={cx('ui-input', mono && 'ui-input--mono', !leading && className)} data-size={size}
      aria-invalid={invalid || undefined} {...rest} />
  );
  if (!leading) return input;
  return (
    <span className={cx('ui-field', className)} data-size={size}>
      <span className="ui-field__leading" aria-hidden="true">{leading}</span>
      {input}
    </span>
  );
}
