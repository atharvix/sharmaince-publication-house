import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

type ButtonAsLink = BaseProps & {
  to: string;
  onClick?: () => void;
};

type ButtonAsButton = BaseProps & {
  to?: undefined;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  disabled?: boolean;
  'aria-label'?: string;
};

export function Button(props: ButtonAsLink | ButtonAsButton) {
  const { children, variant = 'primary', size = 'md', className = '' } = props;
  const classes = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`.trim();

  if (props.to) {
    const linkProps = props as ButtonAsLink;
    return (
      <Link to={linkProps.to} className={classes} onClick={linkProps.onClick}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;
  return (
    <button
      type={buttonProps.type ?? 'button'}
      className={classes}
      onClick={buttonProps.onClick}
      disabled={buttonProps.disabled}
      aria-label={buttonProps['aria-label']}
    >
      {children}
    </button>
  );
}
