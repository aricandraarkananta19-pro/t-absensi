
-- 1. Create User in Auth (Simulated via SQL since we cant use API here easily)
-- NOTE: In Supabase, the best way to create a user manually is via the DASHBOARD > Authentication > Users > Add User.
-- However, we can Insert into tables assuming the user ID is known, OR we just trust you to create the user first.

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> Authentication -> Users.
-- 2. Click "Add User".
-- 3. Email: admin@talenta.com
-- 4. Password: AdminPassword123!
-- 5. Auto Confirm: Yes.
-- 6. Click "Create User".
-- 7. Copy the "User UID" (e.g., 550e8400-e29b-41d4-a716-446655440000).

-- 8. REPLACE 'YOUR_USER_ID_HERE' BELOW WITH THAT UID AND RUN THIS IN SQL EDITOR:

INSERT INTO public.profiles (user_id, full_name, email, department, position)
VALUES (
    'YOUR_USER_ID_HERE', -- <--- PASTE UID HERE
    'Super Admin',
    'admin@talenta.com',
    'Board of Directors',
    'Administrator'
)
ON CONFLICT (user_id) DO UPDATE 
SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role)
VALUES (
    'YOUR_USER_ID_HERE', -- <--- PASTE UID HERE
    'admin'
)
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin';
