// Buttons: Button (an action), ButtonLink (the same look on a link) and IconButton (an icon with a label).
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';
import { Spinner } from './Spinner.tsx';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconEnd?: ReactNode; block?: boolean };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Common & { loading?: boolean };

export function Button({
  variant = 'secondary', size = 'md', icon, iconEnd, block, loading, className, children, type = 'button', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('ui-button', block && 'ui-button--block', className)}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 14} /> : icon}
      {children !== undefined && <span className="ui-button__label">{children}</span>}
      {iconEnd}
    </button>
  );
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & Common;

export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconEnd, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={cx('ui-button', block && 'ui-button--block', className)} data-variant={variant} data-size={size} {...rest}>
      {icon}
      {children !== undefined && <span className="ui-button__label">{children}</span>}
      {iconEnd}
    </a>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string; // the accessible name, also the tooltip
  icon: ReactNode;
  variant?: Exclude<ButtonVariant, 'danger'>;
  size?: Exclude<ButtonSize, 'lg'>;
};

export function IconButton({ label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx('ui-button', 'ui-button--icon', className)} data-variant={variant} data-size={size}
      aria-label={label} title={label} {...rest}>
      {icon}
    </button>
  );
}
