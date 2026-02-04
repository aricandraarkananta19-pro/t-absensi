-- ==============================================================================
-- COMPLETE JOURNAL SYSTEM FIX - FINAL VERSION
-- ==============================================================================
-- This script fixes ALL issues with journal visibility
-- ==============================================================================

-- STEP 1: Verify work_journals table exists
SELECT 'Checking work_journals table...' as step;
SELECT COUNT(*) as total_journals FROM public.work_journals;

-- STEP 2: Check the role column type in user_roles
SELECT 'Checking user_roles.role type...' as step;
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'user_roles' AND column_name = 'role';

-- STEP 3: Show all user roles
SELECT 'User roles in system:' as step;
SELECT user_id, role FROM public.user_roles;

-- STEP 4: Drop ALL existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'work_journals' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.work_journals', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- STEP 5: Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create policies using ENUM type cast for role
-- This handles the app_role enum properly

CREATE POLICY "journal_select_all" ON public.work_journals
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            WHERE ur.role = 'admin'::public.app_role
        )
    )
    OR (
        verification_status IS DISTINCT FROM 'draft'
        AND auth.uid() IN (
            SELECT ur.user_id FROM public.user_roles ur 
            WHERE ur.role = 'manager'::public.app_role
        )
    )
);

CREATE POLICY "journal_insert_own" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "journal_update_all" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (
        SELECT ur.user_id FROM public.user_roles ur 
        WHERE ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
);

CREATE POLICY "journal_delete_all" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR auth.uid() IN (
        SELECT ur.user_id FROM public.user_roles ur 
        WHERE ur.role = 'admin'::public.app_role
    )
);

-- STEP 7: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;

-- STEP 8: Verify policies
SELECT 'Policies created:' as step;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'work_journals' AND schemaname = 'public';

-- STEP 9: Test query - what Admin/Manager should see
SELECT 'Journals visible to Admin/Manager:' as step;
SELECT id, user_id, verification_status, date, LEFT(content, 30) as preview
FROM public.work_journals
WHERE verification_status IS DISTINCT FROM 'draft'
ORDER BY created_at DESC;
