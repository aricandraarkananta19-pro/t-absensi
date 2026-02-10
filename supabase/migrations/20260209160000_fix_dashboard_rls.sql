-- FIX RLS For Dashboard & Journals Visibility
-- Goal: Ensure Admins and Managers can SEE ALL attendance and journals.

-- 1. ATTENDANCE TABLE POLICIES
-- First, drop existing restrictive policies if they conflict (optional, but cleaner)
-- DROP POLICY IF EXISTS "Enable read access for own attendance" ON "public"."attendance";
-- DROP POLICY IF EXISTS "Enable read access for admins" ON "public"."attendance";

-- We will ADD a broad policy for Admin/Manager.
-- Postgres policies are permissive (OR), so adding this new one enables access even if others exist.

CREATE POLICY "Admins and Managers can view ALL attendance"
ON "public"."attendance"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- 2. WORK JOURNALS TABLE POLICIES
-- Ensure Admin/Manager can see ALL journals.

CREATE POLICY "Admins and Managers can view ALL journals"
ON "public"."work_journals"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- 3. PROFILES VISIBILITY (Just in case)
-- Admins/Managers usually need to see profiles to display names.

CREATE POLICY "Admins and Managers can view ALL profiles"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- 4. USER ROLES VISIBILITY
-- Critical for Dashboard "Department Distribution" and Stats which filter by Role.
-- Without this, fetching 'user_roles' returns empty, causing 0 employees to be counted.

CREATE POLICY "Admins and Managers can view ALL user_roles"
ON "public"."user_roles"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);
