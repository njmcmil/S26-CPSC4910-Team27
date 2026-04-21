import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/apiClient';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

interface AdminProfileData {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
}

export function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AdminProfileData>('/admin/profile')
      .then(data => {
        setProfile(data);
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setPhone(data.phone_number ?? '');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.put('/admin/profile', {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
      });
      if (newPassword) {
        await api.post('/change-password', {
          current_password: currentPassword,
          new_password: newPassword,
        });
      }
      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="admin-profile-heading" style={{ maxWidth: 560 }}>
      <h2 id="admin-profile-heading">My Profile</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Update your personal information and password.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card mt-2">
          <h3 style={{ marginBottom: '1rem' }}>Account Info</h3>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Username</p>
            <p style={{ fontWeight: 600 }}>{profile?.username}</p>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Email</p>
            <p style={{ fontWeight: 600 }}>{profile?.email ?? '—'}</p>
          </div>
          <FormField label="First Name" id="first-name" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
          <FormField label="Last Name" id="last-name" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
          <FormField label="Phone Number" id="phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} helperText="Optional. Example: (555) 123-4567" />
        </div>

        <div className="card mt-2">
          <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
          <FormField label="Current Password" id="current-password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          <FormField label="New Password" id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <FormField label="Confirm New Password" id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>

        <div className="mt-2">
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </section>
  );
}
