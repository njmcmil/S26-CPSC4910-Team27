import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { FormField } from './FormField';
import { Spinner } from './Spinner';

interface ExpirationPolicy {
    id: number;
    sponsor_id: number;
    company_name: string;
    expiration_months: number;
    auto_expire_enabled: boolean;
}

export const AdminPointDashboard: React.FC = () => {
    const [policies, setPolicies] = useState<ExpirationPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [sponsorId, setSponsorId] = useState<number>(0);
    const [expirationMonths, setExpirationMonths] = useState<number>(12);
    const [autoExpire, setAutoExpire] = useState<boolean>(true);
    const [running, setRunning] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const response = await fetch('/api/admin/point-expiration/settings', {
                credentials: 'include'
            });
            const data = await response.json();
            setPolicies(data.policies);
        } catch (error) {
            console.error('Error fetching policies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSetPolicy = async () => {
        if (sponsorId <= 0) {
            alert('Please enter a valid sponsor ID');
            return;
        }

        try {
            const response = await fetch('/api/admin/point-expiration/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    sponsor_id: sponsorId,
                    expiration_months: expirationMonths,
                    auto_expire: autoExpire
                })
            });

            if (response.ok) {
                alert('✅ Policy updated successfully!');
                fetchPolicies();
                setSponsorId(0);
                setExpirationMonths(12);
                setAutoExpire(true);
                setShowAddForm(false);
            }
        } catch (error) {
            console.error('Error setting policy:', error);
            alert('Failed to set policy');
        }
    };

    const handleRunExpiration = async () => {
        if (!confirm('⚠️ Run point expiration?\n\nThis will deduct expired points from all eligible drivers based on their sponsor\'s expiration policy.\n\nContinue?')) {
            return;
        }

        setRunning(true);
        try {
            const response = await fetch('/api/admin/point-expiration/run', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();
            if (response.ok) {
                if (data.expired_count === 0) {
                    alert('✅ Expiration completed!\n\nNo drivers had expired points.');
                } else {
                    const details = data.details.map((d: any) => 
                        `  • ${d.driver_name}: ${d.points_expired} points expired`
                    ).join('\n');
                    alert(`✅ Expiration completed!\n\n${data.expired_count} driver${data.expired_count !== 1 ? 's' : ''} had points expired:\n\n${details}`);
                }
            }
        } catch (error) {
            console.error('Error running expiration:', error);
            alert('❌ Failed to run expiration');
        } finally {
            setRunning(false);
        }
    };

    if (loading) {
        return <Spinner />;
    }

    return (
        <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '30px 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '30px' 
            }}>
                <h2 style={{ fontSize: '28px', fontWeight: '600', margin: 0 }}>
                    Point Expiration Management
                </h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        onClick={() => setShowAddForm(!showAddForm)}
                        variant="primary"
                    >
                        {showAddForm ? '✕ Cancel' : '+ Add Policy'}
                    </Button>
                    <Button
                        onClick={handleRunExpiration}
                        variant="secondary"
                        disabled={running}
                    >
                        {running ? '⏳ Running...' : '▶️ Run Expiration'}
                    </Button>
                </div>
            </div>

            {/* Add Policy Form */}
            {showAddForm && (
                <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px'
                }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '20px' }}>
                        Set Expiration Policy
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <FormField
                            label="Sponsor ID"
                            type="number"
                            value={sponsorId}
                            onChange={(e) => setSponsorId(Number(e.target.value))}
                            placeholder="Enter sponsor ID"
                            min={1}
                        />

                        <FormField
                            label="Expiration Period (Months)"
                            type="number"
                            value={expirationMonths}
                            onChange={(e) => setExpirationMonths(Number(e.target.value))}
                            placeholder="Months until expiration"
                            min={1}
                        />
                    </div>

                    <div style={{ margin: '16px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={autoExpire}
                                onChange={(e) => setAutoExpire(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span>Enable automatic expiration</span>
                        </label>
                    </div>

                    <Button onClick={handleSetPolicy} variant="primary">
                        Save Policy
                    </Button>
                </div>
            )}

            {/* Policies Table */}
            <div style={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {policies.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#666'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                        <div style={{ fontSize: '18px' }}>No expiration policies set</div>
                        <div style={{ fontSize: '14px', marginTop: '8px', color: '#999' }}>
                            Click "Add Policy" to create one
                        </div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                                <th style={{ 
                                    padding: '16px 20px', 
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    color: '#666'
                                }}>
                                    Sponsor
                                </th>
                                <th style={{ 
                                    padding: '16px 20px', 
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    color: '#666'
                                }}>
                                    Expiration Period
                                </th>
                                <th style={{ 
                                    padding: '16px 20px', 
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    color: '#666'
                                }}>
                                    Auto-Expire
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {policies.map((policy, idx) => (
                                <tr 
                                    key={policy.id}
                                    style={{
                                        borderBottom: idx < policies.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa'
                                    }}
                                >
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontWeight: '600' }}>{policy.company_name}</div>
                                        <div style={{ fontSize: '13px', color: '#999' }}>
                                            ID: {policy.sponsor_id}
                                        </div>
                                    </td>
                                    <td style={{ 
                                        padding: '16px 20px', 
                                        textAlign: 'center',
                                        fontSize: '16px',
                                        fontWeight: '600'
                                    }}>
                                        {policy.expiration_months} month{policy.expiration_months !== 1 ? 's' : ''}
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            backgroundColor: policy.auto_expire_enabled ? '#ecfdf5' : '#fef2f2',
                                            color: policy.auto_expire_enabled ? '#10b981' : '#ef4444'
                                        }}>
                                            {policy.auto_expire_enabled ? '✓ Enabled' : '✕ Disabled'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div style={{
                marginTop: '20px',
                padding: '16px',
                backgroundColor: '#f0f4ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#4338ca'
            }}>
                <strong>ℹ️ How it works:</strong> Points older than the expiration period will be deducted when you run expiration. 
                Only sponsors with auto-expire enabled will be processed.
            </div>
        </div>
    );
};
