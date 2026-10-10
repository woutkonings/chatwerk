// A horizontal fader on a native range input. The filled part of the track shows the value.
import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx.ts';
import './Slider.css';

export type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  icon?: ReactNode;
  showLabel?: boolean;
  format?: (value: number) => string; // shows the value next to the fader
  disabled?: boolean;
  className?: string;
};

export function Slider({
  value, onChange, label, min = 0, max = 1, step = 0.01, icon, showLabel, format, disabled, className,
}: SliderProps) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <label className={cx('ui-slider', disabled && 'is-disabled', className)}>
      {icon && <span className="ui-slider__icon" aria-hidden="true">{icon}</span>}
      <span className={showLabel ? 't-label' : 'visually-hidden'}>{label}</span>
      <input type="range" className="ui-slider__input" min={min} max={max} step={step} value={value} disabled={disabled}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        aria-valuetext={format ? format(value) : undefined}
        onChange={(event) => onChange(Number(event.target.value))} />
      {format && <span className="ui-slider__value" aria-hidden="true">{format(value)}</span>}
    </label>
  );
}
