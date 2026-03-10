-- Migration: Create SavedProducts table

USE Team27_DB;

CREATE TABLE IF NOT EXISTS SavedProducts (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    driver_user_id    INT NOT NULL,
    sponsor_user_id   INT NOT NULL,
    item_id           VARCHAR(64) NOT NULL,
    notified_low_stock BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_driver_item (driver_user_id, item_id),
    FOREIGN KEY (driver_user_id)  REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (sponsor_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_item (item_id)
);