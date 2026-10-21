import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { SuccessPanel } from '../../components/ui/SuccessPanel';
import { AuthLayout } from './AuthLayout';
import styles from './AuthLayout.module.css';

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: form.get('email') });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout eyebrow="Password reset" title="Forgot your password?" subtitle="We'll email you a link to reset it.">
      {submitted ? (
        <SuccessPanel
          title="Check your inbox"
          body="If that email is registered, a reset link is on its way. It expires in 1 hour."
        />
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <InputField id="forgot-email" name="email" type="email" label="Email address" required placeholder="you@example.com" />
          {error && <p className={styles.errorBanner} role="alert">{error}</p>}
          <Button type="submit" size="lg" variant="primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>
      )}
      <p className={styles.footerNote}>
        <Link to="/login">Back to login</Link>
      </p>
    </AuthLayout>
  );
}
