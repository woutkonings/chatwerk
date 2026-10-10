// A room: the wiring of the connection and the player, and the layout of the stage and the chat.
// All text from users and from the agent renders as React text, never as HTML.
import { useCallback, useEffect, useRef, useState } from 'react';
import { PHASE_LABEL, setPosition } from '../../shared/set.ts';
import { BandPanel } from './components/MixReport.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { CodeView } from './components/CodeView.tsx';
import { Footer } from './components/Footer.tsx';
import { NameForm } from './components/HomeHero.tsx';
import { LayerGrid } from './components/LayerGrid.tsx';
import { RoomTabs, type RoomView } from './components/RoomTabs.tsx';
import { SetTimeline } from './components/SetTimeline.tsx';
import { SuggestionBar } from './components/SuggestionBar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Transport } from './components/Transport.tsx';
import { VersionHistory } from './components/VersionHistory.tsx';
import { Connection, INITIAL_STATE, type RoomState } from './connection.ts';
import { getClientId, getName, saveName } from './identity.ts';
import { Player, type LayerErrors } from './player.ts';
import { Notice, useMediaQuery } from './ui/index.ts';

export function RoomPage({ roomId }: { roomId: string }) {
  const [name, setName] = useState(getName());
  if (!name) {
    return (
      <div className="page page--center">
        <main className="page__main">
          <NameForm roomId={roomId} onDone={(value) => { saveName(value); setName(value); }} />
        </main>
      </div>
    );
  }
  return <Room roomId={roomId} name={name} />;
}

function Room({ roomId, name }: { roomId: string; name: string }) {
  const [state, setState] = useState<RoomState>(INITIAL_STATE);
  const [errors, setErrors] = useState<LayerErrors>({});
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [mutes, setMutes] = useState<Set<string>>(new Set());
  const [solo, setSolo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [cycle, setCycle] = useState(0); // the room cycle, for the transition labels and the set timeline
  const [view, setView] = useState<RoomView>('stage'); // on a phone: the stage or the chat
  const connection = useRef<Connection | null>(null);
  const player = useRef<Player | null>(null);
  const transportPlay = useRef<HTMLButtonElement>(null); // on a phone the bar hides its play button while this one shows

  useEffect(() => {
    const conn = new Connection(roomId, name, getClientId(), {
      onState: setState,
      onSong: (song, clocks, applyAt, changes) => player.current?.setSong(song, clocks, applyAt, changes),
    });
    player.current = new Player(conn.clock, setErrors);
    // For tests from the browser console: how far this listener is from the room clock.
    Object.assign(window, { musicChat: { debug: () => ({ ...player.current?.debug(), clockOffsetMs: conn.clock.offsetMs }) } });
    connection.current = conn;
    conn.open();
    return () => {
      conn.close();
      player.current?.stop();
    };
  }, [roomId, name]);

  useEffect(() => {
    player.current?.setLocal(mutes, solo);
  }, [mutes, solo]);

  useEffect(() => {
    const timer = setInterval(() => setCycle(player.current?.roomNow() ?? 0), 500);
    return () => clearInterval(timer);
  }, []);

  // On a wide screen the chat is always visible; on a phone only in the chat view.
  const chatVisible = useMediaQuery('(min-width: 960px)') || view === 'chat';
  const unread = useUnread(state, chatVisible, name);
  const getCycle = useCallback(() => player.current?.roomNow() ?? 0, []);
  // The music of one layer in one bar, for the line-up. It works also while the player is stopped.
  const getPreview = useCallback((id: string, bar: number) => player.current?.preview(id, bar) ?? [], []);

  const togglePlay = async () => {
    const current = player.current;
    if (!current) return;
    if (current.playing) {
      current.stop();
      setPlaying(false);
      return;
    }
    setStarting(true);
    try {
      await current.start();
      current.setSong(state.song, state.clocks, null);
      setPlaying(true);
    } finally {
      setStarting(false);
    }
  };

  const send = (text: string, toBand = true) => {
    const clean = text.trim();
    if (!clean) return;
    connection.current?.chat(clean, toBand);
    setDraft('');
  };

  const toggleMute = (id: string) => {
    const next = new Set(mutes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMutes(next);
  };

  const { song, set } = state;
  const open = state.status === 'open';
  const position = set ? setPosition(set, cycle) : null;
  return (
    <div className="room">
      <TopBar roomId={roomId} status={state.status} users={state.users} youId={state.you?.id} />
      <RoomTabs view={view} onView={setView} unread={unread} playing={playing} starting={starting} onTogglePlay={togglePlay}
        phase={position ? PHASE_LABEL[position.phase.kind] : null} playTarget={transportPlay} />

      <div className="room__body" data-view={view}>
        <main id="room-stage" className="room__stage" aria-label="Stage">
          {/* On a phone the chat is hidden, so a notice (for example an idea cooldown) shows on the stage. */}
          {!chatVisible && state.notice && (
            <Notice tone="warn" onDismiss={() => connection.current?.dismissNotice()}>{state.notice}</Notice>
          )}
          <div className="room__top">
            <section className="deck" aria-label="Deck">
              <Transport song={song} playing={playing} starting={starting} onTogglePlay={togglePlay} volume={volume}
                onVolume={(value) => { setVolume(value); player.current?.setVolume(value); }} getCycle={getCycle} playRef={transportPlay} />
              <SetTimeline set={set} cycle={cycle} bpm={song.bpm} onMove={(message) => send(message, true)} disabled={!open} />
            </section>
            <SuggestionBar suggestions={state.suggestions} mineVotes={state.mineVotes} notice={state.notice} cycle={cycle}
              you={state.you?.name} hasSong={song.layers.length > 0}
              disabled={!open} onApply={(id) => connection.current?.applySuggestion(id)} onVote={(id) => connection.current?.voteSuggestion(id)} />
            <BandPanel agent={state.agent} autopilot={state.autopilot} onAutopilot={(on) => connection.current?.setAutopilot(on)}
              connected={open} report={state.report} target={position?.energy ?? null} hasSong={song.layers.length > 0} />
          </div>

          <LayerGrid layers={song.layers} errors={errors} changes={state.changes} cycle={cycle} mutes={mutes} solo={solo}
            onMute={toggleMute} onSolo={(id) => setSolo(solo === id ? null : id)} onSuggest={(text) => send(text)} canSuggest={open}
            getPreview={getPreview} />

          {song.layers.length > 0 && <CodeView song={song} />}

          <VersionHistory versions={state.versions} reactions={state.reactions} mine={state.mine} current={song.version}
            onReact={(version, reaction) => connection.current?.react(version, reaction)} />
          <Footer />
        </main>

        <ChatPanel id="room-chat" className="room__chat" chat={state.chat} you={state.you?.name} agent={state.agent} notice={state.notice}
          onDismissNotice={() => connection.current?.dismissNotice()} draft={draft} setDraft={setDraft} onSend={send}
          disabled={!open} active={chatVisible} />
      </div>
    </div>
  );
}

// Counts the new messages of other people while the chat view is hidden (on a phone).
// The messages of the first snapshot count as read.
function useUnread(state: RoomState, chatVisible: boolean, name: string): number {
  const [seen, setSeen] = useState<number | null>(null);
  const last = state.chat.at(-1)?.id ?? 0;
  useEffect(() => {
    if (state.status !== 'open') return;
    if (chatVisible || seen === null) setSeen(last);
  }, [chatVisible, last, seen, state.status]);
  if (seen === null || chatVisible) return 0;
  return state.chat.filter((entry) => entry.id > seen && !(entry.kind === 'user' && entry.author === name)).length;
}
