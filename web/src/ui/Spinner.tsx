// A busy indicator: three dots that print in turn. With reduced motion it is static.
import './Spinner.css';

export function Spinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span className="ui-spinner" style={{ height: size, gap: size / 5 }} role={label ? 'status' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <span style={{ width: size / 3, height: size / 3 }} /><span style={{ width: size / 3, height: size / 3 }} /><span style={{ width: size / 3, height: size / 3 }} />
    </span>
  );
}
