import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { authService } from '../services/authService';
import { useAuth } from '../auth/AuthContext';
import type { ApiError, UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/dashboard',
  sponsor: '/sponsor/dashboard',
  admin: '/admin/dashboard',
};

type AccountRole = 'driver' | 'sponsor';

const PASSWORD_REQUIREMENTS = [
  {
    label: 'At least 8 characters',
    isMet: (value: string) => value.length >= 8,
  },
  {
    label: 'At least one uppercase letter',
    isMet: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: 'At least one lowercase letter',
    isMet: (value: string) => /[a-z]/.test(value),
  },
  {
    label: 'At least one number',
    isMet: (value: string) => /\d/.test(value),
  },
  {
    label: 'At least one special character: !@#$%^&*(),.?":{}|<>',
    isMet: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
  },
] as const;

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<AccountRole>('driver');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const unmetPasswordRequirements = PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.isMet(password),
  );
  const hasStartedPassword = password.length > 0;
  const passwordRequirementsMet = unmetPasswordRequirements.length === 0;

  useEffect(() => {
    if (user) {
      navigate(ROLE_HOME[user.role], { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please complete all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.createAccount({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });
      setSuccess(response.message || 'Account created successfully. You can sign in now.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/login', { replace: true }), 900);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'We could not create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card login-card" aria-labelledby="register-heading">
      <h2 id="register-heading">Create Account</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Join as a driver or sponsor to access your dashboard and program tools.
      </p>

      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="mt-2">
        <div className="form-group">
          <label htmlFor="register-role">Account Type</label>
          <select
            id="register-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AccountRole)}
          >
            <option value="driver">Driver</option>
            <option value="sponsor">Sponsor</option>
          </select>
        </div>

        <FormField
          label="Username"
          id="register-username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <FormField
          label="Email"
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          label="Password"
          id="register-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="Your password must meet all of the requirements below."
        />

        <div className="register-password-rules" aria-live="polite">
          <p className="register-password-rules__title">Password requirements</p>
          {passwordRequirementsMet && hasStartedPassword ? (
            <p className="register-password-rules__success">
              All password requirements are met.
            </p>
          ) : (
            <ul className="register-password-rules__list">
              {unmetPasswordRequirements.map((requirement) => (
                <li key={requirement.label}>{requirement.label}</li>
              ))}
            </ul>
          )}
        </div>

        <FormField
          label="Confirm Password"
          id="register-confirm-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="register-show-password"
            checked={showPassword}
            onChange={() => setShowPassword((prev) => !prev)}
          />
          <label htmlFor="register-show-password">Show passwords</label>
        </div>

        <Button type="submit" loading={submitting}>
          {submitting ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-2 text-center">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      <p className="mt-1 text-center" style={{ fontSize: '0.875rem' }}>
        <Link to="/">Back to Home</Link>
      </p>
    </section>
  );
}
