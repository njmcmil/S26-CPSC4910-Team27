import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { sponsorService } from '../../services/sponsorService';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { SponsorProfileUpdate, ApiError } from '../../types';

type FieldErrors = Partial<Record<keyof SponsorProfileUpdate, string>>;

const EMPTY_FORM: SponsorProfileUpdate = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  point_value: 0.01,
};

function validate(form: SponsorProfileUpdate): FieldErrors {
  const errs: FieldErrors = {};

  if (!form.company_name.trim()) {
    errs.company_name = 'Company name is required.';
  }
  if (!form.contact_name.trim()) {
    errs.contact_name = 'Contact name is required.';
  }
  if (!form.email.trim()) {
    errs.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errs.email = 'Enter a valid email address.';
  }
  if (form.phone && !/^\+?[\d\s()-]{7,20}$/.test(form.phone)) {
    errs.phone = 'Enter a valid phone number.';
  }
  if (form.point_value == null || form.point_value < 0) {
    errs.point_value = 'Point value must be 0 or greater.';
  }

  return errs;
}

export function SponsorProfileFormPage() {
  const [form, setForm] = useState<SponsorProfileUpdate>(EMPTY_FORM);
  const [original, setOriginal] = useState<SponsorProfileUpdate>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await sponsorService.getProfile();
      const formData: SponsorProfileUpdate = {
        company_name: data.company_name ?? '',
        contact_name: data.contact_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        point_value: data.point_value ?? 0.01,
      };
      setForm(formData);
      setOriginal(formData);
    } catch (err) {
      const apiErr = err as ApiError;
      setLoadError(apiErr.message || 'Failed to load sponsor profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (field: keyof SponsorProfileUpdate, value: string) => {
    setSaveSuccess('');
    setForm((prev) => ({
      ...prev,
      [field]: field === 'point_value' ? (value === '' ? '' : Number(value)) : value,
    }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCancel = () => {
    setForm(original);
    setFieldErrors({});
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');

    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await sponsorService.updateProfile(form);
      setOriginal(form);
      setSaveSuccess('Profile updated successfully.');
    } catch (err) {
      const apiErr = err as ApiError;
      setSaveError(apiErr.message || 'Failed to save profile.');
      // Merge any backend field errors
      if (apiErr.fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, ...apiErr.fieldErrors }));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading sponsor profile…" />;

  if (loadError) {
    return (
      <section className="card" aria-labelledby="sponsor-heading">
        <h2 id="sponsor-heading">Sponsor Profile</h2>
        <Alert variant="error">{loadError}</Alert>
        <div className="mt-2">
          <Button onClick={fetchProfile}>Retry</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="sponsor-heading">
      <h2 id="sponsor-heading">Sponsor Profile</h2>

      {/* Live region for save feedback */}
      <div aria-live="polite" aria-atomic="true">
        {saveSuccess && <Alert variant="success">{saveSuccess}</Alert>}
        {saveError && <Alert variant="error">{saveError}</Alert>}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Company / Sponsor Name"
          id="sponsor-company"
          type="text"
          required
          value={form.company_name}
          onChange={(e) => handleChange('company_name', e.target.value)}
          error={fieldErrors.company_name}
        />

        <FormField
          label="Contact Name"
          id="sponsor-contact"
          type="text"
          required
          value={form.contact_name}
          onChange={(e) => handleChange('contact_name', e.target.value)}
          error={fieldErrors.contact_name}
        />

        <FormField
          label="Email"
          id="sponsor-email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={fieldErrors.email}
        />

        <FormField
          label="Phone"
          id="sponsor-phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={fieldErrors.phone}
          helperText="Optional. Example: (555) 123-4567"
        />

        <FormField
          label="Address"
          id="sponsor-address"
          type="text"
          autoComplete="street-address"
          value={form.address}
          onChange={(e) => handleChange('address', e.target.value)}
          helperText="Optional."
        />

        <FormField
          label="Point Value ($)"
          id="sponsor-pointvalue"
          type="number"
          required
          min={0}
          step={0.01}
          value={String(form.point_value)}
          onChange={(e) => handleChange('point_value', e.target.value)}
          error={fieldErrors.point_value}
          helperText="Dollar value per point. Must be 0 or greater."
        />

        <div className="btn-group">
          <Button type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
