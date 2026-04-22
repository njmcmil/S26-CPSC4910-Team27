import { useRef, useState } from 'react';
import { API_BASE_URL, getToken } from '../../services/apiClient';
import { Alert } from '../../components/Alert';

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
  orgs_created: number;
  sponsors_created: number;
  drivers_created: number;
  created_users: CreatedUser[];
  errors: ValidationError[];
  warnings?: ValidationError[];
}

interface PreflightError {
  line_number: number;
  raw_line: string;
  reason: string;
  hint: string;
}

// ── Client-side format validator ───────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates file content and returns format warnings.
 * Invalid lines are reported but do NOT block the upload —
 * the server handles partial success row-by-row.
 *
 * Valid line formats:
 *   O|org_name
 *   S|username|email
 *   D|username|email|sponsor_username
 *
 * Legacy RC formats (also accepted):
 *   S|org_name|first_name|last_name|email[|points_delta|reason]
 *   D|org_name|first_name|last_name|email[|points_delta|reason]
 */
function validateBulkFileContent(content: string): PreflightError[] {
  const lines = content.split('\n');
  const errors: PreflightError[] = [];
  const HEADER_TOKENS = new Set(['type', 'record_type', 'role']);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#') || line.startsWith('//')) return;

    const parts = line.split('|');
    const rawType = parts[0]?.trim() ?? '';
    const type = rawType.toUpperCase();

    if (HEADER_TOKENS.has(rawType.toLowerCase())) return;

    if (type !== 'O' && type !== 'S' && type !== 'D') {
      errors.push({
        line_number: lineNumber,
        raw_line: rawLine,
        reason: `Line starts with "${rawType}" — must be O (organization), S (sponsor), or D (driver).`,
        hint: 'Change the first field to O, S, or D, then separate fields with pipes.',
      });
      return;
    }

    if (type === 'O') {
      if (parts.length < 2 || !parts[1]?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Organization line has ${parts.length} field(s) — expected 2 (O|org_name).`,
          hint: 'Format: O|My Organization Name — one pipe character.',
        });
      }
      return;
    }

    if (type === 'S') {
      if (parts.length === 3) {
        const [, username, email] = parts;
        if (!username?.trim()) {
          errors.push({
            line_number: lineNumber,
            raw_line: rawLine,
            reason: 'Username field is empty.',
            hint: 'Add a username: S|myusername|email@example.com',
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

      if (parts.length !== 5 && parts.length !== 7) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Sponsor line has ${parts.length} field(s) — expected 3 (new format) or 5/7 (legacy format).`,
          hint: 'Use S|username|email or S|org|first|last|email|points|reason.',
        });
        return;
      }
      const [, orgName, firstName, lastName, email, pointsDelta = '', reason = ''] = parts;
      if (!orgName?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Legacy sponsor line requires an organization name for admin upload.',
          hint: 'Use S|organization|first|last|email[|points|reason].',
        });
        return;
      }
      if (!firstName?.trim() || !lastName?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Legacy sponsor line requires first and last name.',
          hint: 'Format: S|org|first|last|email[|points|reason]',
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
      if (pointsDelta.trim()) {
        if (!/^[+-]?\d+$/.test(pointsDelta.trim())) {
          errors.push({
            line_number: lineNumber,
            raw_line: rawLine,
            reason: `Legacy sponsor points value "${pointsDelta}" is not a valid integer.`,
            hint: 'Use numbers like 100 or -50.',
          });
          return;
        }
        if (!reason.trim()) {
          errors.push({
            line_number: lineNumber,
            raw_line: rawLine,
            reason: 'Legacy sponsor line includes points but no reason.',
            hint: 'Provide a reason when points are included.',
          });
        }
      }
      return;
    }

    if (type === 'D') {
      if (parts.length === 4) {
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
            hint: "The last field must be the sponsor's username: D|username|email|sponsor_username",
          });
        }
        return;
      }

      if (parts.length !== 5 && parts.length !== 7) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: `Driver line has ${parts.length} field(s) — expected 4 (new format) or 5/7 (legacy format).`,
          hint: 'Use D|username|email|sponsor_username or D|org|first|last|email|points|reason.',
        });
        return;
      }
      const [, orgName, firstName, lastName, email, pointsDelta = '', reason = ''] = parts;
      if (!orgName?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Legacy driver line requires an organization name for admin upload.',
          hint: 'Use D|organization|first|last|email[|points|reason].',
        });
        return;
      }
      if (!firstName?.trim() || !lastName?.trim()) {
        errors.push({
          line_number: lineNumber,
          raw_line: rawLine,
          reason: 'Legacy driver line requires first and last name.',
          hint: 'Format: D|org|first|last|email[|points|reason]',
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
      if (pointsDelta.trim()) {
        if (!/^[+-]?\d+$/.test(pointsDelta.trim())) {
          errors.push({
            line_number: lineNumber,
            raw_line: rawLine,
            reason: `Legacy driver points value "${pointsDelta}" is not a valid integer.`,
            hint: 'Use numbers like 100 or -50.',
          });
          return;
        }
        if (!reason.trim()) {
          errors.push({
            line_number: lineNumber,
            raw_line: rawLine,
            reason: 'Legacy driver line includes points but no reason.',
            hint: 'Provide a reason when points are included.',
          });
        }
      }
    }
  });

  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdminBulkUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [preflightErrors, setPreflightErrors] = useState<PreflightError[]>([]);

  const handleFileChange = async () => {
    const file = fileRef.current?.files?.[0];
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    if (!file) {
      setPreflightErrors([]);
      return;
    }
    const text = await file.text();
    setPreflightErrors(validateBulkFileContent(text));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/bulk-upload`, {
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
      setPreflightErrors([]);
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
        Upload a CSV or pipe-delimited text file to create organizations, sponsor, and driver
        accounts in bulk. Each new user receives a unique temporary password shown once after
        upload. Valid rows are always processed even if other rows in the file are invalid.
      </p>

      {/* Format reference card */}
      <div className="card mt-2" style={{ background: 'var(--color-bg)', fontSize: '0.85rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Required file format</p>
        <pre style={{ margin: 0, lineHeight: 1.6 }}>
{`O|org_name
S|username|email
D|username|email|sponsor_username

# Legacy (RC sample) also supported
S|org_name|first_name|last_name|email|points_delta|reason
D|org_name|first_name|last_name|email|points_delta|reason`}
        </pre>
        <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', lineHeight: 1.8, color: 'var(--color-text-muted)' }}>
          <li><strong>O</strong> — register an organization (2 fields)</li>
          <li><strong>S</strong> — create sponsor account (3 fields new format, 5/7 fields legacy format)</li>
          <li><strong>D</strong> — create driver linked to sponsor (4 fields new format, 5/7 fields legacy format)</li>
        </ul>
        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
          Sponsors defined earlier in the file can be referenced by driver lines in the same
          file. Blank lines and lines starting with <code>#</code> are ignored. Invalid rows are
          skipped and reported — valid rows are still processed.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="bulk-file" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
            Select file (.txt or .csv)
          </label>
          <input
            id="bulk-file"
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            required
            style={{ display: 'block' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Preflight warnings (advisory — upload still proceeds) */}
        {preflightErrors.length > 0 && status !== 'success' && (
          <div role="status" aria-live="polite">
            <Alert variant="warning">
              {preflightErrors.length} line{preflightErrors.length !== 1 ? 's have' : ' has'} format
              issues and will be skipped by the server. Valid lines will still be processed.
            </Alert>
            <div style={{ marginTop: '0.5rem' }}>
              {preflightErrors.map((e) => (
                <div
                  key={e.line_number}
                  style={{
                    marginBottom: '0.5rem',
                    padding: '0.6rem 0.9rem',
                    background: 'var(--color-error-bg)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.2rem' }}>
                    Line {e.line_number}: {e.reason}
                  </p>
                  {e.raw_line.trim() && (
                    <code style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.8rem', color: '#555', marginBottom: '0.25rem' }}>
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
            <li>Organizations registered: <strong>{result.orgs_created ?? 0}</strong></li>
            <li>Sponsors created: <strong>{result.sponsors_created}</strong></li>
            <li>Drivers created: <strong>{result.drivers_created}</strong></li>
          </ul>

          {(result.warnings?.length ?? 0) > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.35rem' }}>
                Warnings ({result.warnings?.length}) — these rows were still processed
              </p>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.875rem' }}>
                {result.warnings?.map((w) => (
                  <li key={`warning-${w.line_number}-${w.reason}`}>
                    <strong>Line {w.line_number}:</strong> {w.reason}
                    {w.raw_line && (
                      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#666', marginTop: '0.15rem' }}>
                        {w.raw_line}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
