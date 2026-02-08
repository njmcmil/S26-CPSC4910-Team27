import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authService } from '../services/authService';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import type { ApiError, UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/dashboard',
  sponsor: '/sponsor/dashboard',
  admin: '/admin/dashboard',
};

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  // If already logged in, redirect
  if (user) {
    navigate(ROLE_HOME[user.role], { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const role = await login({
        username: username.trim(),
        password,
        remember_device: rememberDevice,
      });
      navigate(ROLE_HOME[role] ?? '/');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');

    if (!forgotUsername.trim()) {
      setForgotError('Please enter your username.');
      return;
    }

    setForgotSubmitting(true);
    try {
      const res = await authService.forgotPassword(forgotUsername.trim());
      setForgotMsg(res.message);
    } catch (err) {
      const apiErr = err as ApiError;
      setForgotError(apiErr.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <section className="card login-card" aria-labelledby="login-heading">
      <h2 id="login-heading">Sign In</h2>

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Username"
          id="login-username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <FormField
          label="Password"
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="login-remember"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <div>
            <label htmlFor="login-remember">Remember this device</label>
            <p className="helper-text" id="login-remember-help">
              If checked, we'll remember this device so you don't have to
              re-enter credentials next time.
            </p>
          </div>
        </div>

        <Button type="submit" loading={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-2 text-center">
        <button
          type="button"
          className="link-btn"
          onClick={() => setShowForgot(!showForgot)}
          aria-expanded={showForgot}
        >
          Forgot your password?
        </button>
      </p>

      {showForgot && (
        <div className="forgot-section mt-1" aria-labelledby="forgot-heading">
          <h3 id="forgot-heading">Reset Password</h3>
          <p className="helper-text mb-1">
            Enter your username and we'll send a password reset link to your
            email address on file.
          </p>

          <div aria-live="polite" aria-atomic="true">
            {forgotMsg && <Alert variant="success">{forgotMsg}</Alert>}
            {forgotError && <Alert variant="error">{forgotError}</Alert>}
          </div>

          <form onSubmit={handleForgotSubmit} noValidate>
            <FormField
              label="Username"
              id="forgot-username"
              type="text"
              autoComplete="username"
              required
              value={forgotUsername}
              onChange={(e) => setForgotUsername(e.target.value)}
            />
            <Button type="submit" loading={forgotSubmitting}>
              {forgotSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </div>
      )}

      <p className="mt-2 text-center" style={{ fontSize: '0.875rem' }}>
        <Link to="/">Back to Home</Link>
      </p>
    </section>
  );
}
