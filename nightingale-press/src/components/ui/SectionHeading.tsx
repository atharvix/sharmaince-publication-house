import type { ReactNode } from 'react';
import styles from './SectionHeading.module.css';

interface SectionHeadingProps {
  title: ReactNode;
  subtitle?: ReactNode;
  center?: boolean;
}

export function SectionHeading({ title, subtitle, center }: SectionHeadingProps) {
  return (
    <div className={`${styles.wrap} ${center ? styles.center : ''}`.trim()}>
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
