
-- ALTER TABLE STATEMENTS TO ADD LAT/LNG COLUMNS
-- Run this in Supabase SQL Editor

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS clock_in_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_lng DOUBLE PRECISION;

-- Ensure RLS policies allow update of these columns if needed (usually implicit for update)
