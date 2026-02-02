-- Fix System Settings and Attendance Periods RLS policies
-- Attempt to fix "new row violates row-level security policy for table 'system_settings'"

BEGIN;

-- ==========================================
-- SYSTEM SETTINGS
-- ==========================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Admins can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Managers can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Users can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can select settings" ON public.system_settings;

-- 1. Read access for all authenticated users (needed for everyone to check config)
CREATE POLICY "Authenticated users can select settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Insert access for Admins
CREATE POLICY "Admins can insert settings" 
ON public.system_settings 
FOR INSERT 
TO authenticated 
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Update access for Admins
CREATE POLICY "Admins can update settings" 
ON public.system_settings 
FOR UPDATE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. Delete access for Admins
CREATE POLICY "Admins can delete settings" 
ON public.system_settings 
FOR DELETE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ==========================================
-- ATTENDANCE PERIODS
-- ==========================================
-- Ensure policies exist here too since the user is also updating this table
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage periods" ON public.attendance_periods;
DROP POLICY IF EXISTS "Authenticated users can read periods" ON public.attendance_periods;
DROP POLICY IF EXISTS "Admins can insert periods" ON public.attendance_periods;
DROP POLICY IF EXISTS "Admins can update periods" ON public.attendance_periods;
DROP POLICY IF EXISTS "Admins can delete periods" ON public.attendance_periods;

-- 1. Read access
CREATE POLICY "Authenticated users can read periods" 
ON public.attendance_periods 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Full access for Admins
CREATE POLICY "Admins can insert periods" 
ON public.attendance_periods 
FOR INSERT 
TO authenticated 
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update periods" 
ON public.attendance_periods 
FOR UPDATE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete periods" 
ON public.attendance_periods 
FOR DELETE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;
