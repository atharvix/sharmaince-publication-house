import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';
import { formatRupees, humanizeEnum } from '../../lib/format';

interface StatusRow {
  status: string;
  orders: number;
  grossSales: number;
  discounts: number;
}

interface BestSeller {
  title: string;
  unitsSold: number;
  revenue: number;
}

interface SalesReport {
  byStatus: StatusRow[];
  bestSellers: BestSeller[];
}

export default function AdminReports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, loading, error, reload } = useFetch(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(to).toISOString());
    return api.get<SalesReport>(`/admin/reports/sales?${params.toString()}`);
  }, [from, to]);

  return (
    <div>
      <h1 className={styles.pageTitle}>Reports</h1>
      <div className={styles.toolbar}>
        <label style={{ fontSize: 'var(--fs-sm)' }}>
          From{' '}
          <input type="date" className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 'var(--fs-sm)' }}>
          To <input type="date" className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {loading && <LoadingBlock label="Loading report…" />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (
        <>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Orders by status</h2>
          <div className={styles.tableWrap} style={{ marginBottom: 'var(--space-7)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Gross sales</th>
                  <th>Discounts</th>
                </tr>
              </thead>
              <tbody>
                {data.byStatus.map((row) => (
                  <tr key={row.status}>
                    <td>{humanizeEnum(row.status)}</td>
                    <td>{row.orders}</td>
                    <td>{formatRupees(row.grossSales)}</td>
                    <td>{formatRupees(row.discounts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginBottom: 'var(--space-4)' }}>Best-selling titles</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Units sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.bestSellers.map((row) => (
                  <tr key={row.title}>
                    <td>{row.title}</td>
                    <td>{row.unitsSold}</td>
                    <td>{formatRupees(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
