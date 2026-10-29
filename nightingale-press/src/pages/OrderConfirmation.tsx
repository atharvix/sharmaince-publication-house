import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import type { ApiOrder } from '../types/api';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import { formatMinor } from '../lib/format';

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error, reload } = useFetch(
    () => api.get<{ order: ApiOrder }>(`/me/orders/${id}`).then((r) => r.order),
    [id],
  );

  if (loading) return <LoadingBlock label="Loading your order…" />;
  if (error || !order) return <ErrorBlock message={error ?? 'Order not found.'} onRetry={reload} />;

  return (
    <div className="container" style={{ paddingBlock: 'var(--space-9)', maxWidth: 560, marginInline: 'auto', textAlign: 'center' }}>
      <Reveal>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '999px',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto var(--space-5)',
            fontSize: '1.75rem',
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Order confirmed</h1>
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-ink-500)' }}>
          Thank you — order <strong>{order.orderNumber}</strong> for {formatMinor(order.totalMinor)} has been
          placed. A confirmation email is on its way.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-7)' }}>
          <Button to={`/account/orders/${order.id}`} variant="primary" size="md">
            Track Order
          </Button>
          <Button to="/books" variant="outline" size="md">
            Continue Shopping
          </Button>
        </div>
        <p style={{ marginTop: 'var(--space-6)', fontSize: 'var(--fs-sm)' }}>
          <Link to="/account/orders" style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>
            View all your orders
          </Link>
        </p>
      </Reveal>
    </div>
  );
}
