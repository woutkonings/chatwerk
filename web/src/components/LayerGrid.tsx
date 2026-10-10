// The layers of the song as a line-up. Each line shows the music of the current bar from the player.
// With no layers, the room is silent and shows suggestions.
import { useMemo } from 'react';
import { MAX_LAYERS, type Layer } from '../../../shared/schema.ts';
import type { LayerChange } from '../../../shared/transition.ts';
import type { LayerErrors, LayerPreview } from '../player.ts';
import { Chip, EmptyState, Panel, SendIcon, WaveIcon } from '../ui/index.ts';
import { changeLabel } from './format.ts';
import { LayerCard } from './LayerCard.tsx';
import './LayerGrid.css';

export const SUGGESTIONS = [
  'Start a dark underground techno groove at 132 bpm',
  'Give me a dubby, hypnotic groove with chord stabs and lots of delay',
  'Jungle! Chopped amen break and a deep sub bass at 170',
  'Add an acid line that builds slowly',
];

export type LayerGridProps = {
  layers: Layer[];
  errors: LayerErrors;
  changes: Record<string, LayerChange>;
  cycle: number;
  mutes: Set<string>;
  solo: string | null;
  onMute: (id: string) => void;
  onSolo: (id: string) => void;
  onSuggest: (text: string) => void;
  canSuggest: boolean;
  getPreview?: (id: string, bar: number) => LayerPreview; // the events of one layer in one bar (player.preview)
};

export function LayerGrid({ layers, errors, changes, cycle, mutes, solo, onMute, onSolo, onSuggest, canSuggest, getPreview }: LayerGridProps) {
  // The previews change with the song and once per bar.
  const bar = Math.floor(cycle);
  const previews = useMemo(() => {
    if (!getPreview) return null;
    return Object.fromEntries(layers.map((layer) => [layer.id, getPreview(layer.id, bar)]));
  }, [layers, bar, getPreview]);

  return (
    <Panel className="layer-grid" title="Line-up" meta={`${layers.length} of ${MAX_LAYERS} layers`}>
      {layers.length === 0 ? (
        <EmptyState icon={<WaveIcon size={22} />} title="The room is silent" actions={SUGGESTIONS.map((text) => (
          <Chip key={text} icon={<SendIcon size={14} />} onClick={() => onSuggest(text)} disabled={!canSuggest}>{text}</Chip>
        ))}>
          Ask the band for something. Pick a start, or type your own idea in the chat.
        </EmptyState>
      ) : (
        <div className="layer-grid__list">
          {layers.map((layer) => (
            <LayerCard key={layer.id} layer={layer} cycle={cycle} preview={previews?.[layer.id] ?? null} error={errors[layer.id]}
              label={changeLabel(changes[layer.id], cycle)} muted={mutes.has(layer.id)} soloed={solo === layer.id}
              silenced={solo !== null && solo !== layer.id} onMute={() => onMute(layer.id)} onSolo={() => onSolo(layer.id)} />
          ))}
        </div>
      )}
    </Panel>
  );
}
