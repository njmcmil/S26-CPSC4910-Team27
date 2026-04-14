USE Team27_DB;

CREATE TABLE IF NOT EXISTS sponsor_point_value_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sponsor_id INT NOT NULL,
    old_value DECIMAL(10, 4) NOT NULL,
    new_value DECIMAL(10, 4) NOT NULL,
    changed_by_user_id INT NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sponsor_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_sponsor_changed_at (sponsor_id, changed_at DESC)
);
