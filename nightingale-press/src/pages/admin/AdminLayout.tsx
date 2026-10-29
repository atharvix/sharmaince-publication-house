import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminTheme, ADMIN_THEMES } from '../../context/AdminThemeContext';
import type { Role } from '../../types/api';
import styles from './AdminLayout.module.css';
import { ArrowLeft } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  roles?: Role[];
}

const LINKS: NavItem[] = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/books', label: 'Books' },
  { to: '/admin/hero', label: 'Home hero' },
  { to: '/admin/authors', label: 'Authors' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/bulk-orders', label: 'Bulk Orders' },
  { to: '/admin/author-applications', label: 'Author Applications' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/users', label: 'Users', roles: ['ADMIN'] },
  { to: '/admin/promotions', label: 'Promotions', roles: ['ADMIN'] },
  { to: '/admin/reports', label: 'Reports', roles: ['ADMIN'] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useAdminTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const visibleLinks = LINKS.filter((link) => !link.roles || (user && link.roles.includes(user.role)));

  return (
    <div className={styles.shell} data-admin-theme={theme}>
      <button
        type="button"
        className={styles.mobileNavToggle}
        onClick={() => setMobileNavOpen((v) => !v)}
        aria-expanded={mobileNavOpen}
        aria-controls="admin-sidebar"
      >
        <span>{mobileNavOpen ? 'Close menu' : 'Menu'}</span>
      </button>

      <nav id="admin-sidebar" className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ''}`.trim()} aria-label="Admin">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            N
          </span>
          <div>
            <p className={styles.brandTitle}>Sharmiance</p>
            <p className={styles.brandSubtitle}>{user?.role === 'ADMIN' ? 'Admin Workspace' : 'Staff Workspace'}</p>
          </div>
        </div>

        <div className={styles.navGroup}>
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className={styles.sidebarFooter}>
          <label className={styles.themeLabel} htmlFor="admin-theme-select">
            Theme
          </label>
          <select
            id="admin-theme-select"
            className={styles.themeSelect}
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
          >
            {ADMIN_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <NavLink to="/" className={styles.footerLink}>
            <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
            Back to site
          </NavLink>

          {user && (
            <div className={styles.account}>
              <p className={styles.accountName}>{user.name}</p>
              <p className={styles.accountRole}>{user.role === 'ADMIN' ? 'Administrator' : 'Staff'}</p>
            </div>
          )}

          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>

      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  );
}
