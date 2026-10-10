// The home page: start a new room or join one by name.
import { useState } from 'react';
import { ROOM_ID } from '../../shared/protocol.ts';
import { Footer } from './Footer.tsx';
import { newRoomId } from './identity.ts';

export function Home() {
  const [join, setJoin] = useState('');
  const joinId = join.trim().toLowerCase();

  return (
    <div className="home">
      <main className="home-main">
        <h1 className="logo">music<span>·</span>chat</h1>
        <p className="tagline">
          One room, one song, one band. You and your friends chat with an AI band, and the band changes the music
          for everyone in the room. Dark techno, dub and jungle, made with Strudel.
        </p>
        <button className="button primary big" onClick={() => location.assign(`/r/${newRoomId()}`)}>
          Start a new room
        </button>
        <form
          className="join"
          onSubmit={(event) => {
            event.preventDefault();
            if (ROOM_ID.test(joinId)) location.assign(`/r/${joinId}`);
          }}
        >
          <input
            className="input"
            placeholder="or join a room, for example acid-bunker-x7k2"
            value={join}
            onChange={(event) => setJoin(event.target.value)}
            aria-label="Room name"
          />
          <button className="button" disabled={!ROOM_ID.test(joinId)}>Join</button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
