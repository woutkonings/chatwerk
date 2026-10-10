// The live set as a timetable, like the running order on a festival flyer: one block per phase. The width of a
// block is its length in bars; its top edge follows the energy (from the start to the end of the phase).
// A pink line marks the room cycle. A click on a phase asks the band to move the set there.
import { DEFAULT_ARC, PHASE_HINT, PHASE_LABEL, phaseStarts, type SetState } from '../../../shared/set.ts';
import { Readout, cx } from '../ui/index.ts';
import { barsToSeconds, formatDuration, moveSetMessage, timelineGeometry } from './format.ts';
import './SetTimeline.css';

export type SetTimelineProps = {
  set: SetState | null;
  cycle: number; // the room cycle now
  bpm: number;
  onMove?: (message: string) => void; // without it, the phases are not clickable
  disabled?: boolean;
};

// Before the first song there is no set: the default arc shows as a dashed preview.
const PREVIEW: SetState = { arc: DEFAULT_ARC, index: 0, phaseStart: 0 };

export function SetTimeline({ set, cycle, bpm, onMove, disabled }: SetTimelineProps) {
  if (!set) {
    return (
      <section className="set is-empty" aria-label="Live set">
        <div className="set__head">
          <div className="set__now">
            <p className="t-label">The set</p>
            <h2 className="set__phase">Not started</h2>
            <p className="set__hint">The set starts with the first song. It runs about {formatDuration(barsToSeconds(totalBars(PREVIEW), 124))}, from the warm-up to the closing.</p>
          </div>
        </div>
        <Timetable set={PREVIEW} cycle={0} bpm={124} preview />
      </section>
    );
  }

  const { total, playhead, position } = timelineGeometry(set, cycle);
  return (
    <section className="set" aria-label="Live set">
      <div className="set__head">
        <div className="set__now">
          <p className="t-label">The set, phase {set.index + 1} of {set.arc.length}</p>
          <h2 className="set__phase"><span className="set__sun" aria-hidden="true" /><span aria-live="polite">{PHASE_LABEL[position.phase.kind]}</span></h2>
          <p className="set__hint">
            {position.next ? <>Next: <strong>{PHASE_LABEL[position.next.kind]}</strong>. </> : null}
            <span className="set__hint-text">{capitalize(PHASE_HINT[position.phase.kind])}.</span>
          </p>
        </div>
        <dl className="set__readouts">
          <div><dt className="visually-hidden">Bars left in this phase</dt><dd><Readout label="Bars left" value={Math.ceil(position.barsLeft)} /></dd></div>
          <div><dt className="visually-hidden">Time left in this phase</dt><dd><Readout label="Time left" value={formatDuration(barsToSeconds(position.barsLeft, bpm))} /></dd></div>
          <div><dt className="visually-hidden">Energy target</dt><dd><Readout label="Target energy" value={position.energy} tone="accent" title="The energy target of the set now (1 to 10)" /></dd></div>
          <div className="set__elapsed"><dt className="visually-hidden">Set time</dt>
            <dd><Readout label="Set time" value={formatDuration(barsToSeconds(playhead, bpm))} unit={`of ${formatDuration(barsToSeconds(total, bpm))}`} tone="muted" /></dd></div>
        </dl>
      </div>
      <Timetable set={set} cycle={cycle} bpm={bpm} onMove={disabled ? undefined : onMove} />
    </section>
  );
}

type TimetableProps = { set: SetState; cycle: number; bpm: number; preview?: boolean; onMove?: (message: string) => void };

function Timetable({ set, cycle, bpm, preview, onMove }: TimetableProps) {
  const { total, offsets, playhead } = timelineGeometry(set, cycle);
  const starts = phaseStarts(set);
  const percent = (bars: number) => `${(bars / total) * 100}%`;
  return (
    <div className={cx('timetable', preview && 'is-preview')}>
      <ol role="list" className="timetable__slots">
        {set.arc.map((phase, i) => {
          const state = preview ? 'future' : i < set.index ? 'past' : i === set.index ? 'current' : 'future';
          const label = PHASE_LABEL[phase.kind];
          const when = state === 'past' ? 'done' : state === 'current' ? 'now' : `starts in ${Math.max(0, Math.ceil(starts[i] - cycle))} bars`;
          const description = `${label}, ${phase.bars} bars, energy ${phase.energy[0]} to ${phase.energy[1]}, ${when}`;
          const clickable = Boolean(onMove) && state !== 'current';
          const content = (
            <>
              <svg className="timetable__block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <polygon points={`0,100 0,${100 - phase.energy[0] * 10} 100,${100 - phase.energy[1] * 10} 100,100`} />
              </svg>
              <span className="timetable__name" aria-hidden="true">{label}</span>
              <span className="timetable__time" aria-hidden="true">{formatDuration(barsToSeconds(offsets[i], bpm))}</span>
            </>
          );
          return (
            <li key={i} className="timetable__slot" data-state={state} style={{ flexGrow: phase.bars }}>
              {clickable ? (
                <button type="button" className="timetable__button" title={`${description}. Click: ${moveSetMessage(set, i)}`}
                  aria-label={`${description}. Ask the band to move the set here.`} onClick={() => onMove?.(moveSetMessage(set, i))}>
                  {content}
                </button>
              ) : (
                <div className="timetable__button" title={description} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="visually-hidden">{description}</span>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!preview && <div className="timetable__now" style={{ left: percent(playhead) }} aria-hidden="true"><span>now</span></div>}
    </div>
  );
}

const totalBars = (set: SetState) => set.arc.reduce((sum, phase) => sum + phase.bars, 0);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
