-- DIAGNOSTIC: Check work_journals table structure
-- Run this in Supabase SQL Editor

-- 1. Check if table exists and show columns
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'work_journals' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Show sample data
SELECT * FROM public.work_journals LIMIT 3;

-- 3. Check RLS status
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'work_journals';

-- 4. Show all policies
SELECT policyname, cmd, permissive, roles, qual 
FROM pg_policies 
WHERE tablename = 'work_journals';
