
-- Add manager interaction columns to work_journals
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS manager_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'submitted'; -- submitted, reviewed, approved, rejected

-- Update RLS to ensure managers can update these columns
CREATE POLICY "Managers can update work_journals" 
ON public.work_journals 
FOR UPDATE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'manager'::public.app_role) OR 
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
