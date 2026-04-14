-- Migration: add order success delay and purchase context fields
-- Purpose: support delayed order success notifications with purchase metadata

USE Team27_DB;

ALTER TABLE SponsorProfiles
    ADD COLUMN order_success_delay_minutes INT DEFAULT 60;

ALTER TABLE Orders
    ADD COLUMN purchase_ip_address VARCHAR(64) NULL,
    ADD COLUMN purchase_device_name VARCHAR(100) NULL,
    ADD COLUMN purchase_browser_name VARCHAR(100) NULL,
    ADD COLUMN purchase_os_name VARCHAR(100) NULL;
