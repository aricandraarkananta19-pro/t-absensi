-- Clean up and re-apply delete policy
-- Created: 2026-02-03

BEGIN;

-- Drop the policy if it exists to fix the error "already exists"
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;

-- Re-create it cleanly
CREATE POLICY "Admins can delete attendance" 
ON public.attendance 
FOR DELETE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;
