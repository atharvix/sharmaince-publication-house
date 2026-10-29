import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import styles from './AuthLayout.module.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('This reset link is missing its token. Please request a new one.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: form.get('password') });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password">
      {!token ? (
        <p className={styles.errorBanner}>
          This reset link is invalid or incomplete. <Link to="/forgot-password">Request a new one</Link>.
        </p>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <InputField
            id="reset-password"
            name="password"
            type="password"
            label="New password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            hint="Include an uppercase letter, a lowercase letter and a number."
          />
          {error && <p className={styles.errorBanner} role="alert">{error}</p>}
          <Button type="submit" size="lg" variant="primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
