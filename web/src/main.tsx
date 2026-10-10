// Entry point. Two pages: the home page at / and a room at /r/<id>.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ROOM_ID } from '../../shared/protocol.ts';
import { Home } from './Home.tsx';
import { RoomPage } from './RoomPage.tsx';
import './styles.css';

const match = /^\/r\/([^/]+)\/?$/.exec(location.pathname);
const roomId = match && ROOM_ID.test(match[1]) ? match[1] : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{roomId ? <RoomPage roomId={roomId} /> : <Home />}</StrictMode>,
);
