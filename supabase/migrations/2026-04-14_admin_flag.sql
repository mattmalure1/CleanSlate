-- Add admin flag to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Set Matt as admin
UPDATE customers SET is_admin = TRUE WHERE email = 'mattmalure@gmail.com';
