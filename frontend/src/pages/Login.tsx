import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import type { ApiError, UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/profile',
  sponsor: '/sponsor/profile',
  admin: '/admin',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <section className="card" aria-labelledby="login-heading">
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
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </section>
  );
}
