-- Communication logs between drivers and sponsors
CREATE TABLE IF NOT EXISTS CommunicationLogs (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    driver_user_id  INT NOT NULL,
    sponsor_user_id INT NOT NULL,
    sent_by_role    ENUM('driver', 'sponsor') NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_user_id)  REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (sponsor_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_driver  (driver_user_id),
    INDEX idx_sponsor (sponsor_user_id),
    INDEX idx_created (created_at)
);