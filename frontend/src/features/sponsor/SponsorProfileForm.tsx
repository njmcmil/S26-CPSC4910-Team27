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
  contact_person_name: '',
  contact_person_phone: '',
  phone_number: '',
  company_address: '',
  company_city: '',
  company_state: '',
  company_zip: '',
  industry: '',
  first_name: '',
  last_name: '',
};

function validate(form: SponsorProfileUpdate): FieldErrors {
  const errs: FieldErrors = {};

  if (!form.company_name?.trim()) {
    errs.company_name = 'Company name is required.';
  }
  if (form.contact_person_phone && !/^\+?[\d\s()-]{7,20}$/.test(form.contact_person_phone)) {
    errs.contact_person_phone = 'Enter a valid phone number.';
  }
  if (form.phone_number && !/^\+?[\d\s()-]{7,20}$/.test(form.phone_number)) {
    errs.phone_number = 'Enter a valid phone number.';
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
        contact_person_name: data.contact_person_name ?? '',
        contact_person_phone: data.contact_person_phone ?? '',
        phone_number: data.phone_number ?? '',
        company_address: data.company_address ?? '',
        company_city: data.company_city ?? '',
        company_state: data.company_state ?? '',
        company_zip: data.company_zip ?? '',
        industry: data.industry ?? '',
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
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
    setForm((prev) => ({ ...prev, [field]: value }));
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
      if (apiErr.fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, ...apiErr.fieldErrors }));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading sponsor profile..." />;

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
          value={form.company_name ?? ''}
          onChange={(e) => handleChange('company_name', e.target.value)}
          error={fieldErrors.company_name}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <FormField
            label="First Name"
            id="sponsor-first"
            type="text"
            value={form.first_name ?? ''}
            onChange={(e) => handleChange('first_name', e.target.value)}
          />
          <FormField
            label="Last Name"
            id="sponsor-last"
            type="text"
            value={form.last_name ?? ''}
            onChange={(e) => handleChange('last_name', e.target.value)}
          />
        </div>

        <FormField
          label="Phone"
          id="sponsor-phone"
          type="tel"
          autoComplete="tel"
          value={form.phone_number ?? ''}
          onChange={(e) => handleChange('phone_number', e.target.value)}
          error={fieldErrors.phone_number}
          helperText="Optional. Example: (555) 123-4567"
        />

        <FormField
          label="Contact Person Name"
          id="sponsor-contact"
          type="text"
          value={form.contact_person_name ?? ''}
          onChange={(e) => handleChange('contact_person_name', e.target.value)}
        />

        <FormField
          label="Contact Person Phone"
          id="sponsor-contact-phone"
          type="tel"
          value={form.contact_person_phone ?? ''}
          onChange={(e) => handleChange('contact_person_phone', e.target.value)}
          error={fieldErrors.contact_person_phone}
        />

        <FormField
          label="Company Address"
          id="sponsor-address"
          type="text"
          autoComplete="street-address"
          value={form.company_address ?? ''}
          onChange={(e) => handleChange('company_address', e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 6rem 8rem', gap: '0 1rem' }}>
          <FormField
            label="City"
            id="sponsor-city"
            type="text"
            value={form.company_city ?? ''}
            onChange={(e) => handleChange('company_city', e.target.value)}
          />
          <FormField
            label="State"
            id="sponsor-state"
            type="text"
            value={form.company_state ?? ''}
            onChange={(e) => handleChange('company_state', e.target.value)}
          />
          <FormField
            label="ZIP"
            id="sponsor-zip"
            type="text"
            value={form.company_zip ?? ''}
            onChange={(e) => handleChange('company_zip', e.target.value)}
          />
        </div>

        <FormField
          label="Industry"
          id="sponsor-industry"
          type="text"
          value={form.industry ?? ''}
          onChange={(e) => handleChange('industry', e.target.value)}
          helperText="Optional. E.g., Technology, Transportation, Insurance"
        />

        <div className="btn-group">
          <Button type="submit" loading={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
