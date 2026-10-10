// The transport: a round play button, the tempo as the biggest number, the key, swing and version, the volume and the beat.
import { useEffect, useState, type Ref } from 'react';
import type { Song } from '../../../shared/schema.ts';
import { PlayIcon, Readout, Slider, Spinner, StopIcon, VolumeIcon, VolumeOffIcon, cx } from '../ui/index.ts';
import './Transport.css';

export type TransportProps = {
  song: Song;
  playing: boolean;
  starting: boolean;
  onTogglePlay: () => void;
  volume: number;
  onVolume: (value: number) => void;
  getCycle?: () => number; // the room cycle now, for the beat lights
  playRef?: Ref<HTMLButtonElement>; // the room page watches this button; see RoomTabs
};

export function Transport({ song, playing, starting, onTogglePlay, volume, onVolume, getCycle, playRef }: TransportProps) {
  const hasLayers = song.layers.length > 0;
  return (
    <div className="transport">
      <button ref={playRef} type="button" className={cx('transport__play', playing && 'is-playing')} onClick={onTogglePlay} disabled={starting}
        aria-label={playing ? 'Stop' : 'Play'} aria-busy={starting || undefined}>
        {starting ? <Spinner size={18} /> : playing ? <StopIcon size={22} /> : <PlayIcon size={26} />}
      </button>
      <div className="transport__tempo">
        <span className="transport__bpm">{song.bpm}</span>
        <span className="transport__unit">bpm</span>
      </div>
      <div className="transport__info">
        <dl className="transport__facts">
          <SongReadouts song={song} />
        </dl>
        <div className="transport__side">
          <Slider label="Volume" value={volume} onChange={onVolume} icon={volume === 0 ? <VolumeOffIcon /> : <VolumeIcon />}
            format={(value) => `${Math.round(value * 100)}`} />
          {getCycle && <BeatLights getCycle={getCycle} active={playing} />}
        </div>
      </div>
      {!playing && !starting && hasLayers && <p className="transport__hint">Press play to hear the room.</p>}
    </div>
  );
}

export function SongReadouts({ song }: { song: Song }) {
  const swing = Math.round((song.swing ?? 0) * 100);
  return (
    <>
      <div><dt className="visually-hidden">Key</dt><dd><Readout label="Key" value={`${song.root} ${song.scale.replace(':', ' ')}`} /></dd></div>
      <div>
        <dt className="visually-hidden">Swing</dt>
        <dd><Readout label="Swing" value={swing} unit="%" tone={swing === 0 ? 'muted' : 'default'}
          title="The shuffle on the 16th notes of every layer" /></dd>
      </div>
      <div><dt className="visually-hidden">Version</dt><dd><Readout label="Version" value={song.version} /></dd></div>
    </>
  );
}

// Four dots, one per beat of the bar, on the room clock. They are decoration, so screen readers skip them.
// With reduced motion, the dots stay still.
export function BeatLights({ getCycle, active }: { getCycle: () => number; active: boolean }) {
  const [beat, setBeat] = useState(-1);
  useEffect(() => {
    if (!active || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBeat(-1);
      return;
    }
    let frame = 0;
    const tick = () => {
      const cycle = getCycle();
      setBeat(Math.floor((cycle - Math.floor(cycle)) * 4));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, getCycle]);
  return (
    <span className="beat-lights" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cx('beat-lights__dot', i === 0 && 'is-downbeat', beat === i && 'is-on')} />
      ))}
    </span>
  );
}
