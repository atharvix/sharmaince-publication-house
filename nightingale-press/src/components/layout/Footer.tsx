import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div className={styles.brandCol}>
          <Link to="/" className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              N
            </span>
            Nightingale Academic Press
          </Link>
          <p className={styles.tagline}>
            Publishing nursing, medical and allied-health textbooks trusted by students, faculty
            and institutions.
          </p>
        </div>

        <nav aria-label="Explore">
          <p className={styles.heading}>Explore</p>
          <ul className={styles.list}>
            <li>
              <Link className={styles.link} to="/books">
                Browse Books
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/authors">
                Our Authors
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/bulk-orders">
                Bulk Orders
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/about">
                About Us
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Support">
          <p className={styles.heading}>Support</p>
          <ul className={styles.list}>
            <li>
              <Link className={styles.link} to="/faqs">
                FAQs
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/shipping">
                Shipping
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/returns">
                Returns
              </Link>
            </li>
            <li>
              <Link className={styles.link} to="/contact">
                Contact Us
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className={styles.heading}>Stay in the loop</p>
          <p className={styles.tagline}>
            Want new editions or curriculum updates for your institution? <Link to="/contact">Get in touch</Link>.
          </p>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <span>&copy; {CURRENT_YEAR} Nightingale Academic Press. All rights reserved.</span>
        <div className={styles.bottomLinks}>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
