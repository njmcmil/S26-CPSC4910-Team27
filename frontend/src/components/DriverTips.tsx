import { useEffect, useState } from 'react';
import { Tip, tipsService } from '../services/tipsService';
import { Alert } from './Alert';
import { useAuth } from '../auth/AuthContext';

export default function DriverTips() {
  const { activeSponsorId } = useAuth();
  const [tip, setTip] = useState<Tip | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTip();
  }, [activeSponsorId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /* -------------------------------- */
  /* Load One Active Tip */
  /* -------------------------------- */
  const loadTip = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await tipsService.getTips(activeSponsorId ?? undefined);

      // Only show ONE tip at a time (first in list)
      if (data.length > 0) {
        setTip(data[0]);
        setOpen(true);
      } else {
        setTip(null);
        setOpen(false);
      }
    } catch (err) {
      console.error('Failed to load tips', err);
      setError('Could not load tips right now. Please try again.');
      setTip(null);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------- */
  /* Mark Tip Viewed */
  /* -------------------------------- */
  const handleViewTip = async () => {
    if (!tip) return;

    try {
      await tipsService.markViewed(tip.tip_id);
      setTip(null);
      setOpen(false);
    } catch (err) {
      console.error('Failed to mark tip viewed', err);
      setError('Could not mark tip as viewed. Please try again.');
    }
  };

  const handleDismiss = () => {
    setOpen(false);
  };

  return (
    <div>
      {error && <Alert variant="error">{error}</Alert>}
      {loading && <p>Loading tips...</p>}

      {!loading && tip && !open && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          Show Driving Tip
        </button>
      )}

      {!loading && tip && open && (
        <div
          className="tip-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-tip-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="tip-modal-card">
            <h3 id="driver-tip-title">Driving Tip</h3>

            {tip.category && (
              <p className="tip-category">{tip.category}</p>
            )}

            <p className="tip-text">{tip.tip_text}</p>

            <div className="tip-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDismiss}>
                Dismiss
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleViewTip}>
                Mark as Viewed
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !tip && (
        <p className="helper-text">
          You're all caught up! Check back later for more tips.
        </p>
      )}
    </div>
  );
}
