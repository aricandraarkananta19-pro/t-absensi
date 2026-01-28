-- Fix Anonymous Access Policies by restricting to authenticated users only

-- ============ ATTENDANCE TABLE ============
DROP POLICY IF EXISTS "Admins can delete all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can update any attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.attendance;

CREATE POLICY "Admins can delete all attendance" ON public.attendance
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any attendance" ON public.attendance
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all attendance" ON public.attendance
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all attendance" ON public.attendance
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can insert their own attendance" ON public.attendance
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance" ON public.attendance
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own attendance" ON public.attendance
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ LEAVE_REQUESTS TABLE ============
DROP POLICY IF EXISTS "Admins can delete all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers can update leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can delete their pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can insert their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update their pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view their own leave requests" ON public.leave_requests;

CREATE POLICY "Admins can delete all leave requests" ON public.leave_requests
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'manager'::app_role)) WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view all leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can delete their pending leave requests" ON public.leave_requests
FOR DELETE TO authenticated USING ((auth.uid() = user_id) AND (status = 'pending'::text));

CREATE POLICY "Users can insert their own leave requests" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING ((auth.uid() = user_id) AND (status = 'pending'::text));

CREATE POLICY "Users can view their own leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ PROFILES TABLE ============
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ SYSTEM_SETTINGS TABLE ============
DROP POLICY IF EXISTS "Admins can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Managers can view settings" ON public.system_settings;

CREATE POLICY "Admins can insert settings" ON public.system_settings
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings" ON public.system_settings
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view settings" ON public.system_settings
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view settings" ON public.system_settings
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can view settings" ON public.system_settings
FOR SELECT TO authenticated USING (true);

-- ============ USER_ROLES TABLE ============
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);