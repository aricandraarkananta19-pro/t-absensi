-- Drop overly permissive policy on profiles table
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- Drop overly permissive policy on system_settings table
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.system_settings;