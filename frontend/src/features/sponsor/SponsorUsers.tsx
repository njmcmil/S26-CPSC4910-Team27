import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

interface SponsorUserRow {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_owner: boolean;
}

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', isMet: (value: string) => value.length >= 8 },
  { label: 'At least one uppercase letter', isMet: (value: string) => /[A-Z]/.test(value) },
  { label: 'At least one lowercase letter', isMet: (value: string) => /[a-z]/.test(value) },
  { label: 'At least one number', isMet: (value: string) => /\d/.test(value) },
  { label: 'At least one special character: !@#$%^&*(),.?":{}|<>', isMet: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
] as const;

export function SponsorUsersPage() {
  const [users, setUsers] = useState<SponsorUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const unmetPasswordRequirements = PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.isMet(password),
  );
  const hasStartedPassword = password.length > 0;
  const passwordRequirementsMet = unmetPasswordRequirements.length === 0;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ users: SponsorUserRow[] }>('/sponsor/users');
      setUsers(data.users || []);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load sponsor users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const displayName = (u: SponsorUserRow) =>
    u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : 'No name set';

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!username.trim() || !email.trim() || !password) {
      setError('Username, email, and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{ message: string; username: string; email: string }>('/sponsor/users', {
        username: username.trim(),
        email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        password,
      });
      await loadUsers();
      setUsername('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setPassword('');
      setConfirmPassword('');
      setSuccess(result.message || 'Sponsor user created.');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Could not create sponsor user.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading sponsor users..." />;

  return (
    <section aria-labelledby="sponsor-users-heading">
      <h2 id="sponsor-users-heading">Sponsor Users</h2>
      <p className="mt-1">Create and manage additional sponsor logins for your organization.</p>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="card mt-2">
        <h3 style={{ marginTop: 0 }}>Create Sponsor User</h3>
        <form onSubmit={onCreateUser}>
          <FormField
            label="Username"
            id="sponsor-user-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <FormField
            label="Email"
            id="sponsor-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            label="First Name"
            id="sponsor-user-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <FormField
            label="Last Name"
            id="sponsor-user-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <FormField
            label="Password"
            id="sponsor-user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="Must satisfy account password complexity rules."
          />
          <div className="register-password-rules" aria-live="polite">
            <p className="register-password-rules__title">Password requirements</p>
            {passwordRequirementsMet && hasStartedPassword ? (
              <p className="register-password-rules__success">All password requirements are met.</p>
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
            id="sponsor-user-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={submitting}>
            {submitting ? 'Creating...' : 'Create Sponsor User'}
          </Button>
        </form>
      </div>

      <div className="card mt-2">
        <h3 style={{ marginTop: 0 }}>Organization Sponsor Users</h3>
        {users.length === 0 ? (
          <p className="placeholder-msg">No sponsor users found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color, #ddd)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Username</th>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Email</th>
                <th style={{ padding: '0.5rem' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                  <td style={{ padding: '0.5rem' }}>{user.username}</td>
                  <td style={{ padding: '0.5rem' }}>{displayName(user)}</td>
                  <td style={{ padding: '0.5rem' }}>{user.email}</td>
                  <td style={{ padding: '0.5rem' }}>{user.is_owner ? 'Primary Sponsor' : 'Sponsor User'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
