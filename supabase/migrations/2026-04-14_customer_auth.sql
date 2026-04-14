-- Add auth_id column to customers table for Supabase Auth integration
-- Links a Supabase Auth user (auth.users) to their customer record
-- Nullable: guest customers won't have an auth_id

ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_customers_auth_id ON customers (auth_id);
