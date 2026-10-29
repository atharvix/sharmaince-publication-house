import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import type { ApiAddress } from '../../types/api';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';

export default function AccountAddresses() {
  const { data: addresses, loading, error, reload } = useFetch(
    () => api.get<{ items: ApiAddress[] }>('/me/addresses').then((r) => r.items),
    [],
  );
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/me/addresses', {
        label: form.get('label'),
        fullName: form.get('fullName'),
        phone: form.get('phone'),
        line1: form.get('line1'),
        line2: form.get('line2') || undefined,
        city: form.get('city'),
        state: form.get('state'),
        postalCode: form.get('postalCode'),
        country: form.get('country') || 'India',
        isDefaultShipping: form.get('isDefaultShipping') === 'on',
      });
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this address.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/me/addresses/${id}`);
    reload();
  }

  async function handleMakeDefault(id: string) {
    await api.patch(`/me/addresses/${id}`, { isDefaultShipping: true });
    reload();
  }

  if (loading) return <LoadingBlock label="Loading addresses…" />;
  if (error || !addresses) return <ErrorBlock message={error ?? 'Could not load addresses.'} onRetry={reload} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h2 className={styles.panelTitle} style={{ marginBottom: 0 }}>
          Addresses
        </h2>
        <Button size="sm" variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? 'Cancel' : 'Add address'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.card} style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="form-grid form-grid--2">
            <InputField id="addr-label" name="label" label="Label" required placeholder="Home, Hostel, Office…" />
            <InputField id="addr-fullname" name="fullName" label="Full name" required />
          </div>
          <div className="form-grid form-grid--2">
            <InputField id="addr-phone" name="phone" type="tel" label="Phone" required />
            <InputField id="addr-country" name="country" label="Country" defaultValue="India" />
          </div>
          <InputField id="addr-line1" name="line1" label="Address line 1" required />
          <InputField id="addr-line2" name="line2" label="Address line 2 (optional)" />
          <div className="form-grid form-grid--3">
            <InputField id="addr-city" name="city" label="City" required />
            <InputField id="addr-state" name="state" label="State" required />
            <InputField id="addr-postal" name="postalCode" label="PIN code" required />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)' }}>
            <input type="checkbox" name="isDefaultShipping" />
            Set as default shipping address
          </label>
          {formError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{formError}</p>}
          <Button type="submit" size="md" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save address'}
          </Button>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <p style={{ color: 'var(--color-ink-500)' }}>You haven&rsquo;t saved any addresses yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {addresses.map((address) => (
            <div key={address.id} className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{address.label}</strong>
                {address.isDefaultShipping && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-primary-700)', fontWeight: 600 }}>Default shipping</span>
                )}
              </div>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-ink-700)', fontSize: 'var(--fs-sm)' }}>
                {address.fullName} · {address.phone}
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                {!address.isDefaultShipping && (
                  <Button size="sm" variant="ghost" type="button" onClick={() => handleMakeDefault(address.id)}>
                    Make default
                  </Button>
                )}
                <Button size="sm" variant="ghost" type="button" onClick={() => handleDelete(address.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
