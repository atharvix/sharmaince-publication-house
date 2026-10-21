import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { InputField, SelectField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

interface Promotion {
  id: string;
  code: string;
  description: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  isActive: boolean;
  redeemedCount: number;
  maxRedemptions: number | null;
}

export default function AdminPromotions() {
  const { data: promotions, loading, error, reload } = useFetch(() => api.get<{ items: Promotion[] }>('/admin/promotions').then((r) => r.items), []);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/admin/promotions', {
        code: String(form.get('code')),
        description: String(form.get('description')),
        discountType: String(form.get('discountType')),
        discountValue: Number(form.get('discountValue')),
        isActive: true,
      });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create this promotion.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await api.patch(`/admin/promotions/${id}`, { isActive });
    reload();
  }

  if (loading) return <LoadingBlock label="Loading promotions…" />;
  if (error || !promotions) return <ErrorBlock message={error ?? 'Could not load promotions.'} onRetry={reload} />;

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          Promotions
        </h1>
        <Button size="sm" variant={showForm ? 'ghost' : 'primary'} type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add promotion'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.card}>
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr' }}>
            <InputField id="p-code" name="code" label="Code" required placeholder="WELCOME10" />
            <InputField id="p-description" name="description" label="Description" required placeholder="10% off first order" />
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr', marginTop: 'var(--space-4)' }}>
            <SelectField id="p-type" name="discountType" label="Discount type" required defaultValue="PERCENT">
              <option value="PERCENT">Percent off</option>
              <option value="FLAT">Flat amount off (₹)</option>
            </SelectField>
            <InputField id="p-value" name="discountValue" type="number" label="Value" required placeholder="10" />
          </div>
          {formError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-3)' }}>{formError}</p>}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <Button type="submit" size="md" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create promotion'}
            </Button>
          </div>
        </form>
      )}

      {promotions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No promotions yet. Create your first discount code to get started.</p>
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Discount</th>
              <th>Redeemed</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((promo) => (
              <tr key={promo.id}>
                <td>
                  <strong>{promo.code}</strong>
                </td>
                <td>{promo.description}</td>
                <td>{promo.discountType === 'PERCENT' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}</td>
                <td>
                  {promo.redeemedCount}
                  {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ''}
                </td>
                <td>
                  <span className={styles.badge} style={{ background: promo.isActive ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: promo.isActive ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <Button size="sm" variant="ghost" type="button" onClick={() => handleToggle(promo.id, !promo.isActive)}>
                    {promo.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
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
