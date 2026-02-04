-- ==============================================================================
-- COMPLETE JOURNAL VISIBILITY FIX - Comprehensive Audit & Repair
-- ==============================================================================
-- Run this entire script in Supabase SQL Editor
-- ==============================================================================

-- STEP 1: DIAGNOSTIC - Check current state
-- ==============================================================================

-- 1.1 Check if work_journals table exists and has data
SELECT 'work_journals table check' as diagnostic, count(*) as total_journals FROM public.work_journals;

-- 1.2 Check status distribution
SELECT verification_status, count(*) as count 
FROM public.work_journals 
GROUP BY verification_status;

-- 1.3 Check if has_role function exists
SELECT 
    'has_role function' as check_item,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'has_role'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

-- STEP 2: CREATE OR REPLACE has_role function (CRITICAL)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  )
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO service_role;

-- STEP 3: DROP ALL existing policies on work_journals
-- ==============================================================================

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

-- STEP 4: Enable RLS
-- ==============================================================================

ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create NEW simplified policies
-- ==============================================================================

-- 5.1 SELECT Policy: Maximum visibility for Admin/Manager
CREATE POLICY "wj_select" ON public.work_journals
FOR SELECT TO authenticated
USING (
    -- Author sees everything
    user_id = auth.uid()
    OR
    -- Admin sees ALL non-draft
    (public.has_role(auth.uid(), 'admin') AND verification_status IS DISTINCT FROM 'draft')
    OR
    -- Manager sees ALL non-draft
    (public.has_role(auth.uid(), 'manager') AND verification_status IS DISTINCT FROM 'draft')
);

-- 5.2 INSERT Policy
CREATE POLICY "wj_insert" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5.3 UPDATE Policy
CREATE POLICY "wj_update" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
);

-- 5.4 DELETE Policy
CREATE POLICY "wj_delete" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
);

-- STEP 6: Grant table permissions
-- ==============================================================================

GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
GRANT SELECT ON public.work_journals TO anon;

-- STEP 7: Verify policies were created
-- ==============================================================================

SELECT 'Policies created' as status, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'work_journals' AND schemaname = 'public';

-- STEP 8: Test query (simulating what Admin/Manager would see)
-- ==============================================================================

-- This shows ALL non-draft journals (what Admin/Manager should see)
SELECT 
    id,
    user_id,
    verification_status,
    date,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.work_journals
WHERE verification_status IS DISTINCT FROM 'draft'
ORDER BY created_at DESC
LIMIT 10;

-- STEP 9: Check user_roles to ensure admin/manager roles exist
-- ==============================================================================

SELECT 'user_roles check' as diagnostic, role, count(*) as count
FROM public.user_roles
GROUP BY role;

-- ==============================================================================
-- END OF SCRIPT
-- ==============================================================================
