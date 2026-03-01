-- Migration: Create APIErrorLog table
-- Purpose: Persist catalog API (eBay) call failures for the error log dashboard


USE Team27_DB;

CREATE TABLE IF NOT EXISTS APIErrorLog (
    error_id     INT AUTO_INCREMENT PRIMARY KEY,
    occurred_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sponsor_id   INT NULL,                          -- NULL = not triggered by a specific sponsor
    operation    VARCHAR(100) NOT NULL,             -- e.g. 'ebay_search', 'ebay_product_detail'
    endpoint     VARCHAR(255) NOT NULL,             -- URL called
    error_message TEXT NOT NULL,
    status_code  INT NULL,                          -- HTTP status from upstream, if available
    request_id   VARCHAR(64) NULL,                  -- correlation id for tracing
    INDEX idx_occurred  (occurred_at),
    INDEX idx_sponsor   (sponsor_id),
    INDEX idx_operation (operation)
);
