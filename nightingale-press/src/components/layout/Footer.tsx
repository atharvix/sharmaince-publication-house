import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import { SITE_NAME, SITE_TAGLINE } from '../../lib/site';

const CURRENT_YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    title: 'Books',
    links: [
      { to: '/books', label: 'Browse the catalogue' },
      { to: '/authors', label: 'Our authors' },
      { to: '/authors#submit-manuscript', label: 'Submit a proposal' },
    ],
  },
  {
    title: 'Ordering',
    links: [
      { to: '/bulk-orders', label: 'Bulk orders for colleges' },
      { to: '/shipping', label: 'Shipping' },
      { to: '/returns', label: 'Returns' },
    ],
  },
  {
    title: 'Help',
    links: [
      { to: '/faqs', label: 'FAQs' },
      { to: '/contact', label: 'Contact us' },
      { to: '/about', label: 'About the press' },
    ],
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div className={styles.brandCol}>
          <Link to="/" className={styles.brand}>
            Sharmiance
            <br />
            <span>Publication House &amp; Distribution</span>
          </Link>
          <p className={styles.tagline}>{SITE_TAGLINE}</p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className={styles.heading}>{column.title}</p>
            <ul className={styles.list}>
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link className={styles.link} to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={`container ${styles.bottom}`}>
        <span>&copy; {CURRENT_YEAR} {SITE_NAME}</span>
        <div className={styles.bottomLinks}>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
