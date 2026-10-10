// A section that opens and closes, on a native <details> element.
import { useState, type ReactNode } from 'react';
import { cx } from './cx.ts';
import { ChevronRightIcon } from './icons.tsx';
import './Disclosure.css';

export type DisclosureProps = {
  summary: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode; // small text on the right of the summary
  defaultOpen?: boolean;
  variant?: 'panel' | 'plain';
  className?: string;
  children: ReactNode;
};

export function Disclosure({ summary, icon, meta, defaultOpen = false, variant = 'panel', className, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={cx('ui-disclosure', className)} data-variant={variant} open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="ui-disclosure__summary">
        <ChevronRightIcon className="ui-disclosure__chevron" size={14} />
        {icon}
        <span className="ui-disclosure__title">{summary}</span>
        {meta !== undefined && <span className="ui-disclosure__meta">{meta}</span>}
      </summary>
      <div className="ui-disclosure__body">{children}</div>
    </details>
  );
}
