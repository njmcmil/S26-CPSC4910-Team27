import { useRef, useState } from 'react';
import { getToken } from '../../services/apiClient';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://52.200.244.222:8000';

interface UploadResult {
  organizations_created: number;
  drivers_created: number;
  sponsors_created: number;
  errors: string[];
}

export function AdminBulkUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/bulk-upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const body = await res.json();
          if (body.detail) msg = body.detail;
        } catch { /* non-JSON error body */ }
        setErrorMsg(msg);
        setStatus('error');
        return;
      }

      const data: UploadResult = await res.json();
      setResult(data);
      setStatus('success');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  };

  return (
    <section className="card" aria-labelledby="bulk-upload-heading">
      <h2 id="bulk-upload-heading">Bulk Upload</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Upload a pipe-delimited <code>.txt</code> file to create organizations, drivers, and sponsors in bulk.
      </p>

      <div className="card mt-2" style={{ background: 'var(--color-bg)', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>File format</p>
        <pre style={{ margin: 0, lineHeight: 1.6 }}>
{`O|Organization Name
D|Driver Name|Organization Name
S|Sponsor Name|Driver Name`}
        </pre>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="bulk-file" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
            Select file
          </label>
          <input
            id="bulk-file"
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            required
            style={{ display: 'block' }}
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === 'loading'}
            style={{
              padding: '0.5rem 1.25rem',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
            }}
          >
            {status === 'loading' ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>

      {status === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--color-danger)',
          }}
        >
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {status === 'success' && result && (
        <div
          role="status"
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius)',
          }}
        >
          <p style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.5rem' }}>
            Upload complete
          </p>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
            <li>Organizations created: <strong>{result.organizations_created}</strong></li>
            <li>Drivers created: <strong>{result.drivers_created}</strong></li>
            <li>Sponsors created: <strong>{result.sponsors_created}</strong></li>
          </ul>

          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.35rem' }}>
                Warnings / skipped lines ({result.errors.length})
              </p>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.875rem' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
