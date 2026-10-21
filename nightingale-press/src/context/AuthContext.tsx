import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAccessToken, setAuthHooks } from '../lib/api';
import type { ApiUser } from '../types/api';

interface AuthContextValue {
  user: ApiUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  register: (name: string, email: string, password: string) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setAuthHooks({
      onRefreshed: (nextUser) => setUser(nextUser),
      onRefreshFailed: () => setUser(null),
    });
  }, []);

  useEffect(() => {
    // Silently try to restore a session from the refresh cookie on first load.
    api
      .post<{ user: ApiUser; accessToken: string }>('/auth/refresh')
      .then((res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => setUser(null))
      .finally(() => setInitializing(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ user: ApiUser; accessToken: string }>('/auth/login', { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.post<{ user: ApiUser; accessToken: string }>('/auth/register', { name, email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  async function refreshUser() {
    const res = await api.get<{ user: ApiUser }>('/auth/me');
    setUser(res.user);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
