// Entry point. Three pages: the home page at /, a room at /r/<id> and the style guide at /styleguide.
// One typeface, bundled: Bricolage Grotesque with all its axes (weight, width, optical size).
import '@fontsource-variable/bricolage-grotesque/standard.css';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { ROOM_ID } from '../../shared/protocol.ts';
import { Home } from './Home.tsx';
import { RoomPage } from './RoomPage.tsx';
import './design/tokens.css';
import './design/base.css';
import './styles.css';

// The style guide loads only on its own page.
const Styleguide = lazy(() => import('./design/Styleguide.tsx').then((module) => ({ default: module.Styleguide })));

const match = /^\/r\/([^/]+)\/?$/.exec(location.pathname);
const roomId = match && ROOM_ID.test(match[1]) ? match[1] : null;
const styleguide = /^\/styleguide\/?$/.test(location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {roomId ? <RoomPage roomId={roomId} /> : styleguide ? <Suspense fallback={null}><Styleguide /></Suspense> : <Home />}
  </StrictMode>,
);
