// One layer of the song as a line in the line-up: the name, the role and the author, the music of this bar,
// the transition and automation state, the local mute and solo keys, and the code behind a toggle.
import { useId, useState } from 'react';
import type { AutoParam, Automation, Layer } from '../../../shared/schema.ts';
import type { LayerPreview } from '../player.ts';
import { Badge, Button, FilterIcon, ProgressBar, ToggleKey, WarningIcon, WaveIcon, cx } from '../ui/index.ts';
import { automationStatus, formatParam } from './format.ts';
import { PatternView } from './PatternView.tsx';
import './LayerCard.css';

export type LayerCardProps = {
  layer: Layer;
  cycle: number;
  preview?: LayerPreview | null; // the events of this layer in the current bar; null when unknown
  error?: string;
  label: string | null; // the transition label, for example "fade in 3 bars"
  muted: boolean; // muted for me
  soloed: boolean; // soloed for me
  silenced?: boolean; // another layer is soloed, so this one is silent for me
  onMute: () => void;
  onSolo: () => void;
};

export function LayerCard({ layer, cycle, preview = null, error, label, muted, soloed, silenced, onMute, onSolo }: LayerCardProps) {
  const [showCode, setShowCode] = useState(false);
  const codeId = useId();
  const automations = (layer.automation ?? []).filter((automation) => automationStatus(automation, cycle).state !== 'done');
  const variations = layer.vary ?? [];
  const quiet = muted || layer.muted || silenced;
  const hasStatus = layer.muted || label || automations.length > 0 || muted || silenced || variations.length > 0;
  return (
    <article className={cx('layer', quiet && 'is-quiet', soloed && 'is-solo', error && 'has-error')} aria-label={`${layer.role} layer ${layer.id}`}>
      <div className="layer__title">
        <h3 className="layer__name">{layer.id}</h3>
        <p className="layer__meta">
          {layer.role !== layer.id && <>{layer.role}, </>}
          <span title={`Last changed by ${layer.author || 'the band'} in version ${layer.since}`}>
            {layer.author && layer.author !== 'band' ? `for ${layer.author}` : 'by the band'}, v{layer.since}
          </span>
        </p>
      </div>
      <div className="layer__music">
        {layer.muted ? null : preview === null ? null : preview.length > 0
          ? <PatternView events={preview} label={`The music of ${layer.id}`} />
          : <p className="layer__rest">Rests in this bar.</p>}
        {hasStatus && (
          <div className="layer__status">
            {layer.muted && <Badge tone="accent" variant="soft">Muted by the band</Badge>}
            {muted && <Badge>Muted for you</Badge>}
            {silenced && !muted && <Badge>Silent while a solo is on</Badge>}
            {label && <Badge tone="accent" variant="soft">{label}</Badge>}
            {automations.map((automation, i) => <AutomationBadge key={`${automation.param}-${i}`} automation={automation} cycle={cycle} />)}
            {variations.map((kind) => <Badge key={kind} variant="soft" title={`Rhythm variation: ${kind}`}>{kind}</Badge>)}
          </div>
        )}
        {showCode && <pre className="layer__code" id={codeId}>{layer.code}</pre>}
        {error && (
          <p className="layer__error" role="alert">
            <WarningIcon size={14} />
            <span>This layer does not play here: {error}</span>
          </p>
        )}
      </div>
      <div className="layer__keys">
        <ToggleKey tone="mute" pressed={muted} onPressedChange={onMute} label={`Mute ${layer.id} for me`}>M</ToggleKey>
        <ToggleKey tone="solo" pressed={soloed} onPressedChange={onSolo} label={`Solo ${layer.id} for me`}>S</ToggleKey>
        <Button variant="ghost" size="sm" className="layer__code-toggle" aria-expanded={showCode} aria-controls={showCode ? codeId : undefined}
          onClick={() => setShowCode(!showCode)}>
          Code
        </Button>
      </div>
    </article>
  );
}

const PARAM_NAME: Record<AutoParam, string> = {
  lpf: 'low-pass', hpf: 'high-pass', lpq: 'resonance', room: 'reverb', delay: 'delay', shape: 'drive', gain: 'gain',
};

// A parameter that moves over some bars, for example a filter that opens over 16 bars.
export function AutomationBadge({ automation, cycle }: { automation: Automation; cycle: number }) {
  const status = automationStatus(automation, cycle);
  const target = formatParam(automation.param, automation.to);
  const from = automation.from === undefined ? null : formatParam(automation.param, automation.from);
  const icon = automation.param === 'lpf' || automation.param === 'hpf' ? <FilterIcon size={14} /> : <WaveIcon size={14} />;
  const when = status.state === 'pending' ? `in ${status.barsUntil} bar${status.barsUntil === 1 ? '' : 's'}`
    : status.state === 'running' ? `${status.barsLeft} bars left` : 'done';
  const spoken = `${PARAM_NAME[automation.param]} moves ${from === null ? '' : `from ${from} `}to ${target} over ${automation.bars} bars, ${when}`;
  return (
    <span className="automation" data-state={status.state} title={spoken}>
      <span className="automation__row">
        {icon}
        <span className="automation__param">{PARAM_NAME[automation.param]}</span>
        {from !== null && <span className="automation__from">{from}</span>}
        <span aria-hidden="true">→</span>
        <span className="automation__to">{target}</span>
        <span className="automation__when">{when}</span>
      </span>
      {status.state === 'running' && <ProgressBar value={status.progress} label={spoken} />}
      {status.state !== 'running' && <span className="visually-hidden">{spoken}</span>}
    </span>
  );
}
