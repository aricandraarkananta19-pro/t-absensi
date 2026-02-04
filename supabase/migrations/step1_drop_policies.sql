-- ================================================
-- STEP 1: RUN THIS FIRST - Drop old policies
-- ================================================
DROP POLICY IF EXISTS "select_journals" ON public.work_journals;
DROP POLICY IF EXISTS "insert_journals" ON public.work_journals;
DROP POLICY IF EXISTS "update_journals" ON public.work_journals;
DROP POLICY IF EXISTS "delete_journals" ON public.work_journals;
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
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "View Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view all journals" ON public.work_journals;
