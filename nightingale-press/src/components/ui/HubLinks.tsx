import { Link } from 'react-router-dom';
import styles from './HubLinks.module.css';

export interface HubLink {
  to: string;
  icon: string;
  title: string;
  description: string;
}

export function HubLinks({ links }: { links: HubLink[] }) {
  return (
    <div className={styles.grid}>
      {links.map((link) => (
        <Link key={link.to} to={link.to} className={styles.card}>
          <div className={styles.icon} aria-hidden="true">
            {link.icon}
          </div>
          <h3 className={styles.title}>{link.title}</h3>
          <p className={styles.description}>{link.description}</p>
          <span className={styles.arrow}>
            Learn more
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
