// "What the band hears": the energy of the newest version and short findings about the mix.
// BandPanel groups it with the agent status and the autopilot switch.
import { useId } from 'react';
import type { AgentState, MixReport as Report } from '../../../shared/protocol.ts';
import { EmptyState, Panel } from '../ui/index.ts';
import { AgentStatus } from './AgentStatus.tsx';
import { AutopilotToggle } from './AutopilotToggle.tsx';
import { EnergyMeter } from './EnergyMeter.tsx';
import './MixReport.css';

export type MixReportProps = { report: Report | null; target: number | null; hasSong: boolean };

export function MixReport({ report, target, hasSong }: MixReportProps) {
  const titleId = useId();
  return (
    <section className="mix-report" aria-labelledby={titleId}>
      <h3 id={titleId} className="mix-report__title t-label">What the band hears</h3>
      {!hasSong ? (
        <EmptyState size="sm" title="Nothing to hear yet">The band reports on the mix after the first song.</EmptyState>
      ) : (
        <>
          <EnergyMeter energy={report?.energy ?? null} target={target} />
          {report && report.lines.length > 0 ? (
            <ul role="list" className="mix-report__lines">
              {report.lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          ) : (
            <p className="mix-report__none">{report ? 'The band has no notes on this version.' : 'No report for this version yet.'}</p>
          )}
        </>
      )}
    </section>
  );
}

export type BandPanelProps = MixReportProps & {
  agent: AgentState;
  autopilot: boolean;
  onAutopilot: (on: boolean) => void;
  connected: boolean;
};

export function BandPanel({ agent, autopilot, onAutopilot, connected, ...report }: BandPanelProps) {
  return (
    <Panel className="band-panel" tone="band" title="The band">
      <div className="band-panel__status">
        <AgentStatus agent={agent} />
        <AutopilotToggle on={autopilot} onChange={onAutopilot} disabled={!connected} />
      </div>
      <MixReport {...report} />
    </Panel>
  );
}
