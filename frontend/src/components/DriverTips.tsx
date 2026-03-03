import { useEffect, useState } from 'react';
import { Tip, tipsService } from '../services/tipsService';

export default function DriverTips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTip();
  }, []);

  /* -------------------------------- */
  /* Load One Active Tip */
  /* -------------------------------- */
  const loadTip = async () => {
    setLoading(true);
    try {
      const data = await tipsService.getTips();

      // Only show ONE tip at a time (first in list)
      if (data.length > 0) {
        setTip(data[0]);
      } else {
        setTip(null);
      }
    } catch (err) {
      console.error('Failed to load tips', err);
      setTip(null);
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

      // After viewing → reload to get next tip
      loadTip();
    } catch (err) {
      console.error('Failed to mark tip viewed', err);
    }
  };

  return (
    <div>
      <h2>Driving Tips</h2>

      {loading && <p>Loading tips...</p>}

      {!loading && tip && (
        <div
          onClick={handleViewTip}
          style={{
            border: '1px solid #ddd',
            padding: '1rem',
            borderRadius: '8px',
            background: '#f9f9f9',
            cursor: 'pointer',
          }}
        >
          {tip.category && (
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
              {tip.category}
            </div>
          )}

          <p style={{ marginTop: '0.5rem' }}>
            {tip.tip_text}
          </p>

          <small style={{ color: '#666' }}>
            Click to mark as viewed
          </small>
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