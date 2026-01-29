-- Migration: Add unique constraint (Retry with Immutable Function)
-- Date: 2026-01-29

-- 1. Create a wrapper function that we promise is immutable
-- (We assume Jakarta timezone rules won't change historically in a way that breaks this unique constraint for recent data)
CREATE OR REPLACE FUNCTION jakarta_date(ts timestamptz) 
RETURNS date AS $$
  SELECT (ts AT TIME ZONE 'Asia/Jakarta')::date;
$$ LANGUAGE sql IMMUTABLE;

-- 2. Create the unique index using this function
CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_attendance_idx
ON public.attendance (user_id, jakarta_date(clock_in));
