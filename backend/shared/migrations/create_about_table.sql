-- About table: stores project metadata displayed on the public About page
CREATE TABLE IF NOT EXISTS About (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_number INT NOT NULL,
    version_number VARCHAR(50) NOT NULL,
    sprint_number INT NOT NULL,
    release_date DATE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT NOT NULL
);

-- Seed initial row
INSERT INTO About (team_number, version_number, sprint_number, release_date, product_name, product_description)
VALUES (
    27,
    '1.0',
    1,
    CURDATE(),
    'Good Driver Incentive Program',
    'A web application that allows sponsors to incentivize safe driving behavior through a points-based reward system. Drivers earn points for good driving habits and can redeem them in sponsor catalogs.'
);
