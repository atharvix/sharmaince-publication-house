import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ApiOrder } from '../../types/api';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

interface DashboardData {
  recentOrders: (ApiOrder & { user: { name: string; email: string } })[];
  newUsersCount: number | null;
  pendingAuthorApplications: number;
  pendingBulkOrders: number;
  totalRevenue: number | null;
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(() => api.get<DashboardData>('/admin/reports/dashboard'), []);

  if (loading) return <LoadingBlock label="Loading dashboard…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load the dashboard.'} onRetry={reload} />;

  return (
    <div>
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <div className={styles.statCards}>
        {data.totalRevenue !== null && (
          <div className={styles.card}>
            <p className={styles.statValue}>₹{data.totalRevenue.toLocaleString('en-IN')}</p>
            <p className={styles.statLabel}>Total revenue (paid+)</p>
          </div>
        )}
        {data.newUsersCount !== null && (
          <div className={styles.card}>
            <p className={styles.statValue}>{data.newUsersCount}</p>
            <p className={styles.statLabel}>New users (7 days)</p>
          </div>
        )}
        <div className={styles.card}>
          <p className={styles.statValue}>{data.pendingAuthorApplications}</p>
          <p className={styles.statLabel}>Pending author applications</p>
        </div>
        <div className={styles.card}>
          <p className={styles.statValue}>{data.pendingBulkOrders}</p>
          <p className={styles.statLabel}>Open bulk order requests</p>
        </div>
      </div>

      <h2 style={{ marginBottom: 'var(--space-4)' }}>Recent orders</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link to={`/admin/orders?focus=${order.id}`} style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>
                    {order.orderNumber}
                  </Link>
                </td>
                <td>{order.user.email}</td>
                <td>{order.status}</td>
                <td>₹{(order.totalMinor / 100).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
