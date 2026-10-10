// A choice of two to four options, like a selector switch. It is a radio group, so the arrow keys work.
import { useId, type ReactNode } from 'react';
import { cx } from './cx.ts';
import './SegmentedControl.css';

export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; title?: string };

export type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string; // the accessible name of the group
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value, options, onChange, label, size = 'md', disabled, className,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cx('ui-segmented', className)} data-size={size}>
      {options.map((option) => (
        <label key={option.value} className="ui-segmented__option" title={option.title}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={disabled}
            onChange={() => onChange(option.value)} />
          <span className="ui-segmented__face">
            {option.icon}
            <span>{option.label}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
