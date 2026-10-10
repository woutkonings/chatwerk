// The music of one layer in one bar, from player.preview(): drums and other unpitched sounds as dots (the size
// is the velocity), pitched sounds as a small piano roll. Faint dots mark the 16 steps; ticks mark the beats.
import type { LayerPreview } from '../player.ts';
import { cx } from '../ui/index.ts';
import './PatternView.css';

const WIDTH = 320;
const HEIGHT = 36;
const STEP = WIDTH / 16;

export function PatternView({ events, label, className }: { events: LayerPreview; label: string; className?: string }) {
  const pitches = events.map((event) => event.midi).filter((midi): midi is number => midi !== null);
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  const y = (midi: number) => (high === low ? HEIGHT / 2 - 2.5 : HEIGHT - 8 - ((midi - low) / (high - low)) * (HEIGHT - 12));
  const notes = pitches.length;
  return (
    <svg className={cx('pattern', className)} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`${label}: ${events.length} ${events.length === 1 ? 'event' : 'events'} in this bar${notes > 0 ? `, ${notes} with a pitch` : ''}`}>
      {Array.from({ length: 16 }, (_, i) => (
        i % 4 === 0
          ? <line key={i} className="pattern__beat" x1={i * STEP + 1} x2={i * STEP + 1} y1={2} y2={HEIGHT - 2} />
          : <circle key={i} className="pattern__step" cx={i * STEP + STEP / 2} cy={HEIGHT / 2} r={1.2} />
      ))}
      {events.map((event, i) => event.midi !== null ? (
        <rect key={i} className="pattern__note" x={event.t * WIDTH + 2} y={y(event.midi)} rx={2.5}
          width={Math.max(6, event.length * WIDTH - 4)} height={5} opacity={0.4 + event.velocity * 0.6} />
      ) : (
        <circle key={i} className="pattern__hit" cx={event.t * WIDTH + STEP / 2} cy={HEIGHT / 2} r={2.5 + Math.min(1, event.velocity) * 4} />
      ))}
    </svg>
  );
}
