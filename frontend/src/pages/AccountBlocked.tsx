import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/apiClient';
import { Alert } from '../components/Alert';

const BLOCKED_STATE_KEY = 'gdip_blocked_state';

interface BlockedState {
  status?: string;
  role?: string;
  message?: string;
}

function readBlockedState(): BlockedState {
  try {
    const raw = sessionStorage.getItem(BLOCKED_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BlockedState;
  } catch {
    return {};
  }
}

export function AccountBlockedPage() {
  const state = readBlockedState();
  const status = (state.status || 'inactive').toLowerCase();
  const role = (state.role || 'user').toLowerCase();
  const [appealMessage, setAppealMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const title = status === 'banned' ? 'Account Restricted' : 'Account Temporarily Inactive';
  const detail =
    state.message ||
    (status === 'banned'
      ? 'Your account is currently banned and cannot access normal app features.'
      : 'Your account is currently inactive and normal app features are disabled.');

  const submittedMessage =
    role === 'driver'
      ? 'Driver review request sent successfully. An admin will review your account.'
      : role === 'sponsor'
        ? 'Sponsor review request sent successfully. An admin will review your account.'
        : 'Appeal submitted successfully. An admin will review your account.';

  const submitAppeal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitResult(null);
    setSubmitError(null);
    const message = appealMessage.trim();
    if (message.length < 10) {
      setSubmitError('Please include at least 10 characters in your message.');
      return;
    }

    try {
      setSending(true);
      await api.post<{ message: string }>('/account-appeals', { message });
      setSubmitResult(submittedMessage);
      setAppealMessage('');
    } catch (err) {
      const e = err as { message?: string };
      setSubmitError(e.message || 'Could not submit your request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="card login-card" aria-labelledby="blocked-heading">
      <h2 id="blocked-heading">{title}</h2>
      <p className="mt-1">
        Role: <strong>{role}</strong>
      </p>
      <p className="mt-2">{detail}</p>
      <p className="helper-text mt-2">
        If an admin restores your account, your data remains intact and your normal access will return automatically.
      </p>
      <form onSubmit={submitAppeal} className="mt-2">
        <label htmlFor="appeal-message" style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>
          Request Review
        </label>
        <textarea
          id="appeal-message"
          rows={4}
          value={appealMessage}
          onChange={(e) => setAppealMessage(e.target.value)}
          placeholder="Explain why your account should be reviewed..."
          style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-border)', padding: '0.6rem' }}
          maxLength={2000}
          disabled={sending}
        />
        {submitError && <div className="mt-2"><Alert variant="error">{submitError}</Alert></div>}
        {submitResult && <div className="mt-2"><Alert variant="success">{submitResult}</Alert></div>}
        <div className="btn-group">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send To Admin'}
          </button>
        </div>
      </form>
      <div className="btn-group">
        <Link to="/login" className="btn btn-primary">Back To Login</Link>
        <Link to="/about" className="btn btn-secondary">Contact / Help Info</Link>
      </div>
    </section>
  );
}
