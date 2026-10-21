import type { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { Reveal } from './Reveal';
import styles from './PageHero.module.css';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  trail: { label: string; to?: string }[];
}

export function PageHero({ title, subtitle, trail }: PageHeroProps) {
  return (
    <section className={styles.hero}>
      <div className="container">
        <div className={styles.crumbs}>
          <Breadcrumbs trail={trail} />
        </div>
        <Reveal>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </Reveal>
      </div>
    </section>
  );
}
