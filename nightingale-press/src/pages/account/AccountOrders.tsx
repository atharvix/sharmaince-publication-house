import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ApiOrder, ApiOrderStatus } from '../../types/api';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';

const STATUS_LABEL: Record<ApiOrderStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const STATUS_COLOR: Record<ApiOrderStatus, string> = {
  PENDING_PAYMENT: 'var(--color-accent-700)',
  PAID: 'var(--color-primary-700)',
  PROCESSING: 'var(--color-primary-700)',
  SHIPPED: 'var(--color-primary-700)',
  DELIVERED: 'var(--color-success)',
  CANCELLED: 'var(--color-error)',
  REFUNDED: 'var(--color-error)',
};

export default function AccountOrders() {
  const { data: orders, loading, error, reload } = useFetch(() => api.get<{ items: ApiOrder[] }>('/me/orders').then((r) => r.items), []);

  if (loading) return <LoadingBlock label="Loading orders…" />;
  if (error || !orders) return <ErrorBlock message={error ?? 'Could not load your orders.'} onRetry={reload} />;

  return (
    <div>
      <h2 className={styles.panelTitle}>Orders</h2>
      {orders.length === 0 ? (
        <p style={{ color: 'var(--color-ink-500)' }}>
          No orders yet. <Link to="/books" style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>Browse the catalogue</Link>.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {orders.map((order) => (
            <Link key={order.id} to={`/account/orders/${order.id}`} className={styles.card} style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{order.orderNumber}</strong>
                <span style={{ fontWeight: 600, color: STATUS_COLOR[order.status] }}>{STATUS_LABEL[order.status]}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
                <span>
                  {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                  {order.items.reduce((n, item) => n + item.quantity, 0)} item(s)
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-ink-900)' }}>₹{(order.totalMinor / 100).toLocaleString('en-IN')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
