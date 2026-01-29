
-- Enable RLS on attendance_periods
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "read active attendance period" ON public.attendance_periods;
DROP POLICY IF EXISTS "admin update attendance period" ON public.attendance_periods;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.attendance_periods;
DROP POLICY IF EXISTS "Enable write access for admins only" ON public.attendance_periods;
DROP POLICY IF EXISTS "admin insert attendance period" ON public.attendance_periods;

-- 1. All authenticated users can read active periods
CREATE POLICY "read active attendance period"
ON public.attendance_periods
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. Only admin can update periods (using user_roles table)
-- We check user_roles table because app roles are stored there, not in JWT by default
CREATE POLICY "admin update attendance period"
ON public.attendance_periods
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Only admin can insert new periods
CREATE POLICY "admin insert attendance period"
ON public.attendance_periods
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
