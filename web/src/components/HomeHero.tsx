// The home page parts: the hero with the start button, the join form, the set preview and the name form.
import { useEffect, useState } from 'react';
import { MAX_NAME_LENGTH, ROOM_ID } from '../../../shared/protocol.ts';
import { DEFAULT_ARC, type SetState } from '../../../shared/set.ts';
import { newRoomId } from '../identity.ts';
import { Button, Input, Panel, PlusIcon, RoomIcon, SendIcon } from '../ui/index.ts';
import { Logo, RobotRow, Wordmark } from './Logo.tsx';
import { SetTimeline } from './SetTimeline.tsx';
import './HomeHero.css';

export function HomeHero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <RobotRow size={52} />
      <h1 id="hero-title" className="hero__title"><Wordmark height={112} grid className="hero__wordmark" /></h1>
      <p className="hero__motto">The machines play. You tell them what to play.</p>
      <p className="hero__tagline">
        One room, one song, one band. You and your friends chat with an AI band, and the band changes the music
        for everyone in the room. Dark techno, dub and jungle, made with Strudel.
      </p>
      <div className="hero__actions">
        <Button variant="primary" size="lg" icon={<PlusIcon size={16} />} onClick={() => location.assign(`/r/${newRoomId()}`)}>
          Start a new room
        </Button>
        <JoinForm />
      </div>
    </section>
  );
}

export function JoinForm() {
  const [join, setJoin] = useState('');
  const joinId = join.trim().toLowerCase();
  const valid = ROOM_ID.test(joinId);
  return (
    <form className="join-form" onSubmit={(event) => {
      event.preventDefault();
      if (valid) location.assign(`/r/${joinId}`);
    }}>
      <Input size="lg" leading={<RoomIcon />} placeholder="or join: acid-bunker-x7k2" value={join}
        onChange={(event) => setJoin(event.target.value)} aria-label="Room name" autoCapitalize="none" spellCheck={false} />
      <Button type="submit" size="lg" disabled={!valid}>Join</Button>
    </form>
  );
}

const STEPS = [
  { title: 'Start a room', text: 'Every room has its own song and its own band. No accounts.' },
  { title: 'Share the link', text: 'Everyone in the room hears the same bar at the same time.' },
  { title: 'Ask the band', text: '"Darker", "more acid", "drop the kick". Only the band changes the music.' },
];

// A demo of the live set on the home page: the default arc with a playhead that moves.
export function SetPreview() {
  const cycle = useDemoCycle();
  const set: SetState = { arc: DEFAULT_ARC, index: phaseAt(cycle), phaseStart: startOf(phaseAt(cycle)) };
  return (
    <div className="set-preview">
      <Panel title="A set, an hour or more" meta="demo">
        <SetTimeline set={set} cycle={cycle} bpm={124} />
      </Panel>
      <ol role="list" className="steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className="steps__item">
            <span className="steps__n">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="steps__title">{step.title}</h2>
            <p className="steps__text">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

const TOTAL = DEFAULT_ARC.reduce((sum, phase) => sum + phase.bars, 0);
const startOf = (index: number) => DEFAULT_ARC.slice(0, index).reduce((sum, phase) => sum + phase.bars, 0);
const phaseAt = (cycle: number) => {
  let at = 0;
  for (let i = 0; i < DEFAULT_ARC.length; i++) {
    at += DEFAULT_ARC[i].bars;
    if (cycle < at) return i;
  }
  return DEFAULT_ARC.length - 1;
};

// The demo plays the arc fast (about 2 minutes for the whole set). With reduced motion, it stays in the first peak.
function useDemoCycle(): number {
  const [cycle, setCycle] = useState(startOf(2) + 120);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setCycle((value) => (value + 9) % TOTAL), 500);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return cycle;
}

export function NameForm({ roomId, onDone, autoFocus = true }: { roomId: string; onDone: (name: string) => void; autoFocus?: boolean }) {
  const [value, setValue] = useState('');
  const name = value.trim();
  return (
    <section className="name-form" aria-labelledby="name-form-title">
      <Logo size="md" href="/" />
      <p className="name-form__room t-label">You are joining <strong>{roomId}</strong></p>
      <h1 id="name-form-title" className="name-form__title">What is your name?</h1>
      <p className="name-form__text">The room sees this name in the chat. There are no accounts.</p>
      <form className="join-form" onSubmit={(event) => { event.preventDefault(); if (name) onDone(name); }}>
        <Input size="lg" autoFocus={autoFocus} maxLength={MAX_NAME_LENGTH} placeholder="Your name" value={value}
          onChange={(event) => setValue(event.target.value)} aria-label="Your name" autoComplete="nickname" />
        <Button type="submit" variant="primary" size="lg" disabled={!name} iconEnd={<SendIcon size={16} />}>Enter</Button>
      </form>
    </section>
  );
}
