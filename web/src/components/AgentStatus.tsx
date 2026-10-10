// What the band does now: playing (idle), listening (messages collect) or working on a turn.
import type { AgentState } from '../../../shared/protocol.ts';
import { Led, Spinner } from '../ui/index.ts';
import './AgentStatus.css';

export function agentText({ status, queue }: AgentState): string {
  if (status === 'idle') return 'The band is playing.';
  if (status === 'waiting') return 'The band is listening…';
  return `The band is working on it…${queue > 0 ? ` (${queue} more waiting)` : ''}`;
}

export function AgentStatus({ agent }: { agent: AgentState }) {
  const busy = agent.status !== 'idle';
  return (
    <p className="agent-status" data-status={agent.status} aria-live="polite">
      {agent.status === 'thinking' ? <Spinner size={10} /> : <Led tone={busy ? 'band' : 'off'} pulse={busy} size="sm" />}
      <span>{agentText(agent)}</span>
    </p>
  );
}
