-- Migration: create TokenBlacklist table for JWT invalidation

USE Team27_DB;

CREATE TABLE IF NOT EXISTS TokenBlacklist (
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_token (token)
);
