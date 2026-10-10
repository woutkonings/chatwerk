// A row of printed squares, like a level meter. An optional target tick shows where the value should be.
import type { CSSProperties } from 'react';
import { cx } from './cx.ts';
import './Meter.css';

export type MeterTone = 'energy' | 'accent' | 'band';

export type MeterProps = {
  value: number | null; // null: no reading (all segments off)
  max?: number;
  segments?: number;
  target?: number | null;
  label: string; // the accessible name
  valueText?: string; // the spoken value; the default is "value of max"
  tone?: MeterTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function Meter({
  value, max = 10, segments = max, target = null, label, valueText, tone = 'energy', size = 'md', className,
}: MeterProps) {
  const lit = value === null ? 0 : Math.round((Math.min(max, Math.max(0, value)) / max) * segments);
  return (
    <div className={cx('ui-meter', className)} data-tone={tone} data-size={size} role="meter" aria-label={label}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined}
      aria-valuetext={valueText ?? (value === null ? 'no reading' : `${value} of ${max}`)}>
      <div className="ui-meter__segments">
        {Array.from({ length: segments }, (_, i) => {
          const step = Math.min(10, Math.max(1, Math.ceil(((i + 1) / segments) * 10)));
          return (
            <span key={i} className={cx('ui-meter__segment', i < lit && 'is-lit')}
              style={tone === 'energy' ? ({ '--segment-color': `var(--color-energy-${step})` } as CSSProperties) : undefined} />
          );
        })}
      </div>
      {target !== null && (
        <span className="ui-meter__target" style={{ left: `${(Math.min(max, Math.max(0, target)) / max) * 100}%` }}
          aria-hidden="true" />
      )}
    </div>
  );
}
