import type { ReactNode } from 'react';
import { PageHero } from '../ui/PageHero';
import styles from './PolicyLayout.module.css';

export interface PolicySection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface PolicyLayoutProps {
  title: string;
  trail: { label: string; to?: string }[];
  updated: string;
  intro?: ReactNode;
  sections: PolicySection[];
}

export function PolicyLayout({ title, trail, updated, intro, sections }: PolicyLayoutProps) {
  return (
    <>
      <PageHero title={title} trail={trail} />
      <div className="container">
        <div className={styles.layout}>
          <aside className={styles.toc} aria-label="On this page">
            <p className={styles.tocLabel}>On this page</p>
            <nav className={styles.tocList}>
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className={styles.tocLink}>
                  {section.heading}
                </a>
              ))}
            </nav>
          </aside>
          <div>
            <p className={styles.updated}>Last updated: {updated}</p>
            {intro && <div className={styles.intro}>{intro}</div>}
            {sections.map((section) => (
              <section key={section.id} id={section.id} className={styles.section}>
                <h2 className={styles.sectionTitle}>{section.heading}</h2>
                {section.body}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
