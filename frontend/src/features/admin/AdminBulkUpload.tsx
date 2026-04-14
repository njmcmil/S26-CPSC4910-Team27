import { useRef, useState } from 'react';
import { getToken } from '../../services/apiClient';
import { Alert } from '../../components/Alert';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ── Types ──────────────────────────────────────────────────────────────────

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

interface PreflightError {
  line_number: number;
  raw_line: string;
  reason: string;
  hint: string;
}

interface PreflightResult {
  valid: boolean;
  errors: PreflightError[];
  totalLines: number;
}

// ── Client-side format validator ───────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the file content before sending to the server.
 * Each non-empty line must be either:
 *   S|username|email
 *   D|username|email|sponsor_username
 */
function validateBulkFileContent(content: string): PreflightResult {
  const lines = content.split('\n');
  const errors: PreflightError[] = [];
  let nonEmptyCount = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    nonEmptyCount++;

    const parts = line.split('|');
    const type = parts[0]?.toUpperCase();

    if (type !== 'S' && type !== 'D') {
      errors.push({
        line_number: lineNumber,
        raw_line: rawLine,
        reason: `Line starts with "${parts[0]}" — must be S (sponsor) or D (driver).`,
        hint: 'Change the first field to S or D, then separate fields with pipes: S|username|email',
      });
      return;
    }

    if (type === 'S') {
      if (parts.length < 3) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Sponsor line has ${parts.length} field(s) — expected 3 (S|username|email).`,
          hint: 'Format: S|username|email — make sure you have exactly 2 pipe characters.',
        });
        return;
      }
      if (parts.length > 3) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Sponsor line has ${parts.length} fields — expected 3 (S|username|email).`,
          hint: 'Remove extra pipe characters. Sponsor lines use exactly 2 pipes.',
        });
        return;
      }
      const [, username, email] = parts;
      if (!username?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Username field is empty.',
          hint: 'Add a username between the first and second pipe: S|myusername|email@example.com',
        });
        return;
      }
      if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `"${email?.trim() || '(empty)'}" is not a valid email address.`,
          hint: 'Use a valid email format, e.g. user@example.com',
        });
      }
      return;
    }

    if (type === 'D') {
      if (parts.length < 4) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Driver line has ${parts.length} field(s) — expected 4 (D|username|email|sponsor_username).`,
          hint: 'Format: D|username|email|sponsor_username — make sure you have exactly 3 pipe characters.',
        });
        return;
      }
      if (parts.length > 4) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Driver line has ${parts.length} fields — expected 4 (D|username|email|sponsor_username).`,
          hint: 'Remove extra pipe characters. Driver lines use exactly 3 pipes.',
        });
        return;
      }
      const [, username, email, sponsorUsername] = parts;
      if (!username?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Username field is empty.',
          hint: 'Add a username: D|myusername|email@example.com|sponsor_name',
        });
        return;
      }
      if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `"${email?.trim() || '(empty)'}" is not a valid email address.`,
          hint: 'Use a valid email format, e.g. user@example.com',
        });
        return;
      }
      if (!sponsorUsername?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Sponsor username field is empty.',
          hint: 'The last field must be the sponsor\'s username: D|username|email|sponsor_username',
        });
      }
    }
  });

  return { valid: errors.length === 0, errors, totalLines: nonEmptyCount };
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdminBulkUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'preflight-error' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [preflightErrors, setPreflightErrors] = useState<PreflightError[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    // ── Client-side format check ──
    const text = await file.text();
    const preflight = validateBulkFileContent(text);

    if (!preflight.valid) {
      setPreflightErrors(preflight.errors);
      setStatus('preflight-error');
      return;
    }

    setPreflightErrors([]);
    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getToken();
      const res = await fetch(`${BASE_URL}/bulk-upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let msg = `Upload failed (${res.status}). Please check your file and try again.`;
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
      setErrorMsg(
        err instanceof Error
          ? `Network error: ${err.message}. Check your connection and try again.`
          : 'A network error occurred. Check your connection and try again.',
      );
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

      {/* Format reference card */}
      <div className="card mt-2" style={{ background: 'var(--color-bg)', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Required file format</p>
        <pre style={{ margin: 0, lineHeight: 1.6 }}>
{`S|username|email
D|username|email|sponsor_username`}
        </pre>
        <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
          <li><strong>S</strong> — create a sponsor account (3 fields separated by <code>|</code>)</li>
          <li><strong>D</strong> — create a driver account linked to a sponsor (4 fields separated by <code>|</code>)</li>
        </ul>
        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
          Sponsors defined earlier in the file can be referenced by driver lines in the same file.
          Blank lines are ignored.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="bulk-file" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
            Select file (.txt)
          </label>
          <input
            id="bulk-file"
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            required
            style={{ display: 'block' }}
            onChange={() => {
              // Reset previous results when a new file is chosen
              if (status !== 'idle') {
                setStatus('idle');
                setPreflightErrors([]);
                setErrorMsg('');
                setResult(null);
              }
            }}
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Uploading…' : 'Validate & Upload'}
          </button>
        </div>
      </form>

      {/* ── Pre-flight format errors ── */}
      {status === 'preflight-error' && preflightErrors.length > 0 && (
        <div role="alert" style={{ marginTop: '1rem' }}>
          <Alert variant="error">
            Your file has {preflightErrors.length} format error{preflightErrors.length !== 1 ? 's' : ''}.
            Fix the issues below, then re-upload.
          </Alert>
          <div style={{ marginTop: '0.75rem' }}>
            {preflightErrors.map((e) => (
              <div
                key={e.line_number}
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-error-bg)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.875rem',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.25rem' }}>
                  Line {e.line_number}: {e.reason}
                </p>
                {e.raw_line.trim() && (
                  <code style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.8rem', color: '#555', marginBottom: '0.35rem' }}>
                    {e.raw_line.trim()}
                  </code>
                )}
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 0 }}>
                  <strong>How to fix:</strong> {e.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Server error ── */}
      {status === 'error' && (
        <div className="mt-2">
          <Alert variant="error">{errorMsg}</Alert>
        </div>
      )}

      {/* ── Success result ── */}
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
                Skipped lines ({result.errors.length}) — these entries were not created
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
