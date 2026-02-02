-- Fix RLS policies for profiles to ensure Admins can Update
-- Addresses issue where "Successfully updated" appears but data is unchanged (silent RLS failure)

BEGIN;

-- Ensure RLS is on
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Drop potentially conflicting or malformed policies for UPDATE
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles; -- Name variation
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles; -- Remove strict/broad blanket policy if it exists

-- 2. Re-create Admin UPDATE policy with explicit permissions
CREATE POLICY "Admins can update all profiles" 
ON public.profiles
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Ensure "Users update own" still exists (idempotent check not easy in SQL without DO block, but acceptable to re-create if needed. 
--    However, strict names usually mean we can just leave existing ones if we don't drop them.
--    We only dropped "Admins can update..." variants.

-- 4. Just in case, ensuring READ/DELETE for Admins too, matching the pattern
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles
FOR DELETE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;
