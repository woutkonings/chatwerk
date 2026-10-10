// A small label above a larger value, like the facts on a flyer: "Key" above "A minor".
import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import './Readout.css';

export type ReadoutProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'accent' | 'band' | 'muted';
  className?: string;
};

export function Readout({ label, value, unit, title, size = 'md', tone = 'default', className }: ReadoutProps) {
  return (
    <div className={cx('ui-readout', className)} data-size={size} data-tone={tone} title={title}>
      <span className="ui-readout__label">{label}</span>
      <span className="ui-readout__value">
        {value}
        {unit && <span className="ui-readout__unit">{unit}</span>}
      </span>
    </div>
  );
}
