// The energy of the mix (what the band hears) against the energy target of the set phase:
// a big number in pink ink, a row of squares and a target tick.
import { Meter } from '../ui/index.ts';
import { energyDelta } from './format.ts';
import './EnergyMeter.css';

export type EnergyMeterProps = { energy: number | null; target: number | null; size?: 'sm' | 'md' | 'lg' };

export function EnergyMeter({ energy, target, size = 'md' }: EnergyMeterProps) {
  const delta = energy !== null && target !== null ? energyDelta(energy, target) : null;
  const valueText = [
    energy === null ? 'no reading' : `energy ${energy} of 10`,
    target === null ? null : `target ${target}`,
    delta?.text,
  ].filter(Boolean).join(', ');
  return (
    <div className="energy-meter">
      <div className="energy-meter__head">
        <span className="energy-meter__value">{energy ?? '–'}</span>
        <span className="energy-meter__of">
          of 10
          <br />
          {target !== null ? <>target {target}</> : 'no target'}
        </span>
        {delta && <span className="energy-meter__delta" data-tone={delta.tone}>{delta.text}</span>}
      </div>
      <Meter value={energy} target={target} label="Energy" valueText={valueText} size={size} />
    </div>
  );
}
