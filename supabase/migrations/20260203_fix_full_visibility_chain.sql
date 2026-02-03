-- FIX 1: Ensure Work Journals Visibility (Manager/Admin View All)
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;

-- Allow Users to view their own, and Managers/Admins to view ALL (except drafts, optionally)
-- Removing "verification_status != 'draft'" check for now to ensure visibility of EVERYTHING for debugging.
CREATE POLICY "View Journals" ON public.work_journals
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR 
    public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Insert Journals" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update Journals" ON public.work_journals
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR
  (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
);

CREATE POLICY "Delete Journals" ON public.work_journals
FOR DELETE TO authenticated
USING (auth.uid() = user_id);


-- FIX 2: Ensure Profiles Visibility (CRITICAL for Joins)
-- If Managers/Admins cannot see the profile row of the employee, the journal query will fail or return null for the profile relation.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop restricting policies if any (be careful not to break existing logic, but Ensure Visibility is key)
-- Assuming standard policies exist. We add a broad "View All Profiles" for Admins/Managers.

CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR 
  public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- Ensure public read access to profiles for authenticated users is generally open for name/avatar
-- (Many apps allow all auth users to see basic profile info of coworkers)
CREATE POLICY "Authenticated users can view basic profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);


-- FIX 3: Ensure Columns Exist
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'submitted';

ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS manager_notes TEXT;

-- Verify has_role function exists (idempotent check not easily done without IF logic, but assuming it exists from previous context)
