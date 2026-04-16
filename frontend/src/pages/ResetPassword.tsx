import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/apiClient';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reset-password', { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <section className="card login-card">
        <h2>Invalid Reset Link</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          This password reset link is invalid or has expired.
        </p>
        <Button onClick={() => navigate('/login')} style={{ marginTop: '1rem' }}>
          Back to Login
        </Button>
      </section>
    );
  }

  if (success) {
    return (
      <section className="card login-card">
        <h2>Password Reset!</h2>
        <Alert variant="success">
          Your password has been reset successfully. Redirecting to login...
        </Alert>
      </section>
    );
  }

  return (
    <section className="card login-card" aria-labelledby="reset-heading">
      <h2 id="reset-heading">Reset Your Password</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Enter your new password below.
      </p>

      <div aria-live="assertive" aria-atomic="true">
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="New Password"
          id="new-password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <FormField
          label="Confirm Password"
          id="confirm-password"
          type="password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>
    </section>
  );
}
