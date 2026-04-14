CREATE TABLE IF NOT EXISTS impersonation_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sponsor_user_id INT NOT NULL,
    driver_user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);