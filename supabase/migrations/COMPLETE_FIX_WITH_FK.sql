-- ==============================================================================
-- FIX FOREIGN KEY AND RLS - COMPLETE SOLUTION
-- ==============================================================================

-- STEP 1: Ensure work_journals table has proper foreign key to profiles
-- First check if the constraint exists
SELECT 'Checking existing constraints...' as step;
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'work_journals' AND constraint_type = 'FOREIGN KEY';

-- STEP 2: Add foreign key if missing (will error if already exists - that's OK)
ALTER TABLE public.work_journals
ADD CONSTRAINT work_journals_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Note: The profiles join in Supabase requires the FK to reference the same table
-- Let's also ensure profiles has correct FK
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- STEP 3: Drop ALL RLS policies
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

-- STEP 4: Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create simple permissive policy
CREATE POLICY "allow_all_authenticated" ON public.work_journals
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- STEP 6: Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;

-- STEP 7: Test the exact query used by frontend
SELECT 'TESTING FRONTEND QUERY:' as step;
SELECT 
    wj.*,
    p.full_name,
    p.avatar_url,
    p.department,
    p.position
FROM public.work_journals wj
LEFT JOIN public.profiles p ON p.user_id = wj.user_id
ORDER BY wj.created_at DESC;

-- STEP 8: Show final state
SELECT 'FINAL POLICIES:' as step;
SELECT policyname FROM pg_policies WHERE tablename = 'work_journals';

SELECT 'JOURNAL COUNT:' as step;
SELECT count(*) FROM public.work_journals;
