import { useCallback, useEffect, useState } from 'react';
import { driverService } from '../../services/driverService';
import { Spinner } from '../../components/Spinner';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import type { DriverProfile as DriverProfileType, ApiError } from '../../types';

export function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const data = await driverService.getProfile();
      setProfile(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 404) {
        setNotFound(true);
      } else {
        setError(apiErr.message || 'Failed to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) return <Spinner label="Loading profile..." />;

  if (notFound) {
    return (
      <section className="card" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Driver Profile</h2>
        <Alert variant="info">
          Your profile has not been set up yet. Please contact your sponsor or
          an administrator to complete your profile.
        </Alert>
        <div className="mt-2">
          <Button onClick={fetchProfile}>Retry</Button>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Driver Profile</h2>
        <Alert variant="error">{error}</Alert>
        <div className="mt-2">
          <Button onClick={fetchProfile}>Retry</Button>
        </div>
      </section>
    );
  }

  if (!profile) return null;

  const fields: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Username', value: profile.username },
    { label: 'Email', value: profile.email },
    { label: 'First Name', value: profile.first_name },
    { label: 'Last Name', value: profile.last_name },
    { label: 'Phone', value: profile.phone_number },
    { label: 'Address', value: [profile.address, profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ') || null },
    { label: 'License Number', value: profile.license_number },
    { label: 'Vehicle', value: [profile.vehicle_year, profile.vehicle_make, profile.vehicle_model].filter(Boolean).join(' ') || null },
    { label: 'License Plate', value: profile.vehicle_license_plate },
    { label: 'Points Balance', value: profile.points_balance },
  ];

  return (
    <section className="card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Driver Profile</h2>
      <dl className="profile-dl mt-1">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value != null && value !== '' ? String(value) : '\u2014'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
