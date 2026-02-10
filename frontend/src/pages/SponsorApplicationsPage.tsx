import { useEffect, useState } from 'react';
import { sponsorService } from '../../services/sponsorService';

interface DriverApplication {
  application_id: number;
  driver_user_id: number;
  username: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export function SponsorApplicationsPage() {
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Load pending applications ── */
  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await sponsorService.getPendingApplications();
      setApplications(data);
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

          <div className="actions mt-1">
            <button
              className="btn-primary"
              onClick={() => approve(app.application_id)}
            >
              Approve
            </button>

            <button
              className="btn-danger ml-2"
              onClick={() => reject(app.application_id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
