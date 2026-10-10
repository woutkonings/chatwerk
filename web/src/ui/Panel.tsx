// A section of the page: a strong rule on top and an optional header (title, meta text and actions). No box.
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import './Panel.css';

export type PanelProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  as?: 'section' | 'aside' | 'div' | 'article';
  title?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode; // small text next to the title
  actions?: ReactNode; // controls on the right of the header
  padding?: 'none' | 'sm' | 'md';
  tone?: 'default' | 'sunken' | 'band';
};

export function Panel({
  as: Tag = 'section', title, icon, meta, actions, padding = 'md', tone = 'default', className, children, ...rest
}: PanelProps) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <Tag className={cx('ui-panel', className)} data-padding={padding} data-tone={tone} {...rest}>
      {hasHeader && (
        <header className="ui-panel__header">
          {title !== undefined && (
            <h2 className="ui-panel__title">
              {icon}
              {title}
            </h2>
          )}
          {meta !== undefined && <span className="ui-panel__meta">{meta}</span>}
          {actions !== undefined && <div className="ui-panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
