// The top bar of a room: the logo, the room name with the invite button, the connection status and the listeners.
import { useState } from 'react';
import type { User } from '../../../shared/protocol.ts';
import type { RoomState } from '../connection.ts';
import { Button, CheckIcon, Input, Led, LinkIcon, UserChip, UsersIcon } from '../ui/index.ts';
import { Logo } from './Logo.tsx';
import './TopBar.css';

type TopBarProps = { roomId: string; status: RoomState['status']; users: User[]; youId?: string };

export function TopBar({ roomId, status, users, youId }: TopBarProps) {
  return (
    <header className="topbar">
      <Logo size="sm" href="/" />
      <div className="topbar__room">
        <span className="topbar__slash" aria-hidden="true">/</span>
        <span className="topbar__room-id" title="Room name">{roomId}</span>
        <InviteButton />
      </div>
      <div className="topbar__end">
        <ConnectionStatus status={status} />
        <Presence users={users} youId={youId} />
      </div>
    </header>
  );
}

// Copies the room link. Plain http (for example a LAN address) has no clipboard, so then the link shows in a field.
export function InviteButton() {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowLink(true);
    }
  };
  return (
    <span className="invite">
      <Button size="sm" variant={copied ? 'secondary' : 'ghost'} icon={copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />}
        onClick={copy} aria-live="polite">
        {copied ? 'Copied' : 'Invite'}
      </Button>
      {showLink && (
        <Input className="invite__field" size="sm" mono readOnly value={location.href} aria-label="Room link"
          onFocus={(event) => event.target.select()} autoFocus />
      )}
    </span>
  );
}

const STATUS_LABEL: Record<RoomState['status'], string> = { open: 'Live', connecting: 'Connecting', closed: 'Offline' };

export function ConnectionStatus({ status }: { status: RoomState['status'] }) {
  return (
    <span className="connection" data-status={status} role="status" title={`Connection: ${STATUS_LABEL[status]}`}>
      <Led tone={status === 'open' ? 'accent' : status === 'connecting' ? 'warn' : 'danger'} pulse={status === 'connecting'} size="sm" />
      <span className="connection__label">{STATUS_LABEL[status]}</span>
    </span>
  );
}

// The listeners. On a narrow screen only the avatars show.
export function Presence({ users, youId }: { users: User[]; youId?: string }) {
  return (
    <div className="presence">
      <span className="presence__count" title={`${users.length} listening`}>
        <UsersIcon size={14} />
        <span>{users.length}</span>
        <span className="visually-hidden">listening</span>
      </span>
      <ul role="list" className="presence__list" aria-label="Listeners">
        {users.map((user) => (
          <li key={user.id}><UserChip name={user.name} you={user.id === youId} /></li>
        ))}
      </ul>
    </div>
  );
}
