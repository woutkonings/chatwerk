// On a phone the room has two views, the stage and the chat. This bar switches them and keeps play and stop in reach.
import { IconButton, PlayIcon, StopIcon, Spinner, cx } from '../ui/index.ts';
import './RoomTabs.css';

export type RoomView = 'stage' | 'chat';

export type RoomTabsProps = {
  view: RoomView;
  onView: (view: RoomView) => void;
  unread: number;
  playing: boolean;
  starting: boolean;
  onTogglePlay: () => void;
  phase?: string | null; // the current set phase, for example "Peak"
};

export function RoomTabs({ view, onView, unread, playing, starting, onTogglePlay, phase }: RoomTabsProps) {
  return (
    <nav className="room-tabs" aria-label="Room views">
      <IconButton variant={playing ? 'secondary' : 'primary'} label={playing ? 'Stop' : 'Play'} disabled={starting}
        className={cx('room-tabs__play', playing && 'is-playing')} onClick={onTogglePlay}
        icon={starting ? <Spinner size={14} /> : playing ? <StopIcon /> : <PlayIcon />} />
      <div className="room-tabs__tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'stage'} aria-controls="room-stage" className="room-tabs__tab" onClick={() => onView('stage')}>
          Stage
          {phase && <span className="room-tabs__phase">{phase}</span>}
        </button>
        <button type="button" role="tab" aria-selected={view === 'chat'} aria-controls="room-chat" className="room-tabs__tab" onClick={() => onView('chat')}>
          Chat
          {unread > 0 && <span className="room-tabs__unread" aria-label={`${unread} new`}>{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>
    </nav>
  );
}
