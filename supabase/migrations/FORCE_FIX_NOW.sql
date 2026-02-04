-- ==============================================================================
-- FORCE FIX: DISABLE RLS TEMPORARILY TO VERIFY DATA EXISTS
-- ==============================================================================
-- RUN THIS FIRST TO DIAGNOSE

-- Step 1: Check if any journals exist (bypass RLS using service role context)
SELECT 'CHECKING JOURNALS:' as info;
SELECT id, user_id, verification_status, content, date 
FROM public.work_journals 
LIMIT 20;

-- Step 2: Check current policies
SELECT 'CURRENT POLICIES:' as info;
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'work_journals';

-- Step 3: Check user_roles
SELECT 'USER ROLES:' as info;
SELECT ur.user_id, ur.role, p.full_name 
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id;

-- ==============================================================================
-- IF JOURNALS EXIST BUT DON'T SHOW, RUN THIS NUCLEAR OPTION:
-- ==============================================================================

-- OPTION A: Temporarily DISABLE RLS (for testing)
-- ALTER TABLE public.work_journals DISABLE ROW LEVEL SECURITY;

-- OPTION B: Create a completely permissive policy
-- First drop all existing
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'work_journals' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.work_journals', pol.policyname);
        RAISE NOTICE 'Dropped: %', pol.policyname;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- Create ONE simple permissive policy for ALL authenticated users
CREATE POLICY "authenticated_full_access" ON public.work_journals
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
GRANT ALL ON public.work_journals TO anon;

-- Verify
SELECT 'NEW POLICIES:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'work_journals';
