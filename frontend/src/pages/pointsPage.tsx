import { useCallback, useEffect, useState } from 'react';
import { pointsService } from '../services/pointsService';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import type { ApiError } from '../types';

interface PointTransaction {
  transaction_id: number;
  points_change: number;
  reason: string;
  created_at: string;
  transaction_type: 'earned' | 'redeemed' | 'adjustment';
}

interface PointsData {
  current_balance: number;
  transactions: PointTransaction[];
}

interface GroupedTransactions {
  [monthYear: string]: PointTransaction[];
}

export function PointsPage() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pointsData = await pointsService.getPoints();
      setData(pointsData);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load points information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Group transactions by month
  const groupByMonth = (transactions: PointTransaction[]): GroupedTransactions => {
    const grouped: GroupedTransactions = {};
    
    transactions.forEach((transaction) => {
      const date = new Date(transaction.created_at);
      const monthYear = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(transaction);
    });
    
    return grouped;
  };

  if (loading) {
    return <Spinner label="Loading points..." />;
  }

  if (error) {
    return (
      <section className="card" aria-labelledby="points-heading">
        <h2 id="points-heading">My Points</h2>
        <Alert variant="error">{error}</Alert>
        <div className="mt-2">
          <Button onClick={fetchPoints}>Retry</Button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const groupedTransactions = groupByMonth(data.transactions);
  const monthYears = Object.keys(groupedTransactions).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });

  return (
    <section aria-labelledby="points-heading">
      <h2 id="points-heading">My Points</h2>

      {/* Points Balance Card */}
      <div className="card points-balance-card mt-1">
        <div className="points-balance">
          <span className="points-label">Current Balance</span>
          <span className="points-amount">{data.current_balance.toLocaleString()}</span>
          <span className="points-unit">points</span>
        </div>
      </div>

      {/* Points History */}
      <div className="card mt-2">
        <h3>Points History</h3>

        {data.transactions.length === 0 ? (
          <p className="mt-1 text-muted">
            No points transactions yet. Start driving safely to earn points!
          </p>
        ) : (
          <div className="points-history mt-1">
            {monthYears.map((monthYear) => (
              <div key={monthYear} className="month-group">
                <h4 className="month-header">{monthYear}</h4>
                <div className="transactions-list">
                  {groupedTransactions[monthYear].map((transaction) => {
                    const date = new Date(transaction.created_at);
                    const isPositive = transaction.points_change > 0;
                    
                    return (
                      <div 
                        key={transaction.transaction_id} 
                        className={`transaction-item ${isPositive ? 'earned' : 'spent'}`}
                      >
                        <div className="transaction-date">
                          {date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          <span className="transaction-time">
                            {date.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="transaction-details">
                          <div className="transaction-reason">{transaction.reason}</div>
                          <div className="transaction-type">{transaction.transaction_type}</div>
                        </div>
                        <div className={`transaction-points ${isPositive ? 'positive' : 'negative'}`}>
                          {isPositive ? '+' : ''}{transaction.points_change.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
