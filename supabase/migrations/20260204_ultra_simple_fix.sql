-- SIMPLE FIX FOR JOURNAL VISIBILITY
-- Run each section separately if needed

-- SECTION 1: Drop all existing policies
DROP POLICY IF EXISTS "wj_read_all" ON public.work_journals;
DROP POLICY IF EXISTS "wj_insert_own" ON public.work_journals;
DROP POLICY IF EXISTS "wj_update_all" ON public.work_journals;
DROP POLICY IF EXISTS "wj_delete_all" ON public.work_journals;
DROP POLICY IF EXISTS "wj_select" ON public.work_journals;
DROP POLICY IF EXISTS "wj_insert" ON public.work_journals;
DROP POLICY IF EXISTS "wj_update" ON public.work_journals;
DROP POLICY IF EXISTS "wj_delete" ON public.work_journals;
DROP POLICY IF EXISTS "journal_view" ON public.work_journals;
DROP POLICY IF EXISTS "journal_create" ON public.work_journals;
DROP POLICY IF EXISTS "journal_edit" ON public.work_journals;
DROP POLICY IF EXISTS "journal_remove" ON public.work_journals;
DROP POLICY IF EXISTS "journal_select_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_insert_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_update_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_delete_policy" ON public.work_journals;

-- SECTION 2: Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- SECTION 3: Create SELECT policy
CREATE POLICY "select_journals" ON public.work_journals
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
    )
    OR (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'manager')
    )
);

-- SECTION 4: Create INSERT policy
CREATE POLICY "insert_journals" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- SECTION 5: Create UPDATE policy  
CREATE POLICY "update_journals" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
);

-- SECTION 6: Create DELETE policy
CREATE POLICY "delete_journals" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- SECTION 7: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
