-- EMERGENCY FIX: Journal Visibility for Admin & Manager
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "View Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view all journals" ON public.work_journals;
DROP POLICY IF EXISTS "journal_select_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_insert_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_update_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_delete_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_view" ON public.work_journals;
DROP POLICY IF EXISTS "journal_create" ON public.work_journals;
DROP POLICY IF EXISTS "journal_edit" ON public.work_journals;
DROP POLICY IF EXISTS "journal_remove" ON public.work_journals;

-- Step 2: Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- Step 3: Create VIEW policy
CREATE POLICY "journal_view" ON public.work_journals
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR
    (
        verification_status <> 'draft'
        AND
        (
            public.has_role(auth.uid(), 'admin'::public.app_role)
            OR
            public.has_role(auth.uid(), 'manager'::public.app_role)
        )
    )
);

-- Step 4: Create INSERT policy
CREATE POLICY "journal_create" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Step 5: Create UPDATE policy
CREATE POLICY "journal_edit" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR
    public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- Step 6: Create DELETE policy
CREATE POLICY "journal_remove" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Step 7: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
