import { useEffect, useState } from 'react';
import { sponsorService } from '../services/sponsorService';
import { Button } from '../components/Button';


interface DriverApplication {
  application_id: number;
  driver_user_id: number;
  username: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

interface DriverStatusChange {
  date: string;
  driver_user_id: number;
  username: string;
  status: 'approved' | 'rejected' | 'updated';
  reason: string;
}

export function SponsorApplicationsPage() {
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [statusChanges, setStatusChanges] = useState<DriverStatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Load pending applications ── */
  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sponsorService.getPendingApplications();
      setApplications(data);
      const changes = await sponsorService.getDriverStatusChanges();
      setStatusChanges(changes);
    } catch (err) {
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  /* ── Approve ── */
  const approve = async (applicationId: number) => {
    await sponsorService.approveApplication(applicationId);
    loadApplications(); // refresh list
  };

  /* ── Reject ── */
  const reject = async (applicationId: number) => {
    const reason = prompt('Enter rejection reason');
    if (!reason) return;

    await sponsorService.rejectApplication(
      applicationId,
      'Incomplete Documents',
      reason
    );

    loadApplications(); // refresh list
  };

  /* ── UI ── */
  if (loading) return <p>Loading applications…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <section className="card">
      <h2>Driver Applications</h2>
      <p className="mt-1">
        Review and approve or reject driver applications.
      </p>

      {applications.length === 0 && (
        <p className="mt-2">No pending applications.</p>
      )}

      {applications.map(app => (
        <div key={app.application_id} className="app-card mt-2">
          <p>
            <strong>{app.username}</strong> ({app.email})
          </p>

          <div className="mt-1" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              onClick={() => approve(app.application_id)}
            >
              Approve
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() => reject(app.application_id)}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}

      <div className="card mt-3">
        <h3>Recent Status Changes</h3>
        <p className="mt-1">Latest approval and rejection updates for your drivers.</p>

        {statusChanges.length === 0 ? (
          <p className="mt-2">No status changes logged yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color, #ddd)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>Driver</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {statusChanges.map((change, index) => (
                <tr key={`${change.driver_user_id}-${change.date}-${index}`} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(change.date).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{change.username}</td>
                  <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{change.status}</td>
                  <td style={{ padding: '0.5rem' }}>{change.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
