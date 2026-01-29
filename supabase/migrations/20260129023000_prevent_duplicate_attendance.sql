-- Migration: Add unique constraint to prevent duplicate clock-ins
-- Date: 2026-01-29
-- Description: Adds a partial unique index on attendance to ensure a user can only have one attendance record per day.
-- We use clock_in date to group daily records.

-- Safe constraint addition:
-- 1. We use an INDEX instead of a CONSTRAINT because it handles casting (::date) better in some PG versions
-- 2. We only enforce this uniqueness.

CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_attendance_idx
ON public.attendance (user_id, (clock_in::date));

-- We also want to ensure that if someone manually inserts via SQL, they can't break this.
-- This index acts as a unique constraint.

-- Optional: Drop the index if we ever need to rollback (commented out)
-- DROP INDEX IF EXISTS unique_daily_attendance_idx;
