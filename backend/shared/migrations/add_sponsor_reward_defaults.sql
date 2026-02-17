-- Migration: Add default reward settings to SponsorProfiles
-- Purpose: Store per-sponsor reward configuration with sensible

USE Team27_DB;

-- Add default reward setting columns to SponsorProfiles
ALTER TABLE SponsorProfiles
    ADD COLUMN dollar_per_point DECIMAL(10,2) DEFAULT 0.01,
    ADD COLUMN earn_rate DECIMAL(10,2) DEFAULT 1.00,
    ADD COLUMN expiration_days INT DEFAULT NULL,
    ADD COLUMN max_points_per_day INT DEFAULT NULL,
    ADD COLUMN max_points_per_month INT DEFAULT NULL;

-- dollar_per_point: how many dollars one point is worth (default $0.01)
-- earn_rate: multiplier for point awards (default 1.0x)
-- expiration_days: points expire N days after award; NULL = no expiration
-- max_points_per_day: daily cap on points a driver can earn; NULL = unlimited
-- max_points_per_month: monthly cap on points a driver can earn; NULL = unlimited