-- Persist skipped/failed bulk upload rows for detailed error reporting

CREATE TABLE IF NOT EXISTS BulkUploadErrors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    line_number INT NOT NULL,
    raw_line TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
