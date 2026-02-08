-- Migration: Create Profiles table
-- Purpose: Store user profile information (driver, sponsor, admin)

USE Team27_DB;

-- Create the Profiles table
CREATE TABLE IF NOT EXISTS Profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    profile_picture_url VARCHAR(500),
    bio TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_updated_at (updated_at)
);

-- Create Driver-specific profile extension
CREATE TABLE IF NOT EXISTS DriverProfiles (
    driver_profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    license_number VARCHAR(50),
    license_expiry DATE,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INT,
    vehicle_license_plate VARCHAR(20),
    points_balance INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_points_balance (points_balance)
);

-- Create Sponsor-specific profile extension
CREATE TABLE IF NOT EXISTS SponsorProfiles (
    sponsor_profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    company_name VARCHAR(255),
    company_address VARCHAR(255),
    company_city VARCHAR(100),
    company_state VARCHAR(50),
    company_zip VARCHAR(10),
    industry VARCHAR(100),
    contact_person_name VARCHAR(100),
    contact_person_phone VARCHAR(20),
    total_points_allocated INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Verify table creation
DESCRIBE Profiles;
DESCRIBE DriverProfiles;
DESCRIBE SponsorProfiles;

-- Display any errors
SHOW WARNINGS;
