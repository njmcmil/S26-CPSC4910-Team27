import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { driverService } from '../../services/driverService';
import { Spinner } from '../../components/Spinner';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import type { DriverProfile as DriverProfileType, ApiError } from '../../types';

/* ── editable subset ── */

interface EditForm {
  first_name: string;
  last_name: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_license_plate: string;
  bio: string;
}

type FieldErrors = Partial<Record<keyof EditForm, string>>;

function profileToForm(p: DriverProfileType): EditForm {
  return {
    first_name:            p.first_name            ?? '',
    last_name:             p.last_name             ?? '',
    phone_number:          p.phone_number          ?? '',
    address:               p.address               ?? '',
    city:                  p.city                  ?? '',
    state:                 p.state                 ?? '',
    zip_code:              p.zip_code              ?? '',
    license_number:        p.license_number        ?? '',
    vehicle_make:          p.vehicle_make          ?? '',
    vehicle_model:         p.vehicle_model         ?? '',
    vehicle_year:          p.vehicle_year != null ? String(p.vehicle_year) : '',
    vehicle_license_plate: p.vehicle_license_plate ?? '',
    bio:                   p.bio                   ?? '',
  };
}

function validate(form: EditForm): FieldErrors {
  const errs: FieldErrors = {};
  if (form.phone_number && !/^\+?[\d\s()-]{7,20}$/.test(form.phone_number)) {
    errs.phone_number = 'Enter a valid phone number.';
  }
  if (form.vehicle_year && !/^\d{4}$/.test(form.vehicle_year)) {
    errs.vehicle_year = 'Enter a 4-digit year.';
  }
  return errs;
}

/* ── read-only view ── */

function ProfileView({
  profile,
  onEdit,
}: {
  profile: DriverProfileType;
  onEdit: () => void;
}) {
  const fields: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Username',      value: profile.username },
    { label: 'Email',         value: profile.email },
    { label: 'First Name',    value: profile.first_name },
    { label: 'Last Name',     value: profile.last_name },
    { label: 'Phone',         value: profile.phone_number },
    {
      label: 'Address',
      value: [profile.address, profile.city, profile.state, profile.zip_code]
        .filter(Boolean)
        .join(', ') || null,
    },
    { label: 'License Number', value: profile.license_number },
    {
      label: 'Vehicle',
      value:
        [profile.vehicle_year, profile.vehicle_make, profile.vehicle_model]
          .filter(Boolean)
          .join(' ') || null,
    },
    { label: 'License Plate', value: profile.vehicle_license_plate },
    { label: 'Bio',           value: profile.bio },
    { label: 'Points Balance', value: profile.points_balance },
  ];

  return (
    <>
      <dl className="profile-dl mt-1">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value != null && value !== '' ? String(value) : '\u2014'}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2">
        <Button type="button" onClick={onEdit}>
          Edit Profile
        </Button>
      </div>
    </>
  );
}

/* ── edit form ── */

function ProfileEditForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: EditForm;
  onSaved: (updated: DriverProfileType) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditForm>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const set = (field: keyof EditForm, value: string) => {
    setSaveError('');
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload: Partial<DriverProfileType> = {
        first_name:            form.first_name            || null,
        last_name:             form.last_name             || null,
        phone_number:          form.phone_number          || null,
        address:               form.address               || null,
        city:                  form.city                  || null,
        state:                 form.state                 || null,
        zip_code:              form.zip_code              || null,
        license_number:        form.license_number        || null,
        vehicle_make:          form.vehicle_make          || null,
        vehicle_model:         form.vehicle_model         || null,
        vehicle_year:          form.vehicle_year ? Number(form.vehicle_year) : null,
        vehicle_license_plate: form.vehicle_license_plate || null,
        bio:                   form.bio                   || null,
      };
      const updated = await driverService.updateProfile(payload);
      onSaved(updated);
    } catch (err) {
      const apiErr = err as ApiError;
      setSaveError(apiErr.message || 'Failed to save profile.');
      if (apiErr.fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, ...apiErr.fieldErrors as FieldErrors }));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {saveError && <Alert variant="error">{saveError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
        <FormField
          label="First Name"
          id="driver-first"
          type="text"
          autoComplete="given-name"
          value={form.first_name}
          onChange={(e) => set('first_name', e.target.value)}
        />
        <FormField
          label="Last Name"
          id="driver-last"
          type="text"
          autoComplete="family-name"
          value={form.last_name}
          onChange={(e) => set('last_name', e.target.value)}
        />
      </div>

      <FormField
        label="Phone"
        id="driver-phone"
        type="tel"
        autoComplete="tel"
        value={form.phone_number}
        onChange={(e) => set('phone_number', e.target.value)}
        error={fieldErrors.phone_number}
        helperText="Optional. Example: (555) 123-4567"
      />

      <FormField
        label="Street Address"
        id="driver-address"
        type="text"
        autoComplete="street-address"
        value={form.address}
        onChange={(e) => set('address', e.target.value)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 6rem 8rem', gap: '0 1rem' }}>
        <FormField
          label="City"
          id="driver-city"
          type="text"
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
        />
        <FormField
          label="State"
          id="driver-state"
          type="text"
          value={form.state}
          onChange={(e) => set('state', e.target.value)}
        />
        <FormField
          label="ZIP"
          id="driver-zip"
          type="text"
          autoComplete="postal-code"
          value={form.zip_code}
          onChange={(e) => set('zip_code', e.target.value)}
        />
      </div>

      <FormField
        label="License Number"
        id="driver-license"
        type="text"
        value={form.license_number}
        onChange={(e) => set('license_number', e.target.value)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 1fr 10rem', gap: '0 1rem' }}>
        <FormField
          label="Year"
          id="driver-vy"
          type="text"
          inputMode="numeric"
          value={form.vehicle_year}
          onChange={(e) => set('vehicle_year', e.target.value)}
          error={fieldErrors.vehicle_year}
        />
        <FormField
          label="Make"
          id="driver-vmake"
          type="text"
          value={form.vehicle_make}
          onChange={(e) => set('vehicle_make', e.target.value)}
        />
        <FormField
          label="Model"
          id="driver-vmodel"
          type="text"
          value={form.vehicle_model}
          onChange={(e) => set('vehicle_model', e.target.value)}
        />
        <FormField
          label="License Plate"
          id="driver-vplate"
          type="text"
          value={form.vehicle_license_plate}
          onChange={(e) => set('vehicle_license_plate', e.target.value)}
        />
      </div>

      <FormField
        label="Bio"
        id="driver-bio"
        type="textarea"
        value={form.bio}
        onChange={(e) => set('bio', e.target.value)}
        helperText="Optional. Tell sponsors a bit about yourself."
      />

      <div className="btn-group">
        <Button type="submit" loading={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── page ── */

export function DriverProfilePage() {
  const [profile, setProfile] = useState<DriverProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

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

  const handleSaved = (updated: DriverProfileType) => {
    setProfile(updated);
    setEditing(false);
    setSaveSuccess('Profile updated successfully.');
    setTimeout(() => setSaveSuccess(''), 4000);
  };

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

  return (
    <section className="card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Driver Profile</h2>

      <div aria-live="polite" aria-atomic="true">
        {saveSuccess && <Alert variant="success">{saveSuccess}</Alert>}
      </div>

      {editing ? (
        <ProfileEditForm
          initial={profileToForm(profile)}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ProfileView profile={profile} onEdit={() => { setSaveSuccess(''); setEditing(true); }} />
      )}
    </section>
  );
}
