import type { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import styles from './PageHero.module.css';

interface PageHeroProps {
  title: string;
  subtitle?: ReactNode;
  trail: { label: string; to?: string }[];
}

export function PageHero({ title, subtitle, trail }: PageHeroProps) {
  return (
    <section className={styles.hero}>
      <div className="container">
        <Breadcrumbs trail={trail} />
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </section>
  );
}
