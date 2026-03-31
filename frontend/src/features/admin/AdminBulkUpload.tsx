import { useRef, useState } from 'react';
import { getToken } from '../../services/apiClient';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface CreatedUser {
  username: string;
  role: 'sponsor' | 'driver';
  temp_password: string;
}

interface ValidationError {
  line_number: number;
  raw_line: string;
  reason: string;
}

interface UploadResult {
  sponsors_created: number;
  drivers_created: number;
  created_users: CreatedUser[];
  errors: ValidationError[];
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
        Upload a pipe-delimited <code>.txt</code> file to create sponsor and driver accounts in bulk.
        Each new user receives a unique temporary password shown once after upload.
      </p>

      <div className="card mt-2" style={{ background: 'var(--color-bg)', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>File format</p>
        <pre style={{ margin: 0, lineHeight: 1.6 }}>
{`S|username|email
D|username|email|sponsor_username`}
        </pre>
        <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
          <li><strong>S</strong> — create a sponsor account</li>
          <li><strong>D</strong> — create a driver account and link it to an existing sponsor</li>
        </ul>
        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
          Sponsors defined earlier in the file can be referenced by driver lines in the same file.
        </p>
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
            <li>Sponsors created: <strong>{result.sponsors_created}</strong></li>
            <li>Drivers created: <strong>{result.drivers_created}</strong></li>
          </ul>

          {result.created_users.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                Temporary passwords — save these now, they will not be shown again
              </p>
              <div
                style={{
                  padding: '0.5rem',
                  background: 'var(--color-warning-bg, #fff8e1)',
                  border: '1px solid var(--color-warning, #f0ad4e)',
                  borderRadius: 'var(--radius)',
                  overflowX: 'auto',
                }}
              >
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border, #ddd)' }}>
                      <th style={{ padding: '0.4rem 0.75rem' }}>Username</th>
                      <th style={{ padding: '0.4rem 0.75rem' }}>Role</th>
                      <th style={{ padding: '0.4rem 0.75rem' }}>Temporary Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created_users.map((u) => (
                      <tr key={u.username} style={{ borderBottom: '1px solid var(--color-border, #eee)' }}>
                        <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace' }}>{u.username}</td>
                        <td style={{ padding: '0.4rem 0.75rem' }}>{u.role}</td>
                        <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace' }}>{u.temp_password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.35rem' }}>
                Warnings / skipped lines ({result.errors.length})
              </p>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.875rem' }}>
                {result.errors.map((e) => (
                  <li key={e.line_number}>
                    <strong>Line {e.line_number}:</strong> {e.reason}
                    {e.raw_line && (
                      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#666', marginTop: '0.15rem' }}>
                        {e.raw_line}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
