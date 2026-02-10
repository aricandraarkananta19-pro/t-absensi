-- ==============================================================================
-- CLEAN SLATE RLS AUDIT FIX (2026-02-10)
-- ==============================================================================
-- Goal: Consolidate conflicting policies into a single, clean, authoritative set.
-- Tables affected: work_journals, attendance, profiles, user_roles
-- ==============================================================================

-- 1. Helper Function to Avoid Recursion in User Roles
-- (Optional but good practice, keeping it simple for now with direct checks)

-- ==============================================================================
-- TABLE: user_roles
-- ==============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and Managers can view ALL user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all" ON public.user_roles;

-- Create Unified Policy: Authenticated users can read ALL roles
-- This is necessary to avoid "Infinite Recursion" when other policies check user_roles
CREATE POLICY "user_roles_select_unified"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

-- ==============================================================================
-- TABLE: profiles
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop All Existing
DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and Managers can view ALL profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- SELECT: Self OR Admin OR Manager
CREATE POLICY "profiles_select_unified"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- UPDATE: Self OR Admin (Managers usually don't edit other profiles, but let's allow Admin only for safety)
CREATE POLICY "profiles_update_unified"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- INSERT: Self (usually handled by triggers on auth.users, but good to have)
CREATE POLICY "profiles_insert_unified"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- TABLE: work_journals
-- ==============================================================================
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- Drop All Existing (Wide Net)
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "journal_view" ON public.work_journals;
DROP POLICY IF EXISTS "journal_select" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view ALL journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins/Managers see all journals, Employees see own" ON public.work_journals;

DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "journal_create" ON public.work_journals;
DROP POLICY IF EXISTS "journal_insert" ON public.work_journals;

DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "journal_edit" ON public.work_journals;
DROP POLICY IF EXISTS "journal_update" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can update ALL journals" ON public.work_journals;

DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;
DROP POLICY IF EXISTS "journal_remove" ON public.work_journals;
DROP POLICY IF EXISTS "journal_delete" ON public.work_journals;

-- SELECT: Self OR Admin OR Manager
CREATE POLICY "work_journals_select_unified"
ON public.work_journals FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- INSERT: Self Only
CREATE POLICY "work_journals_insert_unified"
ON public.work_journals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Self (Own) OR Admin/Manager (Status/Feedback)
CREATE POLICY "work_journals_update_unified"
ON public.work_journals FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- DELETE: Self (Draft Only) OR Admin (Any)
-- Implementing strict logic: User can only delete if status is 'draft' (or 'pending'?)
-- Let's stick to safe defaults: User can delete own, Admin can delete any.
CREATE POLICY "work_journals_delete_unified"
ON public.work_journals FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ==============================================================================
-- TABLE: attendance
-- ==============================================================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Drop All Existing
DROP POLICY IF EXISTS "Admins/Managers see all attendance, Employees see own" ON public.attendance;
DROP POLICY IF EXISTS "Admins and Managers can view ALL attendance" ON public.attendance;
DROP POLICY IF EXISTS "Enable read access for own attendance" ON public.attendance;

-- SELECT: Self OR Admin OR Manager
CREATE POLICY "attendance_select_unified"
ON public.attendance FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- INSERT: Self Only (Clock In)
CREATE POLICY "attendance_insert_unified"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Self (Clock Out) OR Admin/Manager (Correction)
CREATE POLICY "attendance_update_unified"
ON public.attendance FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- ==============================================================================
-- CLEANUP NULLS (Data Integrity Audit Phase 2)
-- ==============================================================================
-- Ensure no journals are hidden due to NULL status
UPDATE public.work_journals SET verification_status = 'submitted' WHERE verification_status IS NULL;
UPDATE public.work_journals SET status = 'submitted' WHERE status IS NULL;
