-- FIX RLS POLICIES FOR SYSTEM STABILITY

-- 1. PROFILES: Allow Admins and Managers to view ALL profiles
DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON profiles;
CREATE POLICY "Admins and Managers can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager')
    )
    OR
    auth.uid() = user_id -- Users can always see themselves
);

-- 2. USER_ROLES: Allow reading roles (Critical for the policy above to work!)
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON user_roles;
CREATE POLICY "Allow read access for authenticated users"
ON user_roles FOR SELECT
TO authenticated
USING (true); -- Everyone needs to know roles to check permissions

-- 3. WORK_JOURNALS: Allow Admins/Managers to see ALL, Employees see OWN
DROP POLICY IF EXISTS "Admins/Managers see all journals, Employees see own" ON work_journals;
CREATE POLICY "Admins/Managers see all journals, Employees see own"
ON work_journals FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager')
    )
    OR
    auth.uid() = user_id
);

-- 4. ATTENDANCE: Allow Admins/Managers to see ALL, Employees see OWN
DROP POLICY IF EXISTS "Admins/Managers see all attendance, Employees see own" ON attendance;
CREATE POLICY "Admins/Managers see all attendance, Employees see own"
ON attendance FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager')
    )
    OR
    auth.uid() = user_id
);
