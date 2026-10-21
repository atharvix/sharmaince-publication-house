import { useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ApiOrder } from '../../types/api';
import { OrderTimeline } from '../../components/ui/OrderTimeline';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';

export default function AccountOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error, reload } = useFetch(
    () => api.get<{ order: ApiOrder }>(`/me/orders/${id}`).then((r) => r.order),
    [id],
  );

  if (loading) return <LoadingBlock label="Loading order…" />;
  if (error || !order) return <ErrorBlock message={error ?? 'Order not found.'} onRetry={reload} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-6)' }}>
        <h2 className={styles.panelTitle} style={{ marginBottom: 0 }}>
          {order.orderNumber}
        </h2>
        <span style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
          Placed {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <OrderTimeline status={order.status} />
      </div>

      {order.trackingNumber && (
        <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
          <p style={{ fontWeight: 600 }}>Tracking</p>
          <p style={{ color: 'var(--color-ink-700)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
            {order.trackingCarrier} · {order.trackingNumber}
          </p>
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary-700)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
              Track shipment →
            </a>
          )}
        </div>
      )}

      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <p style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Items</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)' }}>
              <span>
                {item.titleSnapshot} <span style={{ color: 'var(--color-ink-500)' }}>× {item.quantity}</span>
              </span>
              <span>₹{(item.lineTotalMinor / 100).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>₹{(order.subtotalMinor / 100).toLocaleString('en-IN')}</span>
          </div>
          {order.discountMinor > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount</span>
              <span>−₹{(order.discountMinor / 100).toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Shipping</span>
            <span>{order.shippingMinor === 0 ? 'Free' : `₹${(order.shippingMinor / 100).toLocaleString('en-IN')}`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-ink-900)', fontSize: 'var(--fs-md)' }}>
            <span>Total</span>
            <span>₹{(order.totalMinor / 100).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Shipping to</p>
        <p style={{ color: 'var(--color-ink-700)', fontSize: 'var(--fs-sm)' }}>
          {order.shippingAddress.fullName} · {order.shippingAddress.phone}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
          {order.shippingAddress.state} {order.shippingAddress.postalCode}
        </p>
      </div>
    </div>
  );
}
