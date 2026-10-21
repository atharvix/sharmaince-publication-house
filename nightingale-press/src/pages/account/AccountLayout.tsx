import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHero } from '../../components/ui/PageHero';
import styles from './AccountLayout.module.css';

const LINKS = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/wishlist', label: 'Wishlist' },
];

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <>
      <PageHero title="Your Account" subtitle={user ? `Signed in as ${user.email}` : undefined} trail={[{ label: 'Account' }]} />
      <div className="container">
        <div className={styles.layout}>
          <nav className={styles.sidebar} aria-label="Account">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()}
              >
                {link.label}
              </NavLink>
            ))}
            <button type="button" className={styles.logoutButton} onClick={handleLogout}>
              Log out
            </button>
          </nav>
          <div className={styles.panel}>
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
