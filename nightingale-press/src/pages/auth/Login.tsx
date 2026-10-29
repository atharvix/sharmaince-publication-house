import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { safeRedirect } from '../../lib/redirect';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import styles from './AuthLayout.module.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const redirect = safeRedirect(searchParams.get('redirect'), '/account');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(String(form.get('email')), String(form.get('password')));
      if (user.role === 'CUSTOMER') {
        navigate(redirect, { replace: true });
      } else {
        navigate(redirect.startsWith('/admin') ? redirect : '/admin', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout eyebrow="Welcome back" title="Log in to your account" subtitle="Track orders, manage your wishlist and check out faster.">
      <form className={styles.form} onSubmit={handleSubmit}>
        {notice && !error && <p className={styles.noticeBanner} role="status">{notice}</p>}
        <InputField id="login-email" name="email" type="email" label="Email address" required placeholder="you@example.com" />
        <InputField id="login-password" name="password" type="password" label="Password" required placeholder="••••••••" />
        {error && <p className={styles.errorBanner} role="alert">{error}</p>}
        <Button type="submit" size="lg" variant="primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log In'}
        </Button>
      </form>
      <p className={styles.footerNote}>
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
      <p className={styles.footerNote}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
