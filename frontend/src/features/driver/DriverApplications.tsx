import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { driverService, type DriverApplicationSponsor, type DriverApplicationSummary } from '../../services/driverService';
import type { ApiError, DriverProfile } from '../../types';

interface ApplicationForm {
  sponsor_user_id: string;
  license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_license_plate: string;
}

function buildInitialForm(profile: DriverProfile | null): ApplicationForm {
  return {
    sponsor_user_id: '',
    license_number: profile?.license_number ?? '',
    vehicle_make: profile?.vehicle_make ?? '',
    vehicle_model: profile?.vehicle_model ?? '',
    vehicle_year: profile?.vehicle_year != null ? String(profile.vehicle_year) : '',
    vehicle_license_plate: profile?.vehicle_license_plate ?? '',
  };
}

export function DriverApplicationsPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [sponsors, setSponsors] = useState<DriverApplicationSponsor[]>([]);
  const [applications, setApplications] = useState<DriverApplicationSummary[]>([]);
  const [form, setForm] = useState<ApplicationForm>(buildInitialForm(null));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [driverProfile, sponsorOptions, existingApplications] = await Promise.all([
        driverService.getProfile(),
        driverService.getApplicationSponsors(),
        driverService.getApplications(),
      ]);

      setProfile(driverProfile);
      setSponsors(sponsorOptions);
      setApplications(existingApplications);
      setForm(current => ({
        sponsor_user_id: current.sponsor_user_id,
        license_number: current.license_number || driverProfile.license_number || '',
        vehicle_make: current.vehicle_make || driverProfile.vehicle_make || '',
        vehicle_model: current.vehicle_model || driverProfile.vehicle_model || '',
        vehicle_year: current.vehicle_year || (driverProfile.vehicle_year != null ? String(driverProfile.vehicle_year) : ''),
        vehicle_license_plate: current.vehicle_license_plate || driverProfile.vehicle_license_plate || '',
      }));
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load driver applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingSponsorIds = useMemo(
    () => new Set(applications.filter(app => app.status === 'pending').map(app => app.sponsor_user_id)),
    [applications]
  );

  const availableSponsors = useMemo(
    () => sponsors.filter(sponsor => !sponsor.is_current_sponsor),
    [sponsors]
  );

  const selectedSponsor = availableSponsors.find(
    sponsor => sponsor.sponsor_user_id === Number(form.sponsor_user_id)
  );

  const onChange = (field: keyof ApplicationForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await driverService.createApplication({
        sponsor_user_id: Number(form.sponsor_user_id),
        license_number: form.license_number.trim(),
        vehicle_make: form.vehicle_make.trim(),
        vehicle_model: form.vehicle_model.trim(),
        vehicle_year: Number(form.vehicle_year),
        vehicle_license_plate: form.vehicle_license_plate.trim(),
      });

      setSuccess(`Application submitted to ${selectedSponsor?.sponsor_name ?? 'the selected sponsor'}.`);
      setForm(prev => ({ ...prev, sponsor_user_id: '' }));
      await loadData();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Spinner label="Loading applications..." />;
  }

  return (
    <section aria-labelledby="driver-applications-heading">
      <h2 id="driver-applications-heading">Sponsor Applications</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Apply to a sponsor and keep track of your approval status in one place.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="card mt-2">
        <h3>Submit Application</h3>
        {availableSponsors.length === 0 ? (
          <Alert variant="info">No sponsors are currently available for a new application.</Alert>
        ) : (
          <form className="mt-2" onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="application-sponsor">Sponsor</label>
              <select
                id="application-sponsor"
                value={form.sponsor_user_id}
                onChange={onChange('sponsor_user_id')}
                required
              >
                <option value="">Select a sponsor</option>
                {availableSponsors.map(sponsor => (
                  <option
                    key={sponsor.sponsor_user_id}
                    value={String(sponsor.sponsor_user_id)}
                    disabled={pendingSponsorIds.has(sponsor.sponsor_user_id)}
                  >
                    {sponsor.sponsor_name}
                    {pendingSponsorIds.has(sponsor.sponsor_user_id) ? ' (pending application)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application-license">License Number</label>
                <input
                  id="application-license"
                  type="text"
                  value={form.license_number}
                  onChange={onChange('license_number')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="application-plate">License Plate</label>
                <input
                  id="application-plate"
                  type="text"
                  value={form.vehicle_license_plate}
                  onChange={onChange('vehicle_license_plate')}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="application-make">Vehicle Make</label>
                <input
                  id="application-make"
                  type="text"
                  value={form.vehicle_make}
                  onChange={onChange('vehicle_make')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="application-model">Vehicle Model</label>
                <input
                  id="application-model"
                  type="text"
                  value={form.vehicle_model}
                  onChange={onChange('vehicle_model')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="application-year">Vehicle Year</label>
                <input
                  id="application-year"
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.vehicle_year}
                  onChange={onChange('vehicle_year')}
                  required
                />
              </div>
            </div>

            <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button type="submit" loading={submitting}>
                Submit Application
              </Button>
              {profile && (
                <span className="helper-text">
                  Vehicle details are prefilled from your driver profile when available.
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="card mt-2">
        <h3>Application History</h3>
        {applications.length === 0 ? (
          <p className="helper-text mt-1">You have not submitted any sponsor applications yet.</p>
        ) : (
          <table className="devices-table mt-2">
            <thead>
              <tr>
                <th>Sponsor</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(application => (
                <tr key={application.application_id}>
                  <td>{application.sponsor_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{application.status}</td>
                  <td>{new Date(application.created_at).toLocaleString()}</td>
                  <td>{application.rejection_reason || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
