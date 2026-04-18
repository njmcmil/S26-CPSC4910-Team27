import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { authService } from '../services/authService';
import type { ApiError } from '../types';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('This reset link is missing its token. Please request a new password reset email.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.resetPassword(token, newPassword);
      setSuccess(response.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card login-card" aria-labelledby="reset-password-heading">
      <h2 id="reset-password-heading">Reset Password</h2>
      <p className="helper-text mt-1">
        Set a new password for your account using the secure link from your email.
      </p>

      <div aria-live="assertive" aria-atomic="true">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="New Password"
          id="reset-password-new"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <FormField
          label="Confirm New Password"
          id="reset-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>

      <p className="mt-2 text-center">
        <Link to="/login">Back to Sign In</Link>
      </p>
    </section>
  );
}
