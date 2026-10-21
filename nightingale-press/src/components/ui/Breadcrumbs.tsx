import { Link } from 'react-router-dom';
import styles from './Breadcrumbs.module.css';

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.trail}>
      <Link to="/">Home</Link>
      {trail.map((crumb, index) => (
        <span key={crumb.label} style={{ display: 'contents' }}>
          <span aria-hidden="true">/</span>
          {crumb.to && index !== trail.length - 1 ? (
            <Link to={crumb.to}>{crumb.label}</Link>
          ) : (
            <span className={styles.current} aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
