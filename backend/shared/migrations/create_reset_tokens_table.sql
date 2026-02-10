-- Password Reset Tokens Table
-- Team27 Good Driver Incentive Program
--
-- Run this once to create the table for storing password reset tokens

USE Team27_DB;

-- Create the main table
CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    token_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Add indexes for faster lookups
CREATE INDEX idx_token ON PasswordResetTokens(token);
CREATE INDEX idx_expires_at ON PasswordResetTokens(expires_at);
CREATE INDEX idx_user_id ON PasswordResetTokens(user_id);

-- Verify it worked
DESCRIBE PasswordResetTokens;
SHOW INDEXES FROM PasswordResetTokens;


-- ============================================================================
-- OPTIONAL: Test data 
-- ============================================================================
-- Inserts a test token (replace user_id with a real one)

-- INSERT INTO PasswordResetTokens (user_id, token, expires_at, used)
-- VALUES (1, 'test-token-12345', DATE_ADD(NOW(), INTERVAL 24 HOUR), FALSE);

-- SELECT * FROM PasswordResetTokens;

-- ============================================================================
-- OPTIONAL: Cleanup old tokens
-- ============================================================================
-- Run this occasionally to remove expired/used tokens

-- DELETE FROM PasswordResetTokens WHERE expires_at < NOW() OR used = TRUE;
