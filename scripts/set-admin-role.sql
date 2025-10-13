-- Set your user as owner to access admin dashboard
-- Run this with: psql <connection-string> -f scripts/set-admin-role.sql
-- Or execute via Supabase Dashboard SQL Editor

-- First, let's see all users
SELECT
  id,
  clerk_id,
  email,
  role,
  created_at
FROM users
ORDER BY created_at DESC;

-- Update your user to owner role
-- Replace 'your-email@example.com' with your actual email
UPDATE users
SET role = 'owner'
WHERE email = 'your-email@example.com';

-- Verify the update
SELECT
  id,
  clerk_id,
  email,
  role
FROM users
WHERE email = 'your-email@example.com';
