-- Migration: Add allow_negative_points to SponsorProfiles
-- Purpose: Allow sponsors to configure whether driver points can go negative

USE Team27_DB;

ALTER TABLE SponsorProfiles
    ADD COLUMN allow_negative_points TINYINT(1) NOT NULL DEFAULT 0;
