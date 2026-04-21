import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient';

interface SponsorInfo {
  name: string;
  driver_count: number;
}

export function AboutPage() {
  const [sponsors, setSponsors] = useState<SponsorInfo[]>([]);

  useEffect(() => {
    api.get<{ sponsors: SponsorInfo[] }>('/about/public')
      .then(data => setSponsors(data.sponsors ?? []))
      .catch(() => {});
  }, []);

  return (
    <section aria-labelledby="about-heading" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 600 }}>
          ← Back
        </Link>
      </div>
      <h2 id="about-heading">About the Good Driver Incentive Program</h2>

      <div className="card mt-2">
        <h3>What We Do</h3>
        <p className="mt-1" style={{ lineHeight: 1.7 }}>
          The Good Driver Incentive Program is a web-based platform built for the trucking industry.
          Sponsors (companies that work with truck drivers) use our system to reward drivers for
          safe and positive on-road behaviors. Drivers earn points for good performance and can redeem
          those points for real products through a sponsor-curated catalog. Think of it like a rewards
          program, but built specifically to encourage better driving across the industry.
        </p>
        <p className="mt-1" style={{ lineHeight: 1.7 }}>
          Sponsors maintain their own product catalogs, manage driver relationships, and control how
          points are awarded and redeemed. Drivers can browse their sponsor's catalog, track their
          point history, and place orders all in one place! Admins oversee the entire platform to
          ensure everything runs smoothly.
        </p>
      </div>

      <div className="card mt-2">
        <h3>Our Team</h3>
        <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Built by Team 27 for CPSC 4910 — Spring 2026
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
          {['Jade Ashley', 'Bella John', 'Bobby Lin', 'Nathan McMillan'].map(name => (
            <div key={name} style={{
              background: 'var(--color-bg)', borderRadius: 8, padding: '0.75rem 1.25rem',
              border: '1px solid var(--color-border)', fontWeight: 600,
            }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {sponsors.length > 0 && (
        <div className="card mt-2">
          <h3>Our Sponsors</h3>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            The following companies are currently using the Good Driver Incentive Program.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sponsors.map(s => (
              <div key={s.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 1rem', background: 'var(--color-bg)',
                borderRadius: 8, border: '1px solid var(--color-border)',
              }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {s.driver_count} driver{s.driver_count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
