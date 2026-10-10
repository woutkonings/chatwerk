// On a phone the room has two views, the stage and the chat. This bar switches them and keeps play and stop in reach.
// The bar shows its own play button only while the big play button of the stage is off screen, so one play button shows.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { IconButton, PlayIcon, StopIcon, Spinner, cx, useMediaQuery } from '../ui/index.ts';
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
  playTarget?: RefObject<HTMLElement | null>; // the big play button; without it the bar always shows its own
};

export function RoomTabs({ view, onView, unread, playing, starting, onTogglePlay, phase, playTarget }: RoomTabsProps) {
  const bar = useRef<HTMLElement>(null);
  const phone = useMediaQuery('(max-width: 959px)');
  const [targetOnScreen, setTargetOnScreen] = useState(true);

  useEffect(() => {
    const target = playTarget?.current;
    const nav = bar.current;
    if (!phone || !target || !nav || typeof IntersectionObserver === 'undefined') return;
    // The top bar and this bar stay at the top of the screen, so the visible area starts below them.
    const top = Math.round(nav.getBoundingClientRect().bottom);
    const observer = new IntersectionObserver(([entry]) => { setTargetOnScreen(entry.isIntersecting); },
      { rootMargin: `-${top}px 0px 0px 0px` });
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, [phone, playTarget]);

  const showPlay = !playTarget || !phone || !targetOnScreen;
  return (
    <nav ref={bar} className="room-tabs" aria-label="Room views">
      <div className="room-tabs__play-slot" data-show={showPlay}>
        <IconButton variant={playing ? 'secondary' : 'primary'} label={playing ? 'Stop' : 'Play'} disabled={starting}
          className={cx('room-tabs__play', playing && 'is-playing')} onClick={onTogglePlay}
          icon={starting ? <Spinner size={14} /> : playing ? <StopIcon /> : <PlayIcon />} />
      </div>
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
