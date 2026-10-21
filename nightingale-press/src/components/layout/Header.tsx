import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useScrolled } from '../../hooks/useScrolled';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/books', label: 'Books' },
  { to: '/authors', label: 'Authors' },
  { to: '/bulk-orders', label: 'Bulk Orders' },
  { to: '/about', label: 'About' },
  { to: '/support', label: 'Support' },
];

export function Header() {
  const scrolled = useScrolled();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink} ${isActive ? styles.active : ''}`.trim();

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`.trim()}>
      <div className={`container ${styles.bar}`}>
        <NavLink to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
          <span className={styles.mark} aria-hidden="true">
            N
          </span>
          <span className={styles.brandText}>
            Nightingale
            <span className={styles.brandSub}>Academic Press</span>
          </span>
        </NavLink>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <NavLink to="/cart" className={styles.iconButton} aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 7h14l-1.5 9.5a2 2 0 0 1-2 1.7H9a2 2 0 0 1-2-1.7L5.2 4.4A1 1 0 0 0 4.2 3.6H2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="20.5" r="1.2" fill="currentColor" />
              <circle cx="17" cy="20.5" r="1.2" fill="currentColor" />
            </svg>
            {itemCount > 0 && (
              <span key={itemCount} className={styles.cartBadge}>
                {itemCount}
              </span>
            )}
          </NavLink>
          {user ? (
            <NavLink to={user.role === 'CUSTOMER' ? '/account' : '/admin'} className={styles.iconButton} aria-label="Your account">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </NavLink>
          ) : (
            <Button to="/login" size="sm" variant="outline">
              Log In
            </Button>
          )}
          <Button to="/books" size="sm" variant="primary">
            Explore Books
          </Button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuToggle}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`${styles.mobilePanel} ${menuOpen ? styles.open : ''}`.trim()}
        aria-hidden={!menuOpen}
      >
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={styles.mobileLink}
            onClick={() => setMenuOpen(false)}
            tabIndex={menuOpen ? 0 : -1}
          >
            {link.label}
          </NavLink>
        ))}
        <NavLink
          to="/contact"
          className={styles.mobileLink}
          onClick={() => setMenuOpen(false)}
          tabIndex={menuOpen ? 0 : -1}
        >
          Contact
        </NavLink>
        <NavLink
          to={user ? (user.role === 'CUSTOMER' ? '/account' : '/admin') : '/login'}
          className={styles.mobileLink}
          onClick={() => setMenuOpen(false)}
          tabIndex={menuOpen ? 0 : -1}
        >
          {user ? 'Your Account' : 'Log In'}
        </NavLink>
        <div className={styles.mobileCta}>
          <Button to="/books" size="lg" variant="primary" onClick={() => setMenuOpen(false)}>
            Explore Books
          </Button>
        </div>
      </div>
    </header>
  );
}
