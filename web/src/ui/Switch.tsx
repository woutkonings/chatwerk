// An on/off switch. It is a native checkbox with role="switch", so the keyboard and screen readers work.
import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import './Switch.css';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  hideLabel?: boolean; // keep the label for screen readers only
  className?: string;
};

export function Switch({ checked, onCheckedChange, label, description, disabled, hideLabel, className }: SwitchProps) {
  return (
    <label className={cx('ui-switch', disabled && 'is-disabled', className)}>
      <input className="ui-switch__input" type="checkbox" role="switch" checked={checked} disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)} />
      <span className="ui-switch__track" aria-hidden="true"><span className="ui-switch__thumb" /></span>
      <span className={cx('ui-switch__text', hideLabel && 'visually-hidden')}>
        <span className="ui-switch__label">{label}</span>
        {description && <span className="ui-switch__description">{description}</span>}
      </span>
    </label>
  );
}
