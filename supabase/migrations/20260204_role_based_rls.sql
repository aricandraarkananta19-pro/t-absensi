-- ==============================================================================
-- ROLE-BASED RLS POLICIES FOR WORK JOURNALS
-- ==============================================================================
-- Rules:
-- SELECT: Employees see own, Admin/Manager see all (non-draft)
-- INSERT: Everyone can insert own journals
-- UPDATE: Employees edit own, Admin/Manager edit all
-- DELETE: Employees delete own, Admin delete all
-- ==============================================================================

-- STEP 1: Drop existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'work_journals' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.work_journals', pol.policyname);
    END LOOP;
END $$;

-- STEP 2: Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- STEP 3: SELECT Policy
-- Employees see only their own journals
-- Admin/Manager see all non-draft journals
CREATE POLICY "journal_select" ON public.work_journals
FOR SELECT TO authenticated
USING (
    -- Author sees own journals (including drafts)
    user_id = auth.uid()
    OR
    -- Admin sees all non-draft journals
    (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
    )
    OR
    -- Manager sees all non-draft journals
    (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'manager')
    )
);

-- STEP 4: INSERT Policy
-- Everyone can create their own journals
CREATE POLICY "journal_insert" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- STEP 5: UPDATE Policy
-- Employees can update own journals
-- Admin/Manager can update any journal
CREATE POLICY "journal_update" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'manager')
);

-- STEP 6: DELETE Policy
-- Employees can delete own journals
-- Admin can delete any journal
CREATE POLICY "journal_delete" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- STEP 7: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;

-- STEP 8: Verify
SELECT 'POLICIES CREATED:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'work_journals' AND schemaname = 'public';
