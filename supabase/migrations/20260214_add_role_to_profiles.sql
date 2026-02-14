-- Add role column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);

-- Set xyz.asia.co@gmail.com as admin
-- First, we need to find the user_id from auth.users
UPDATE public.user_profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'xyz.asia.co@gmail.com'
);
