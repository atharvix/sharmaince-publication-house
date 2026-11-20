import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { safeRedirect } from '../../lib/redirect';
import { InputField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import styles from './AuthLayout.module.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'), '/account');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await register(String(form.get('name')), String(form.get('email')), String(form.get('password')));
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Save your addresses, track orders and build a wishlist.">
      <form className={styles.form} onSubmit={handleSubmit}>
        <InputField id="register-name" name="name" label="Full name" required placeholder="Your name" />
        <InputField id="register-email" name="email" type="email" label="Email address" required placeholder="you@example.com" />
        <InputField
          id="register-password"
          name="password"
          type="password"
          label="Password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          hint="Include an uppercase letter, a lowercase letter and a number."
        />
        {error && <p className={styles.errorBanner} role="alert">{error}</p>}
        <Button type="submit" size="lg" variant="primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
      <p className={styles.footerNote}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
