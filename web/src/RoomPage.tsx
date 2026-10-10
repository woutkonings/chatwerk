// A room: the player, the layer cards, the code view, the version history and the chat.
// All text from users and from the agent renders as React text, never as HTML.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MAX_CHAT_LENGTH, MAX_NAME_LENGTH, REACTIONS, REACTION_EMOJI, type ChatEntry } from '../../shared/protocol.ts';
import type { Layer } from '../../shared/schema.ts';
import type { LayerChange } from '../../shared/transition.ts';
import { strudelUrl, toStrudelCode } from '../../shared/song.ts';
import { Connection, INITIAL_STATE, type RoomState } from './connection.ts';
import { Footer } from './Footer.tsx';
import { getClientId, getName, saveName } from './identity.ts';
import { Player, type LayerErrors } from './player.ts';

const SUGGESTIONS = [
  'Start a dark underground techno groove at 132 bpm',
  'Give me a dubby, hypnotic groove with chord stabs and lots of delay',
  'Jungle! Chopped amen break and a deep sub bass at 170',
  'Add an acid line that builds slowly',
];

export function RoomPage({ roomId }: { roomId: string }) {
  const [name, setName] = useState(getName());
  if (!name) return <NameForm onDone={(value) => { saveName(value); setName(value); }} roomId={roomId} />;
  return <Room roomId={roomId} name={name} />;
}

function NameForm({ roomId, onDone }: { roomId: string; onDone: (name: string) => void }) {
  const [value, setValue] = useState('');
  const name = value.trim();
  return (
    <div className="home">
      <main className="home-main">
        <h1 className="logo">music<span>·</span>chat</h1>
        <p className="tagline">You are joining <strong>{roomId}</strong>. What is your name?</p>
        <form className="join" onSubmit={(event) => { event.preventDefault(); if (name) onDone(name); }}>
          <input className="input" autoFocus maxLength={MAX_NAME_LENGTH} placeholder="Your name" value={value}
            onChange={(event) => setValue(event.target.value)} aria-label="Your name" />
          <button className="button primary" disabled={!name}>Enter</button>
        </form>
      </main>
    </div>
  );
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
  const [cycle, setCycle] = useState(0); // the room cycle, for the transition labels
  const connection = useRef<Connection | null>(null);
  const player = useRef<Player | null>(null);

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

  const { song } = state;
  return (
    <div className="room">
      <header className="topbar">
        <a className="logo small" href="/">music<span>·</span>chat</a>
        <span className="room-id" title="Room name">{roomId}</span>
        <CopyLink />
        <span className={`status status-${state.status}`}>{state.status === 'open' ? 'live' : state.status}</span>
        <ul className="users" aria-label="Listeners">
          {state.users.map((user) => (
            <li key={user.id} className={user.id === state.you?.id ? 'me' : ''}>{user.name}</li>
          ))}
        </ul>
      </header>

      <div className="room-grid">
        <section className="stage">
          <div className="transport">
            <button className={`button play ${playing ? 'on' : ''}`} onClick={togglePlay} disabled={starting}
              aria-label={playing ? 'Stop' : 'Play'}>
              {starting ? '…' : playing ? '■ Stop' : '▶ Play'}
            </button>
            <label className="volume">
              <span>Volume</span>
              <input type="range" min={0} max={1} step={0.01} value={volume}
                onChange={(event) => { const v = Number(event.target.value); setVolume(v); player.current?.setVolume(v); }} />
            </label>
            <div className="song-meta">
              <span>{song.bpm} bpm</span>
              <span>{song.root} {song.scale.replace(':', ' ')}</span>
              <span>v{song.version}</span>
            </div>
          </div>
          <AgentLine state={state} />
          {!playing && song.layers.length > 0 && <p className="hint">Press play to hear the room.</p>}

          {song.layers.length === 0 ? (
            <div className="empty">
              <p>The room is silent. Ask the band for something:</p>
              <div className="suggestions">
                {SUGGESTIONS.map((text) => (
                  <button key={text} className="chip" onClick={() => send(text)}>{text}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="layers">
              {song.layers.map((layer) => (
                <LayerCard key={layer.id} layer={layer} error={errors[layer.id]} muted={mutes.has(layer.id)}
                  label={changeLabel(state.changes[layer.id], cycle)}
                  soloed={solo === layer.id} onMute={() => toggleMute(layer.id)}
                  onSolo={() => setSolo(solo === layer.id ? null : layer.id)} />
              ))}
            </div>
          )}

          {song.layers.length > 0 && (
            <details className="code-view">
              <summary>Strudel code</summary>
              <pre>{toStrudelCode(song)}</pre>
              <a className="button" href={strudelUrl(song)} target="_blank" rel="noopener noreferrer">Open in strudel.cc</a>
            </details>
          )}

          <History state={state} onReact={(version, reaction) => connection.current?.react(version, reaction)} />
        </section>

        <aside className="chat">
          <ChatLog chat={state.chat} you={state.you?.name} />
          {state.notice && (
            <button className="notice" onClick={() => connection.current?.dismissNotice()}>{state.notice}</button>
          )}
          <ChatForm draft={draft} setDraft={setDraft} onSend={send} disabled={state.status !== 'open'} />
        </aside>
      </div>
      <Footer />
    </div>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowLink(true); // no clipboard on plain http (for example a LAN address)
    }
  };
  return (
    <>
      <button className="button small" onClick={copy}>{copied ? 'Copied' : 'Invite'}</button>
      {showLink && <input className="input link" readOnly value={location.href} onFocus={(event) => event.target.select()} autoFocus />}
    </>
  );
}

function AgentLine({ state }: { state: RoomState }) {
  const { status, queue } = state.agent;
  if (status === 'idle') return <p className="agent idle">The band is playing.</p>;
  const text = status === 'waiting' ? 'The band is listening…' : 'The band is working on it…';
  return <p className={`agent ${status}`}><span className="dot" />{text}{queue > 0 && status === 'thinking' ? ` (${queue} more waiting)` : ''}</p>;
}

// "fade in 3 bars" before a staged change, "fading" during it, nothing after it.
function changeLabel(change: LayerChange | undefined, cycle: number): string | null {
  if (!change) return null;
  const name = { cut: 'cut', fade: 'fade', filter: 'filter sweep' }[change.style];
  if (cycle < change.at) {
    const bars = Math.ceil(change.at - cycle);
    return `${name} in ${bars} bar${bars === 1 ? '' : 's'}`;
  }
  if (change.bars > 0 && cycle < change.at + change.bars) {
    return `${change.style === 'filter' ? 'filtering' : 'fading'}, ${Math.ceil(change.at + change.bars - cycle)} bars left`;
  }
  return null;
}

type CardProps = {
  layer: Layer; error?: string; label: string | null; muted: boolean; soloed: boolean; onMute: () => void; onSolo: () => void;
};

function LayerCard({ layer, error, label, muted, soloed, onMute, onSolo }: CardProps) {
  return (
    <article className={`layer role-${layer.role} ${muted || layer.muted ? 'is-muted' : ''} ${soloed ? 'is-solo' : ''}`}>
      <header>
        <span className="role">{layer.role}</span>
        <span className="layer-id">{layer.id}</span>
        <span className="by">{layer.author || 'band'} · v{layer.since}</span>
        <span className="layer-buttons">
          <button className={`toggle ${muted ? 'on' : ''}`} aria-pressed={muted} onClick={onMute} title="Mute for me">M</button>
          <button className={`toggle ${soloed ? 'on' : ''}`} aria-pressed={soloed} onClick={onSolo} title="Solo for me">S</button>
        </span>
      </header>
      {layer.muted && <p className="layer-note">Muted by the band</p>}
      {label && <p className="layer-change">{label}</p>}
      <pre className="layer-code">{layer.code}</pre>
      {error && <p className="layer-error">This layer does not play here: {error}</p>}
    </article>
  );
}

function History({ state, onReact }: { state: RoomState; onReact: (version: number, reaction: (typeof REACTIONS)[number]) => void }) {
  const versions = useMemo(() => [...state.versions].reverse(), [state.versions]);
  if (versions.length === 0) return null;
  return (
    <details className="history" open>
      <summary>Versions</summary>
      <ol>
        {versions.map((version) => (
          <li key={version.n}>
            <span className="v">v{version.n}</span>
            <span className="summary">{version.summary || 'change'}</span>
            <span className="by">{version.author}</span>
            <span className="reactions">
              {REACTIONS.map((reaction) => {
                const count = state.reactions[version.n]?.[reaction] ?? 0;
                const mine = state.mine.has(`${version.n}:${reaction}`);
                return (
                  <button key={reaction} className={`reaction ${mine ? 'on' : ''}`} aria-pressed={mine}
                    onClick={() => onReact(version.n, reaction)} title={reaction}>
                    {REACTION_EMOJI[reaction]}{count > 0 ? ` ${count}` : ''}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function ChatLog({ chat, you }: { chat: ChatEntry[]; you?: string }) {
  const end = useRef<HTMLDivElement>(null);
  // A block body: in new browsers scrollIntoView returns a promise, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);
  return (
    <div className="chat-log" aria-live="polite">
      {chat.length === 0 && <p className="chat-empty">No messages yet. Tell the band what you want to hear.</p>}
      {chat.map((entry) => (
        <div key={entry.id} className={`msg ${entry.kind} ${entry.author === you && entry.kind === 'user' ? 'mine' : ''}`}>
          <span className="author">{entry.kind === 'band' ? 'band' : entry.author}</span>
          {entry.kind === 'user' && !entry.toBand && <span className="aside">to the room</span>}
          <span className="text">{entry.text}</span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

type ChatFormProps = { draft: string; setDraft: (text: string) => void; onSend: (text: string, toBand: boolean) => void; disabled: boolean };

function ChatForm({ draft, setDraft, onSend, disabled }: ChatFormProps) {
  const [toBand, setToBand] = useState(true);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend(draft, toBand);
  };
  return (
    <form className="chat-form" onSubmit={submit}>
      <input className="input" value={draft} maxLength={MAX_CHAT_LENGTH} disabled={disabled}
        placeholder={toBand ? 'Ask the band, e.g. "more acid"' : 'Talk to the room'}
        onChange={(event) => setDraft(event.target.value)} aria-label="Message" />
      <label className="to-band" title="Send this message to the band">
        <input type="checkbox" checked={toBand} onChange={(event) => setToBand(event.target.checked)} />
        band
      </label>
      <button className="button primary" disabled={disabled || !draft.trim()}>Send</button>
    </form>
  );
}
