import { useState } from 'react';
import { tipsService } from '../../services/tipsService';

export default function SponsorTips() {
  const [tipText, setTipText] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCreateTip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await tipsService.createTip({
        tip_text: tipText,
        category: category || undefined,
        active,
      });

      setMessage('Tip created successfully');

      // reset form
      setTipText('');
      setCategory('');
      setActive(true);
    } catch (err) {
      console.error('Failed to create tip', err);
      const apiErr = err as { message?: string; detail?: string };
      setMessage(apiErr?.message || apiErr?.detail || 'Failed to create tip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Sponsor Tip Management</h2>

      <form onSubmit={handleCreateTip} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

        <textarea
          placeholder="Enter tip text..."
          value={tipText}
          onChange={(e) => setTipText(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <label>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Tip'}
        </button>

      </form>

      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}
