import type { ReactNode } from 'react';
import { Reveal } from '../../components/ui/Reveal';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className={`container ${styles.wrap}`}>
      <Reveal className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </Reveal>
    </div>
  );
}
