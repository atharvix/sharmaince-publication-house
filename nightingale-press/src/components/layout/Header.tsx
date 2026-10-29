import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/books', label: 'Books' },
  { to: '/authors', label: 'Authors' },
  { to: '/bulk-orders', label: 'Bulk orders' },
  { to: '/about', label: 'About' },
  { to: '/support', label: 'Help' },
];

export function Header() {
  const { itemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    setMenuOpen(false);
    navigate(q ? `/books?q=${encodeURIComponent(q)}` : '/books');
  }

  const accountPath = user ? (user.role === 'CUSTOMER' ? '/account' : '/admin') : '/login';
  const accountLabel = user ? (user.role === 'CUSTOMER' ? 'Account' : 'Workspace') : 'Log in';
  const linkClass = ({ isActive }: { isActive: boolean }) => `${styles.navLink} ${isActive ? styles.active : ''}`.trim();
  const currentQuery = new URLSearchParams(location.search).get('q') ?? '';

  return (
    <header className={styles.header}>
      <div className={`container ${styles.top}`}>
        <NavLink to="/" className={styles.brand} aria-label="Sharmiance Publication House, home">
          Sharmiance <span className={styles.brandSub}>Publication House</span>
        </NavLink>

        <form className={styles.search} role="search" onSubmit={handleSearch}>
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <input name="q" type="search" placeholder="Search by title, author or ISBN" aria-label="Search books" key={location.search} defaultValue={currentQuery} />
        </form>

        <div className={styles.actions}>
          <NavLink to={accountPath} className={styles.action}>
            <User size={20} strokeWidth={1.9} aria-hidden="true" />
            <span className={styles.actionLabel}>{accountLabel}</span>
          </NavLink>
          <NavLink to="/cart" className={`${styles.action} ${styles.cart}`} aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <span className={styles.bag}>
              <ShoppingBag size={20} strokeWidth={1.9} aria-hidden="true" />
              {itemCount > 0 && (
                <span className={`${styles.count} tabular`} aria-hidden="true">
                  {itemCount}
                </span>
              )}
            </span>
            <span className={styles.actionLabel} aria-hidden="true">
              Cart
            </span>
          </NavLink>
          <button
            type="button"
            className={styles.menuToggle}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} strokeWidth={2} aria-hidden="true" /> : <Menu size={22} strokeWidth={2} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav className={styles.navBar} aria-label="Primary">
        <div className={`container ${styles.navInner}`}>
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/contact" className={`${styles.navLink} ${styles.navEnd}`}>
            Contact
          </NavLink>
        </div>
      </nav>

      <div id="mobile-menu" className={styles.mobilePanel} hidden={!menuOpen}>
        <form className={`${styles.search} ${styles.mobileSearch}`} role="search" onSubmit={handleSearch}>
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <input name="q" type="search" placeholder="Search by title, author or ISBN" aria-label="Search books" />
        </form>
        {[...NAV_LINKS, { to: '/contact', label: 'Contact' }, { to: accountPath, label: accountLabel }].map((link) => (
          <NavLink key={link.to + link.label} to={link.to} className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
