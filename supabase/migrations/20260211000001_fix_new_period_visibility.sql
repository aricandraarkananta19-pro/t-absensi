-- ==============================================================================
-- FIX NEW PERIOD VISIBILITY (2026-02-10)
-- ==============================================================================
-- Goal: Ensure the current month's attendance period exists and is active.
-- Update system settings to reflect the new period start date.
-- ==============================================================================

-- 1. Ensure Attendance Period for current month exists
DO $$
DECLARE
  current_month_start date := date_trunc('month', current_date)::date;
  current_month_end date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
  month_name text := to_char(current_date, 'Month YYYY');
BEGIN
  -- Insert if not exists
  IF NOT EXISTS (SELECT 1 FROM public.attendance_periods WHERE start_date = current_month_start) THEN
    INSERT INTO public.attendance_periods (start_date, end_date, name, is_active)
    VALUES (current_month_start, current_month_end, month_name, true);
  ELSE
    -- Ensure it is active
    UPDATE public.attendance_periods
    SET is_active = true
    WHERE start_date = current_month_start;
  END IF;
  
  -- Deactivate previous periods? (Optional, usually we verify active period logic)
  -- UPDATE public.attendance_periods SET is_active = false WHERE start_date < current_month_start;
END $$;

-- 2. Update System Settings to point to this start date
-- This ensures the frontend 'useSystemSettings' hook considers the new period valid.
INSERT INTO public.system_settings (key, value)
VALUES ('attendance_start_date', (date_trunc('month', current_date)::date)::text)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- 3. Trigger Refresh (Optional - just ensuring data is committed)
