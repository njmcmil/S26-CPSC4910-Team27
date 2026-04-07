-- Add account_status to SponsorProfiles and DriverProfiles
-- Sponsors can be active, inactive, or banned
-- Drivers can be active or inactive

ALTER TABLE SponsorProfiles
  ADD COLUMN account_status ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active';

ALTER TABLE DriverProfiles
  ADD COLUMN account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active';
