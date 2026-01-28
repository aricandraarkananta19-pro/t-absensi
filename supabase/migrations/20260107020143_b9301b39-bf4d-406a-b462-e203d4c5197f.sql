-- Add policy to require authentication for accessing profiles table
-- This ensures unauthenticated users cannot access any profile data
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);