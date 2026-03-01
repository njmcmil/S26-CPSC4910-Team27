-- Migration: Create Orders table
-- Purpose: Track catalog redemption orders per driver with status lifecycle
-- driver cancel, sponsor purchase history, cancel order

USE Team27_DB;

CREATE TABLE IF NOT EXISTS Orders (
    order_id       INT AUTO_INCREMENT PRIMARY KEY,
    driver_user_id INT NOT NULL,
    sponsor_user_id INT NOT NULL,
    item_id        VARCHAR(64) NOT NULL,
    item_title     VARCHAR(255) NOT NULL,
    points_cost    INT NOT NULL,
    status         ENUM('pending', 'shipped', 'cancelled') NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_user_id)  REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (sponsor_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_driver   (driver_user_id),
    INDEX idx_sponsor  (sponsor_user_id),
    INDEX idx_status   (status),
    INDEX idx_created  (created_at)
);
