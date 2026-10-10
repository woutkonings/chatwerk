// The chat: the log, the notice and the composer. A message goes to the band (it can change the music)
// or only to the people in the room. All text renders as React text, never as HTML.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CHAT_LENGTH, type AgentState, type ChatEntry } from '../../../shared/protocol.ts';
import { Button, Input, Notice, SegmentedControl, SendIcon, Spinner, cx } from '../ui/index.ts';
import { formatClock } from './format.ts';
import './ChatPanel.css';

export type ChatPanelProps = {
  chat: ChatEntry[];
  you?: string;
  agent: AgentState;
  notice: string | null;
  onDismissNotice: () => void;
  draft: string;
  setDraft: (text: string) => void;
  onSend: (text: string, toBand: boolean) => void;
  disabled: boolean;
  active?: boolean; // false while the chat is hidden (the stage tab on a phone)
  id?: string;
  className?: string;
};

export function ChatPanel({ chat, you, agent, notice, onDismissNotice, draft, setDraft, onSend, disabled, active = true, id, className }: ChatPanelProps) {
  return (
    <aside id={id} className={cx('chat-panel', className)} aria-label="Chat">
      <header className="chat-panel__head">
        <h2 className="chat-panel__title">Chat</h2>
        <span className="chat-panel__meta">{chat.length > 0 ? `${chat.length} messages` : 'quiet'}</span>
      </header>
      <ChatLog chat={chat} you={you} agent={agent} active={active} />
      {notice && (
        <div className="chat-panel__notice">
          <Notice tone="warn" onDismiss={onDismissNotice}>{notice}</Notice>
        </div>
      )}
      <Composer draft={draft} setDraft={setDraft} onSend={onSend} disabled={disabled} />
    </aside>
  );
}

export function ChatLog({ chat, you, agent, active = true }: { chat: ChatEntry[]; you?: string; agent: AgentState; active?: boolean }) {
  const log = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  // Keep the newest message in view, unless the user scrolled up to read. A block body: an effect must not return a value.
  useEffect(() => {
    const element = log.current;
    if (element && active && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [chat.length, agent.status, active]);

  return (
    <div ref={log} className="chat-log" aria-live="polite" aria-relevant="additions" tabIndex={0} aria-label="Messages"
      onScroll={(event) => {
        const element = event.currentTarget;
        atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      }}>
      {chat.length === 0 && <p className="chat-log__empty">No messages yet. Tell the band what you want to hear.</p>}
      {chat.map((entry) => <ChatMessage key={entry.id} entry={entry} mine={entry.kind === 'user' && entry.author === you} />)}
      {agent.status !== 'idle' && (
        <div className="chat-msg chat-msg--pending" data-kind="band">
          <div className="chat-msg__meta">
            <span className="chat-msg__author">The band</span>
          </div>
          <p className="chat-msg__text"><Spinner size={10} /> {agent.status === 'waiting' ? 'listening' : 'working on it'}</p>
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ entry, mine }: { entry: ChatEntry; mine: boolean }) {
  if (entry.kind === 'system') {
    return <p className="chat-msg chat-msg--system" data-kind="system"><span>{entry.text}</span></p>;
  }
  const band = entry.kind === 'band';
  return (
    <div className={cx('chat-msg', mine && 'is-mine')} data-kind={entry.kind}>
      <div className="chat-msg__meta">
        <span className="chat-msg__author">
          {band ? 'The band' : entry.author}
          {mine && <span className="chat-msg__you">(you)</span>}
        </span>
        {entry.kind === 'user' && !entry.toBand && <span className="chat-msg__aside">to the room</span>}
        <time className="chat-msg__time" dateTime={new Date(entry.at).toISOString()}>{formatClock(entry.at)}</time>
      </div>
      <p className="chat-msg__text">{entry.text}</p>
    </div>
  );
}

type ComposerProps = { draft: string; setDraft: (text: string) => void; onSend: (text: string, toBand: boolean) => void; disabled: boolean };

export function Composer({ draft, setDraft, onSend, disabled }: ComposerProps) {
  const [toBand, setToBand] = useState(true);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend(draft, toBand);
  };
  const left = MAX_CHAT_LENGTH - draft.length;
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__row">
        <Input className="composer__input" value={draft} maxLength={MAX_CHAT_LENGTH} disabled={disabled}
          placeholder={toBand ? 'Ask the band, e.g. "more acid"' : 'Talk to the room'}
          onChange={(event) => setDraft(event.target.value)} aria-label="Message" enterKeyHint="send" />
        <Button type="submit" variant={toBand ? 'primary' : 'secondary'} icon={<SendIcon size={14} />} disabled={disabled || !draft.trim()}>
          Send
        </Button>
      </div>
      <div className="composer__options">
        <SegmentedControl size="sm" label="Send to" value={toBand ? 'band' : 'room'} onChange={(value) => setToBand(value === 'band')}
          options={[
            { value: 'band', label: 'To the band', title: 'The band reads this and can change the music' },
            { value: 'room', label: 'To the room', title: 'Only the people in the room see this' },
          ]} />
        {left < 100 && <span className="composer__count" aria-live="polite">{left}</span>}
      </div>
    </form>
  );
}
