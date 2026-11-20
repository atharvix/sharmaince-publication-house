import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AccountProfile() {
  const { refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { data: profile, loading, error, reload } = useFetch(() => api.get<{ profile: Profile }>('/me/profile').then((r) => r.profile), []);

  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNameSaving(true);
    setNameMessage(null);
    try {
      await api.patch('/me/profile', { name: form.get('name') });
      await refreshUser();
      reload();
      setNameMessage({ type: 'success', text: 'Saved.' });
    } catch (err) {
      setNameMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Could not save changes.' });
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPasswordSaving(true);
    setPasswordMessage(null);
    try {
      await api.post('/me/change-password', {
        currentPassword: form.get('currentPassword'),
        newPassword: form.get('newPassword'),
      });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Could not update password.' });
      setPasswordSaving(false);
      return;
    }
    // Changing the password signs out every session, this one included.
    await logout();
    navigate('/login', { replace: true, state: { notice: 'Password updated — please sign in with your new password.' } });
  }

  if (loading) return <LoadingBlock label="Loading profile…" />;
  if (error || !profile) return <ErrorBlock message={error ?? 'Could not load your profile.'} onRetry={reload} />;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)' }}>
      <section className={styles.card}>
        <h2 className={styles.panelTitle} style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-5)' }}>
          Profile details
        </h2>
        <form onSubmit={handleNameSubmit} style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: '420px' }}>
          <InputField id="profile-name" name="name" label="Full name" required defaultValue={profile.name} />
          <InputField id="profile-email" label="Email address" value={profile.email} disabled readOnly hint="Contact support to change your email." />
          {nameMessage && (
            <p
              role={nameMessage.type === 'error' ? 'alert' : 'status'}
              style={{ fontSize: 'var(--fs-sm)', color: nameMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              {nameMessage.text}
            </p>
          )}
          <Button type="submit" size="md" variant="primary" disabled={nameSaving}>
            {nameSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.panelTitle} style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-5)' }}>
          Change password
        </h2>
        <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: '420px' }}>
          <InputField id="current-password" name="currentPassword" type="password" label="Current password" required />
          <InputField
            id="new-password"
            name="newPassword"
            type="password"
            label="New password"
            required
            minLength={8}
            hint="Include an uppercase letter, a lowercase letter and a number. You'll be signed out everywhere afterwards."
          />
          {passwordMessage && (
            <p
              role={passwordMessage.type === 'error' ? 'alert' : 'status'}
              style={{ fontSize: 'var(--fs-sm)', color: passwordMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
              {passwordMessage.text}
            </p>
          )}
          <Button type="submit" size="md" variant="outline" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </section>
    </div>
  );
}
