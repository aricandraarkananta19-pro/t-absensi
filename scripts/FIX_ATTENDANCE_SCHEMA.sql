-- ==============================================================================
-- FIX ATTENDANCE TABLE SCHEMA
-- ==============================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qfpbrislzyjrjyknsqmy/sql/new
-- ==============================================================================

BEGIN;

-- 1. Add 'date' column if it doesn't exist
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS date DATE;

-- 2. Backfill date from clock_in for existing records
UPDATE public.attendance 
SET date = (clock_in AT TIME ZONE 'Asia/Jakarta')::date 
WHERE date IS NULL AND clock_in IS NOT NULL;

-- 3. Drop old unique constraint if it exists (might be on user_id only)
DROP INDEX IF EXISTS idx_attendance_user_date;

-- 4. Create proper unique constraint on (user_id, date)
CREATE UNIQUE INDEX idx_attendance_user_date ON public.attendance (user_id, date);

-- 5. Add missing columns that Edge Functions may use
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS clock_in_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS work_hours DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Reload PostgREST schema cache so it picks up the new columns
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verify the fix
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'attendance' 
ORDER BY ordinal_position;
