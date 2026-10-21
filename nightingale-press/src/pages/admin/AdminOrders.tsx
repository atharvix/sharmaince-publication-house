import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import type { ApiOrder, ApiOrderStatus } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

const STATUSES: ApiOrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

const NEXT_STATUS: Record<ApiOrderStatus, ApiOrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

interface AdminOrder extends ApiOrder {
  user: { name: string; email: string };
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<ApiOrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { carrier: string; number: string; url: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useFetch(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (q) params.set('q', q);
    params.set('pageSize', '50');
    return api.get<{ items: AdminOrder[] }>(`/admin/orders?${params.toString()}`);
  }, [statusFilter, q]);

  async function handleStatusChange(orderId: string, status: ApiOrderStatus) {
    setBusyId(orderId);
    setActionError(null);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update order status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveTracking(orderId: string) {
    const draft = trackingDraft[orderId];
    if (!draft?.carrier || !draft.number) return;
    setBusyId(orderId);
    setActionError(null);
    try {
      await api.patch(`/admin/orders/${orderId}/tracking`, {
        trackingCarrier: draft.carrier,
        trackingNumber: draft.number,
        trackingUrl: draft.url || undefined,
      });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save tracking details.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading orders…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load orders.'} onRetry={reload} />;

  return (
    <div>
      <h1 className={styles.pageTitle}>Orders</h1>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="Search by order number or customer email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select className={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ApiOrderStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorBlock message={actionError} />
        </div>
      )}

      {data.items.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No orders match these filters.</p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {data.items.map((order) => {
          const nextOptions = NEXT_STATUS[order.status];
          const draft = trackingDraft[order.id] ?? { carrier: order.trackingCarrier ?? '', number: order.trackingNumber ?? '', url: order.trackingUrl ?? '' };
          return (
            <div key={order.id} className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)' }}>{order.user.email}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={styles.badge} style={{ background: 'var(--color-primary-100)', color: 'var(--color-primary-700)' }}>
                    {order.status}
                  </span>
                  <p style={{ fontWeight: 700, marginTop: 'var(--space-2)' }}>₹{(order.totalMinor / 100).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {nextOptions.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {nextOptions.map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => handleStatusChange(order.id, next)}
                    >
                      Mark {next.replace('_', ' ').toLowerCase()}
                    </Button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className={styles.input}
                  placeholder="Carrier"
                  value={draft.carrier}
                  onChange={(e) => setTrackingDraft((d) => ({ ...d, [order.id]: { ...draft, carrier: e.target.value } }))}
                  style={{ width: 120 }}
                />
                <input
                  className={styles.input}
                  placeholder="Tracking number"
                  value={draft.number}
                  onChange={(e) => setTrackingDraft((d) => ({ ...d, [order.id]: { ...draft, number: e.target.value } }))}
                  style={{ width: 160 }}
                />
                <input
                  className={styles.input}
                  placeholder="Tracking URL (optional)"
                  value={draft.url}
                  onChange={(e) => setTrackingDraft((d) => ({ ...d, [order.id]: { ...draft, url: e.target.value } }))}
                  style={{ width: 220 }}
                />
                <Button size="sm" variant="ghost" type="button" disabled={busyId === order.id} onClick={() => handleSaveTracking(order.id)}>
                  Save tracking
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
