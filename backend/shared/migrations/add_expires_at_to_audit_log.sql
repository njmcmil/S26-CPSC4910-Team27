-- Migration: Add expires_at column to audit_log
-- Purpose: Track per-transaction point expiration dates (#13990)

USE Team27_DB;

ALTER TABLE audit_log
    ADD COLUMN expires_at DATETIME DEFAULT NULL;

-- expires_at: when awarded points expire; NULL = no expiration
-- Only meaningful for point_change entries with positive points_changed