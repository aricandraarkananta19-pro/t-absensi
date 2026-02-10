-- ==============================================================================
-- DIAGNOSTIC SCRIPT (2026-02-10)
-- ==============================================================================

-- 1. Check Foreign Keys on work_journals
SELECT conname AS constraint_name
FROM pg_constraint
WHERE conrelid = 'public.work_journals'::regclass;

-- 2. Check Active Attendance Periods
SELECT * FROM public.attendance_periods WHERE is_active = true OR start_date >= '2026-02-01';

-- 3. Check System Settings
SELECT * FROM public.system_settings WHERE key = 'attendance_start_date';

-- 4. Check Attendance Count for Feb 2026
SELECT count(*) as attendance_feb_count 
FROM public.attendance 
WHERE clock_in >= '2026-02-01';

-- 5. Check Journal Count for Feb 2026
SELECT count(*) as journals_feb_count 
FROM public.work_journals 
WHERE date >= '2026-02-01';
