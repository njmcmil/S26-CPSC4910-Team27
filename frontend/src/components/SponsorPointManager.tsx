import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { FormField } from './FormField';

interface Driver {
    driver_id: number;
    first_name: string;
    last_name: string;
    total_points: number;
}

interface SponsorSettings {
    allow_negative_points: boolean;
}

export const SponsorPointManager: React.FC = () => {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [points, setPoints] = useState<number>(0);
    const [reason, setReason] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [settings, setSettings] = useState<SponsorSettings>({ allow_negative_points: false });
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        fetchDrivers();
        fetchSettings();
    }, []);

    const fetchDrivers = async () => {
        try {
            const response = await fetch('/api/sponsor/drivers', {
                credentials: 'include'
            });
            const data = await response.json();
            setDrivers(data.drivers || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/sponsor/settings', {
                credentials: 'include'
            });
            const data = await response.json();
            setSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const updateSettings = async () => {
        try {
            const response = await fetch('/api/sponsor/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                alert('Settings updated successfully!');
                setShowSettings(false);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    };

    const handlePointChange = async (action: 'add' | 'deduct') => {
        if (!selectedDriver) {
            setError('Please select a driver');
            return;
        }

        if (!reason.trim()) {
            setError('Reason is required');
            return;
        }

        if (points <= 0) {
            setError('Points must be greater than 0');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const endpoint = action === 'add' ? '/api/sponsor/points/add' : '/api/sponsor/points/deduct';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    driver_id: selectedDriver.driver_id,
                    points: points,
                    reason: reason
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Failed to ${action} points`);
            }

            alert(`✅ ${action === 'add' ? 'Added' : 'Deducted'} ${points} points!\n\nNew balance: ${data.new_total} points`);
            setPoints(0);
            setReason('');
            fetchDrivers(); // Refresh driver list
            
            // Update selected driver
            setSelectedDriver(prev => prev ? { ...prev, total_points: data.new_total } : null);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '30px 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '600', margin: 0 }}>
                    Point Management
                </h2>
                <Button 
                    onClick={() => setShowSettings(!showSettings)}
                    variant="secondary"
                >
                    ⚙️ Settings
                </Button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px' }}>Point Settings</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.allow_negative_points}
                            onChange={(e) => setSettings({ ...settings, allow_negative_points: e.target.checked })}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <span>Allow drivers to have negative points</span>
                    </label>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', marginBottom: '16px' }}>
                        When disabled, you cannot deduct more points than a driver currently has.
                    </p>
                    <Button onClick={updateSettings} variant="primary">
                        Save Settings
                    </Button>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '30px'
            }}>
                {/* Driver Selection */}
                <div style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '24px',
                    backgroundColor: 'white'
                }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '16px' }}>
                        Select Driver
                    </h3>
                    
                    <div style={{
                        maxHeight: '500px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        {drivers.map((driver) => (
                            <div
                                key={driver.driver_id}
                                onClick={() => setSelectedDriver(driver)}
                                style={{
                                    padding: '16px',
                                    border: selectedDriver?.driver_id === driver.driver_id 
                                        ? '2px solid #667eea' 
                                        : '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedDriver?.driver_id === driver.driver_id 
                                        ? '#f0f4ff' 
                                        : 'white',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {driver.first_name} {driver.last_name}
                                </div>
                                <div style={{
                                    fontSize: '14px',
                                    color: driver.total_points < 0 ? '#ef4444' : '#10b981',
                                    fontWeight: '600'
                                }}>
                                    {driver.total_points} points
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Point Management Form */}
                <div style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '24px',
                    backgroundColor: 'white'
                }}>
                    {selectedDriver ? (
                        <>
                            <div style={{
                                backgroundColor: '#f8f9fa',
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: '20px'
                            }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                                    Managing points for:
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                                    {selectedDriver.first_name} {selectedDriver.last_name}
                                </div>
                                <div style={{ 
                                    fontSize: '24px', 
                                    fontWeight: 'bold',
                                    color: selectedDriver.total_points < 0 ? '#ef4444' : '#10b981',
                                    marginTop: '8px'
                                }}>
                                    Current: {selectedDriver.total_points} points
                                </div>
                            </div>

                            <FormField
                                label="Points Amount"
                                type="number"
                                value={points}
                                onChange={(e) => setPoints(Math.max(0, Number(e.target.value)))}
                                placeholder="Enter points"
                                min={0}
                            />

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontWeight: '500',
                                    marginBottom: '8px',
                                    fontSize: '14px'
                                }}>
                                    Reason (Required) *
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Enter reason for point change..."
                                    required
                                    style={{
                                        width: '100%',
                                        minHeight: '100px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid #e0e0e0',
                                        fontSize: '14px',
                                        fontFamily: 'inherit',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {error && (
                                <div style={{
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    fontSize: '14px'
                                }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Button
                                    onClick={() => handlePointChange('add')}
                                    disabled={loading}
                                    variant="primary"
                                    style={{ flex: 1 }}
                                >
                                    {loading ? '⏳ Processing...' : '✅ Add Points'}
                                </Button>

                                <Button
                                    onClick={() => handlePointChange('deduct')}
                                    disabled={loading}
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                >
                                    {loading ? '⏳ Processing...' : '❌ Deduct Points'}
                                </Button>
                            </div>

                            {!settings.allow_negative_points && (
                                <div style={{
                                    fontSize: '12px',
                                    color: '#666',
                                    marginTop: '12px',
                                    padding: '8px',
                                    backgroundColor: '#f9f9f9',
                                    borderRadius: '6px'
                                }}>
                                    ℹ️ Negative points are currently disabled. Maximum deduction: {selectedDriver.total_points} points
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#999'
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
                            <div>Select a driver to manage their points</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
