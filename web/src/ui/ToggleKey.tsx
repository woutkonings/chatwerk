// A round key that latches: a short caption, printed solid when the key is on.
// Use it for mixer keys such as mute (M) and solo (S).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import './ToggleKey.css';

export type ToggleKeyTone = 'mute' | 'solo' | 'accent' | 'band';

export type ToggleKeyProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  label: string; // the accessible name, for example "Mute drums for me"
  tone?: ToggleKeyTone;
  children: ReactNode; // the caption on the key, for example "M"
};

export function ToggleKey({ pressed, onPressedChange, label, tone = 'accent', className, children, ...rest }: ToggleKeyProps) {
  return (
    <button type="button" className={cx('ui-key', className)} data-tone={tone} aria-pressed={pressed}
      aria-label={label} title={label} onClick={() => onPressedChange(!pressed)} {...rest}>
      <span className="ui-key__caption">{children}</span>
    </button>
  );
}
