-- Enable Admins to DELETE attendance records
-- This is required for the new "Reset/Delete Attendance" feature to work.

BEGIN;

-- Drop existing matching policy if exists to avoid conflict
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;

-- Create the Delete Policy
CREATE POLICY "Admins can delete attendance" 
ON public.attendance 
FOR DELETE 
To authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;
