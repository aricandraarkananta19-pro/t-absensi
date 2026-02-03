-- Migration: Auto Clock Out Feature
-- Uses pg_cron (must be enabled in Supabase Dashboard > Database > Extensions)

-- 1. Create the Auto Clock Out Function
CREATE OR REPLACE FUNCTION public.auto_clock_out_forgotten_entries()
RETURNS void AS $$
DECLARE
    affected_rows INT;
BEGIN
    -- Update entries that are:
    -- 1. From TODAY (or yesterday if running past midnight)
    -- 2. Have NO clock_out time
    -- 3. Only regular statuses (present/late)
    
    WITH updated_rows AS (
        UPDATE public.attendance
        SET 
            -- Set clock_out to 17:30 (5:30 PM) of the same day OR clock_in + 9 hours, whichever is reasonable
            -- Simplest rule: Set to 17:00:00 of the entry date
            clock_out = (clock_in::DATE + interval '17 hours 30 minutes'),
            
            -- Append a note indicating system action
            notes = COALESCE(notes, '') || E'\n[System]: Auto Clock-Out (Lupa Absensi)',
            
            updated_at = now()
        WHERE 
            clock_out IS NULL
            AND clock_in < NOW() -- Must be in the past
            AND clock_in::DATE < CURRENT_DATE -- Look for PREVIOUS days (safe) OR just handle carefully
            -- Let's define the scope: Run this every night at 23:55 for "TODAY's" entries
            AND clock_in::DATE = CURRENT_DATE
        RETURNING id
    )
    SELECT count(*) INTO affected_rows FROM updated_rows;

    -- Log the action (Optional, if you have audit logs)
    -- RAISE NOTICE 'Auto-clocked out % entries.', affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Setup pg_cron Job
-- Note: This requires the pg_cron extension to be enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: Every day at 23:30 (11:30 PM)
-- Cron syntax: minute hour day month day_of_week
-- 30 23 * * *
SELECT cron.schedule(
    'auto-clock-out-daily', -- Job Name
    '30 23 * * *',          -- Schedule (23:30 UTC - Adjust if your DB is in a different tz, usually UTC)
    $$SELECT public.auto_clock_out_forgotten_entries()$$
);

-- Grant usage just in case
GRANT EXECUTE ON FUNCTION public.auto_clock_out_forgotten_entries() TO postgres;
GRANT EXECUTE ON FUNCTION public.auto_clock_out_forgotten_entries() TO service_role;
