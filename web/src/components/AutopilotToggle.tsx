// Autopilot: when nobody chats, the band makes small changes by itself. The switch is shared by the room.
import { AutopilotIcon, Switch } from '../ui/index.ts';
import './AutopilotToggle.css';

export function AutopilotToggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      className="autopilot-toggle"
      checked={on}
      onCheckedChange={onChange}
      disabled={disabled}
      label={<span className="autopilot-toggle__label"><AutopilotIcon size={14} />Autopilot</span>}
      description={on ? 'The band changes the music by itself when nobody chats.' : 'The band changes the music only when someone asks.'}
    />
  );
}
