import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribed(true);
  }

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
          <p className={styles.tagline}>New editions, curriculum updates and author events.</p>
          {subscribed ? (
            <p className={styles.successNote}>You&rsquo;re subscribed — thank you.</p>
          ) : (
            <form className={styles.newsletterForm} onSubmit={handleSubscribe}>
              <label className="visually-hidden" htmlFor="footer-email">
                Email address
              </label>
              <input
                id="footer-email"
                type="email"
                required
                placeholder="you@college.edu"
                className={styles.newsletterInput}
              />
              <button
                type="submit"
                className={styles.link}
                style={{
                  background: 'var(--color-accent-500)',
                  color: 'var(--color-primary-900)',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Join
              </button>
            </form>
          )}
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <span>&copy; {new Date().getFullYear()} Nightingale Academic Press. All rights reserved.</span>
        <div className={styles.bottomLinks}>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
