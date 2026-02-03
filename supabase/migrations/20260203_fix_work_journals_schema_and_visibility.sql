-- 1. Ensure columns exist (Schema Fix)
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'submitted';

ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS manager_notes TEXT;

-- 2. Clean Policy Reset
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view all journals" ON public.work_journals;
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;

-- 3. Define Comprehensive Policies

-- VIEW: 
-- Employee sees OWN journals (all statuses including draft)
-- Manager/Admin sees ALL journals that are NOT 'draft' (unless they own them, which is covered by first clause but let's be explicit)
CREATE POLICY "View Journals" ON public.work_journals
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR
  (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
    AND
    verification_status != 'draft'
  )
);

-- INSERT:
-- Authenticated users can create journals (usually employees)
-- They act as owner
CREATE POLICY "Insert Journals" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- UPDATE:
-- Employee: Can update OWN journals
-- Manager/Admin: Can update ANY journal (e.g. to approve, reject, add notes)
-- Note: Ideally we limit Employee to only update if 'draft', but for flexibility let's allow edits for now or assume frontend handles "locked" state.
-- For stricter control: AND (verification_status = 'draft' OR public.has_role(...) )
CREATE POLICY "Update Journals" ON public.work_journals
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR
  (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
);

-- DELETE:
-- Users can delete their own journals
CREATE POLICY "Delete Journals" ON public.work_journals
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. Grant permissions (just in case)
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
