import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AdminTheme = 'forest-brass' | 'midnight-ink' | 'ivory-burgundy';

export const ADMIN_THEMES: { id: AdminTheme; label: string; description: string }[] = [
  { id: 'forest-brass', label: 'Forest & Brass', description: 'The house palette — deep pine green with warm brass accents.' },
  { id: 'midnight-ink', label: 'Midnight Ink', description: 'A dark, ink-on-black workspace for low-light sessions.' },
  { id: 'ivory-burgundy', label: 'Ivory & Burgundy', description: 'Classic literary elegance — warm ivory with deep burgundy.' },
];

const STORAGE_KEY = 'nightingale-admin-theme';
const DEFAULT_THEME: AdminTheme = 'forest-brass';

function isAdminTheme(value: string | null): value is AdminTheme {
  return value === 'forest-brass' || value === 'midnight-ink' || value === 'ivory-burgundy';
}

function readStoredTheme(): AdminTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isAdminTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

interface AdminThemeContextValue {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AdminTheme>(readStoredTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing / storage disabled — theme just won't persist across reloads.
    }
  }, [theme]);

  return <AdminThemeContext.Provider value={{ theme, setTheme: setThemeState }}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return context;
}
