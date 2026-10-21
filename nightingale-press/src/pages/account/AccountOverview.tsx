import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ApiOrder, ApiWishlistItem } from '../../types/api';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';

export default function AccountOverview() {
  const { data, loading, error, reload } = useFetch(
    () =>
      Promise.all([
        api.get<{ items: ApiOrder[] }>('/me/orders'),
        api.get<{ items: ApiWishlistItem[] }>('/me/wishlist'),
      ]),
    [],
  );

  if (loading) return <LoadingBlock label="Loading your account…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load your account.'} onRetry={reload} />;

  const [orders, wishlist] = data;
  const recentOrders = orders.items.slice(0, 3);

  return (
    <div>
      <h2 className={styles.panelTitle}>Overview</h2>
      <div style={{ display: 'grid', gap: 'var(--space-5)', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 'var(--space-7)' }}>
        <div className={styles.card}>
          <p style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-display)' }}>{orders.items.length}</p>
          <p style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>Total orders</p>
        </div>
        <div className={styles.card}>
          <p style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-display)' }}>{wishlist.items.length}</p>
          <p style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>Saved books</p>
        </div>
      </div>

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Recent orders</h3>
      {recentOrders.length === 0 ? (
        <p style={{ color: 'var(--color-ink-500)' }}>
          No orders yet. <Link to="/books" style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>Browse the catalogue</Link>.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              to={`/account/orders/${order.id}`}
              className={styles.card}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>
                <strong>{order.orderNumber}</strong>
                <br />
                <span style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
                  {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </span>
              <span style={{ fontWeight: 600 }}>₹{(order.totalMinor / 100).toLocaleString('en-IN')}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
