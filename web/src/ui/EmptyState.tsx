// What a section shows when it has no content yet: an icon, a title, a short text and optional actions.
import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import './EmptyState.css';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
};

export function EmptyState({ icon, title, children, actions, size = 'md', className }: EmptyStateProps) {
  return (
    <div className={cx('ui-empty', className)} data-size={size}>
      {icon && <span className="ui-empty__icon" aria-hidden="true">{icon}</span>}
      <p className="ui-empty__title">{title}</p>
      {children && <div className="ui-empty__text">{children}</div>}
      {actions && <div className="ui-empty__actions">{actions}</div>}
    </div>
  );
}
