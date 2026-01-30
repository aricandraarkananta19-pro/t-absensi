-- Enhance attendance_periods table to support month-end locking and archiving
-- Run this in Supabase SQL Editor

-- 1. Add new columns to attendance_periods
ALTER TABLE public.attendance_periods 
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS name text, -- e.g., "Januari 2026"
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS report_url text; -- For the "Report snapshot" / "Save archive"

-- 2. Update existing records if any (optional, safe to run)
UPDATE public.attendance_periods 
SET 
  end_date = (start_date + interval '1 month' - interval '1 day')::date,
  name = to_char(start_date, 'Month YYYY')
WHERE end_date IS NULL;

-- 3. Create a function to lock a period
CREATE OR REPLACE FUNCTION public.lock_attendance_period(period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can lock periods';
  END IF;

  UPDATE public.attendance_periods
  SET 
    is_locked = true,
    locked_at = now()
  WHERE id = period_id;
END;
$$;

-- 4. Create a function to generate/ensure periods exist
CREATE OR REPLACE FUNCTION public.ensure_current_period_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month_start date;
  next_month_start date;
BEGIN
  current_month_start := date_trunc('month', current_date)::date;
  next_month_start := date_trunc('month', current_date + interval '1 month')::date;

  -- Insert current month if not exists
  IF NOT EXISTS (SELECT 1 FROM public.attendance_periods WHERE start_date = current_month_start) THEN
    INSERT INTO public.attendance_periods (start_date, end_date, name, is_active)
    VALUES (
      current_month_start, 
      (current_month_start + interval '1 month' - interval '1 day')::date,
      to_char(current_month_start, 'Month YYYY'),
      true
    );
  END IF;
END;
$$;
