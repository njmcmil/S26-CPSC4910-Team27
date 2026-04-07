import { useEffect, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { tipsService } from '../../services/tipsService';
import type { Tip } from '../../services/tipsService';

export default function SponsorTips() {
  const [tipText, setTipText] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingTipId, setActingTipId] = useState<number | null>(null);

  const loadTips = async () => {
    setTipsLoading(true);
    try {
      const data = await tipsService.getSponsorTips();
      setTips(data);
    } catch (err) {
      console.error('Failed to load tips', err);
    } finally {
      setTipsLoading(false);
    }
  };

  useEffect(() => {
    loadTips();
  }, []);

  const handleCreateTip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      await tipsService.createTip({
        tip_text: tipText,
        category: category || undefined,
        active,
      });

      setMessage('Tip created successfully.');
      setTipText('');
      setCategory('');
      setActive(true);
      await loadTips();
    } catch (err) {
      console.error('Failed to create tip', err);
      const apiErr = err as { message?: string; detail?: string };
      setError(apiErr?.message || apiErr?.detail || 'Failed to create tip.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (tip: Tip) => {
    setActingTipId(tip.tip_id);
    setMessage(null);
    setError(null);
    try {
      let updatedTip: Tip;
      if (tip.active) {
        updatedTip = await tipsService.disableSponsorTip(tip.tip_id);
        setMessage('Tip disabled.');
      } else {
        updatedTip = await tipsService.enableSponsorTip(tip.tip_id);
        setMessage('Tip enabled.');
      }
      setTips((prev) =>
        prev.map((currentTip) =>
          currentTip.tip_id === updatedTip.tip_id ? updatedTip : currentTip,
        ),
      );
    } catch (err) {
      console.error('Failed to update tip', err);
      const apiErr = err as { message?: string; detail?: string };
      setError(apiErr?.message || apiErr?.detail || 'Failed to update tip.');
    } finally {
      setActingTipId(null);
    }
  };

  const handleDeleteTip = async (tip: Tip) => {
    const confirmed = window.confirm(`Delete this tip: "${tip.tip_text}"?`);
    if (!confirmed) return;

    setActingTipId(tip.tip_id);
    setMessage(null);
    setError(null);
    try {
      await tipsService.deleteSponsorTip(tip.tip_id);
      setMessage('Tip deleted.');
      setTips((prev) => prev.filter((currentTip) => currentTip.tip_id !== tip.tip_id));
    } catch (err) {
      console.error('Failed to delete tip', err);
      const apiErr = err as { message?: string; detail?: string };
      setError(apiErr?.message || apiErr?.detail || 'Failed to delete tip.');
    } finally {
      setActingTipId(null);
    }
  };

  return (
    <div className="dashboard-overview-grid">
      <div
        style={{
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
          border: '1px solid #d7e6f2',
          borderRadius: 10,
          padding: '1rem 1rem 1.1rem',
        }}
      >
        <h3 style={{ marginBottom: '0.35rem' }}>Create Sponsor Tip</h3>
        <p className="helper-text" style={{ marginBottom: '1rem' }}>
          Add a short tip to guide drivers around catalog choices, redemption behavior, or point usage.
        </p>

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleCreateTip} className="dashboard-action-list">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="sponsor-tip-text">Tip Text</label>
            <textarea
              id="sponsor-tip-text"
              placeholder="Example: Save points for higher-value rewards when possible."
              value={tipText}
              onChange={(e) => setTipText(e.target.value)}
              required
              rows={5}
            />
          </div>

          <div className="dashboard-overview-grid" style={{ gridTemplateColumns: 'minmax(12rem, 1fr) auto' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="sponsor-tip-category">Category</label>
              <input
                id="sponsor-tip-category"
                type="text"
                placeholder="Catalog, Points, Rewards..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <label
              htmlFor="sponsor-tip-active"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                alignSelf: 'end',
                paddingBottom: '0.6rem',
              }}
            >
              <input
                id="sponsor-tip-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button type="submit" loading={loading}>
              {loading ? 'Creating Tip...' : 'Create Tip'}
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.35rem' }}>Existing Sponsor Tips</h3>
        <p className="helper-text" style={{ marginBottom: '1rem' }}>
          Review the active guidance drivers can see while navigating rewards and points.
        </p>

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {tipsLoading ? (
          <p className="placeholder-msg">Loading tips...</p>
        ) : tips.length === 0 ? (
          <p className="placeholder-msg">No tips created yet. Your next tip will appear here.</p>
        ) : (
          <div className="dashboard-list">
            {tips.map((tip) => (
              <div key={tip.tip_id} className="dashboard-list-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="dashboard-list-title">{tip.category || 'General Tip'}</div>
                    <span className={`status-pill ${tip.active ? 'status-shipped' : 'status-cancelled'}`}>
                      {tip.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="dashboard-list-sub" style={{ marginTop: '0.35rem' }}>
                    {tip.tip_text}
                  </div>
                  <div className="dashboard-list-sub" style={{ marginTop: '0.45rem' }}>
                    Created {new Date(tip.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleToggleActive(tip)}
                      disabled={actingTipId === tip.tip_id}
                    >
                      {actingTipId === tip.tip_id
                        ? 'Saving...'
                        : tip.active
                          ? 'Disable Tip'
                          : 'Enable Tip'}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => handleDeleteTip(tip)}
                      disabled={actingTipId === tip.tip_id}
                    >
                      Delete Tip
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
