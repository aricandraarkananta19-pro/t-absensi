-- ==============================================================================
-- SIMPLE RLS FIX ONLY (FK already exists)
-- ==============================================================================

-- STEP 1: Drop ALL RLS policies
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

-- STEP 3: Create simple permissive policy for ALL authenticated users
CREATE POLICY "allow_all_authenticated" ON public.work_journals
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- STEP 4: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;

-- STEP 5: Verify
SELECT 'POLICIES:' as info, policyname FROM pg_policies WHERE tablename = 'work_journals';
SELECT 'JOURNALS:' as info, count(*) as total FROM public.work_journals;
