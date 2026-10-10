// An inline message strip. With `onDismiss`, a close button removes it.
import type { ReactNode } from 'react';
import { IconButton } from './Button.tsx';
import { cx } from './cx.ts';
import { CloseIcon, InfoIcon, WarningIcon } from './icons.tsx';
import './Notice.css';

export type NoticeTone = 'info' | 'warn' | 'danger' | 'band';

export type NoticeProps = {
  tone?: NoticeTone;
  title?: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
};

const ICON: Record<NoticeTone, ReactNode> = {
  info: <InfoIcon />, warn: <WarningIcon />, danger: <WarningIcon />, band: <InfoIcon />,
};

export function Notice({ tone = 'info', title, icon, onDismiss, className, children }: NoticeProps) {
  return (
    <div className={cx('ui-notice', className)} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="ui-notice__icon">{icon ?? ICON[tone]}</span>
      <div className="ui-notice__body">
        {title && <strong className="ui-notice__title">{title}</strong>}
        <div className="ui-notice__text">{children}</div>
      </div>
      {onDismiss && <IconButton className="ui-notice__close" label="Dismiss" icon={<CloseIcon size={14} />} size="sm" onClick={onDismiss} />}
    </div>
  );
}
