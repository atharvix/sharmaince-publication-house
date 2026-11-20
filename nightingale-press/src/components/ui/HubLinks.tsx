import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import styles from './HubLinks.module.css';

export interface HubLink {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/** A ruled index of related pages, like the contents page of a handbook. */
export function HubLinks({ links }: { links: HubLink[] }) {
  return (
    <ul className={styles.list}>
      {links.map(({ to, icon: Icon, title, description }) => (
        <li key={to}>
          <Link to={to} className={styles.row}>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{title}</span>
              <span className={styles.description}>{description}</span>
            </span>
            <ArrowRight className={styles.arrow} size={20} strokeWidth={2} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
