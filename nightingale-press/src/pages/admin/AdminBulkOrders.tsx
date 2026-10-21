import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { useState } from 'react';
import { ErrorBlock, LoadingBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

type BulkOrderStatus = 'SUBMITTED' | 'ASSIGNED' | 'QUOTE_IN_PROGRESS' | 'QUOTE_SENT' | 'ACCEPTED' | 'DECLINED' | 'FULFILLED' | 'CLOSED';

const STATUSES: BulkOrderStatus[] = ['SUBMITTED', 'ASSIGNED', 'QUOTE_IN_PROGRESS', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'FULFILLED', 'CLOSED'];

interface BulkOrderRow {
  id: string;
  organizationName: string;
  organizationType: string;
  contactName: string;
  email: string;
  phone: string;
  deliveryLocation: string;
  titlesOfInterest: string | null;
  notes: string | null;
  status: BulkOrderStatus;
  createdAt: string;
}

export default function AdminBulkOrders() {
  const { data, loading, error, reload } = useFetch(() => api.get<{ items: BulkOrderRow[] }>('/bulk-orders/admin').then((r) => r.items), []);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: BulkOrderStatus) {
    setActionError(null);
    try {
      await api.patch(`/bulk-orders/admin/${id}`, { status });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this request.');
    }
  }

  if (loading) return <LoadingBlock label="Loading bulk order requests…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load bulk order requests.'} onRetry={reload} />;

  return (
    <div>
      <h1 className={styles.pageTitle}>Bulk Order Requests</h1>
      {actionError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorBlock message={actionError} />
        </div>
      )}
      {data.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No bulk order requests yet.</p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {data.map((request) => (
          <div key={request.id} className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <strong>{request.organizationName}</strong> <span style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>({request.organizationType})</span>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)' }}>
                  {request.contactName} · {request.email} · {request.phone}
                </p>
              </div>
              <select className={styles.input} value={request.status} onChange={(e) => handleStatusChange(request.id, e.target.value as BulkOrderStatus)}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-3)' }}>
              <strong>Delivery:</strong> {request.deliveryLocation}
            </p>
            {request.titlesOfInterest && (
              <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
                <strong>Titles:</strong> {request.titlesOfInterest}
              </p>
            )}
            {request.notes && (
              <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)', color: 'var(--color-ink-500)' }}>{request.notes}</p>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
