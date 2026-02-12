import React, { useEffect, useState } from 'react';
import { Spinner } from './Spinner';

interface MonthlyHistory {
    month: string;
    month_name: string;
    points_earned: number;
    points_deducted: number;
    net_change: number;
    transaction_count: number;
}

interface Transaction {
    date: string;
    points_changed: number;
    reason: string;
}

export const DriverPointHistory: React.FC = () => {
    const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistory[]>([]);
    const [allTransactions, setAllTransactions] = useState<{[key: string]: Transaction[]}>({});
    const [loading, setLoading] = useState(true);
    const [currentPoints, setCurrentPoints] = useState(0);
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchPointHistory();
    }, []);

    const fetchPointHistory = async () => {
        try {
            // Get current points and monthly summary
            const historyResponse = await fetch('/api/driver/points/history', {
                credentials: 'include'
            });
            const historyData = await historyResponse.json();
            setCurrentPoints(historyData.current_points);

            const monthlyResponse = await fetch('/api/driver/points/history-monthly', {
                credentials: 'include'
            });
            const monthlyData = await monthlyResponse.json();
            setMonthlyHistory(monthlyData.monthly_history);

            // Fetch details for each month
            const transactionsByMonth: {[key: string]: Transaction[]} = {};
            for (const month of monthlyData.monthly_history) {
                const detailResponse = await fetch(`/api/driver/points/month/${month.month}`, {
                    credentials: 'include'
                });
                const detailData = await detailResponse.json();
                transactionsByMonth[month.month] = detailData.transactions;
            }
            setAllTransactions(transactionsByMonth);

        } catch (error) {
            console.error('Error fetching point history:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleMonth = (month: string) => {
        const newExpanded = new Set(expandedMonths);
        if (newExpanded.has(month)) {
            newExpanded.delete(month);
        } else {
            newExpanded.add(month);
        }
        setExpandedMonths(newExpanded);
    };

    if (loading) {
        return <Spinner />;
    }

    return (
        <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '30px 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Current Points Header */}
            <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                color: 'white',
                marginBottom: '40px',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
            }}>
                <div style={{ fontSize: '16px', opacity: 0.9, marginBottom: '10px' }}>
                    Your Current Balance
                </div>
                <div style={{ fontSize: '64px', fontWeight: 'bold', letterSpacing: '-2px' }}>
                    {currentPoints.toLocaleString()}
                </div>
                <div style={{ fontSize: '18px', opacity: 0.9, marginTop: '5px' }}>
                    points
                </div>
            </div>

            {/* Monthly Breakdown */}
            <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                marginBottom: '20px',
                color: '#1a1a1a'
            }}>
                Point History
            </h2>

            {monthlyHistory.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#666',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '12px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
                    <div style={{ fontSize: '18px' }}>No point history yet</div>
                    <div style={{ fontSize: '14px', marginTop: '8px' }}>
                        Points you earn will appear here
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {monthlyHistory.map((month) => {
                        const isExpanded = expandedMonths.has(month.month);
                        const transactions = allTransactions[month.month] || [];

                        return (
                            <div
                                key={month.month}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    backgroundColor: 'white',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                {/* Month Header - Clickable */}
                                <div
                                    onClick={() => toggleMonth(month.month)}
                                    style={{
                                        padding: '20px 24px',
                                        cursor: 'pointer',
                                        backgroundColor: isExpanded ? '#f8f9fa' : 'white',
                                        borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none',
                                        transition: 'background-color 0.2s ease'
                                    }}
                                >
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginBottom: '12px'
                                    }}>
                                        <h3 style={{ 
                                            margin: 0, 
                                            fontSize: '18px', 
                                            fontWeight: '600',
                                            color: '#1a1a1a'
                                        }}>
                                            {month.month_name}
                                        </h3>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}>
                                            <span style={{
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: month.net_change >= 0 ? '#10b981' : '#ef4444'
                                            }}>
                                                {month.net_change >= 0 ? '+' : ''}{month.net_change}
                                            </span>
                                            <span style={{
                                                fontSize: '20px',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                                display: 'inline-block'
                                            }}>
                                                ▼
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mini Summary */}
                                    <div style={{ 
                                        display: 'flex', 
                                        gap: '20px', 
                                        fontSize: '14px',
                                        color: '#666'
                                    }}>
                                        <span>
                                            ✅ Earned: <strong style={{ color: '#10b981' }}>+{month.points_earned}</strong>
                                        </span>
                                        <span>
                                            ❌ Deducted: <strong style={{ color: '#ef4444' }}>-{month.points_deducted}</strong>
                                        </span>
                                        <span>
                                            📝 {month.transaction_count} transaction{month.transaction_count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Transactions */}
                                {isExpanded && (
                                    <div style={{ padding: '0' }}>
                                        {transactions.map((txn, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '16px 24px',
                                                    borderBottom: idx < transactions.length - 1 ? '1px solid #f0f0f0' : 'none',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    gap: '16px',
                                                    backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa'
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ 
                                                        fontSize: '13px', 
                                                        color: '#999',
                                                        marginBottom: '6px'
                                                    }}>
                                                        {new Date(txn.date).toLocaleDateString('en-US', { 
                                                            weekday: 'short',
                                                            year: 'numeric', 
                                                            month: 'short', 
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                    <div style={{ 
                                                        fontSize: '15px', 
                                                        color: '#333',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {txn.reason}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '18px',
                                                    fontWeight: '700',
                                                    color: txn.points_changed >= 0 ? '#10b981' : '#ef4444',
                                                    minWidth: '80px',
                                                    textAlign: 'right',
                                                    padding: '8px 16px',
                                                    backgroundColor: txn.points_changed >= 0 ? '#ecfdf5' : '#fef2f2',
                                                    borderRadius: '8px'
                                                }}>
                                                    {txn.points_changed >= 0 ? '+' : ''}{txn.points_changed}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
