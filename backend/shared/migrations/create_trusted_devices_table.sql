-- Migration: Create TrustedDevices table
-- Purpose: Store trusted devices for remember-me functionality and device management

USE Team27_DB;

-- Create TrustedDevices table
CREATE TABLE IF NOT EXISTS TrustedDevices (
    device_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50),
    device_fingerprint VARCHAR(255) UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_device_fingerprint (device_fingerprint),
    INDEX idx_is_active (is_active),
    INDEX idx_expires_at (expires_at)
);

-- Add index for quick lookups by user + device
CREATE INDEX idx_user_device ON TrustedDevices(user_id, device_id);

-- Verify table creation
DESCRIBE TrustedDevices;

-- Display any errors
SHOW WARNINGS;