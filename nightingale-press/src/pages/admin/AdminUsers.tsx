import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types/api';
import { ErrorBlock, LoadingBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [q, setQ] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useFetch(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('pageSize', '50');
    return api.get<{ items: AdminUserRow[] }>(`/admin/users?${params.toString()}`);
  }, [q]);

  async function handleRoleChange(id: string, role: Role) {
    setActionError(null);
    try {
      await api.patch(`/admin/users/${id}`, { role });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this user.');
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setActionError(null);
    try {
      await api.patch(`/admin/users/${id}`, { isActive });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this user.');
    }
  }

  if (loading) return <LoadingBlock label="Loading users…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load users.'} onRetry={reload} />;

  return (
    <div>
      <h1 className={styles.pageTitle}>Users</h1>
      <div className={styles.toolbar}>
        <input className={styles.input} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }} />
      </div>

      {actionError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorBlock message={actionError} />
        </div>
      )}

      {data.items.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No users match this search.</p>
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    className={styles.input}
                    value={user.role}
                    disabled={user.id === currentUser?.id}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={styles.badge} style={{ background: user.isActive ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: user.isActive ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {user.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td>
                  {user.id !== currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user.id, !user.isActive)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary-700)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
                    >
                      {user.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
