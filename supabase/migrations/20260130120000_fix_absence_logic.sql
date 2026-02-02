-- 1. Update Attendance Status Constraint to include 'absent', 'permit', 'sick'
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS "attendance_status_check";
ALTER TABLE public.attendance ADD CONSTRAINT "attendance_status_check" 
CHECK (status IN ('present', 'late', 'early_leave', 'absent', 'permit', 'sick'));

-- 2. Create Holidays Table (if not exists)
CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for Holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Drop existings policies to ensure idempotency
DROP POLICY IF EXISTS "Read access for all" ON public.holidays;
DROP POLICY IF EXISTS "Admin write access" ON public.holidays;

CREATE POLICY "Read access for all" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Admin write access" ON public.holidays FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Function to generate absent records for a specific date
CREATE OR REPLACE FUNCTION public.generate_absent_records(target_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee RECORD;
    is_holiday boolean;
    day_of_week integer;
BEGIN
    -- 1. Skip if date is in future
    IF target_date > CURRENT_DATE THEN
        RETURN;
    END IF;

    -- 2. Skip Sunday (0)
    day_of_week := extract(dow from target_date);
    IF day_of_week = 0 THEN
        RETURN;
    END IF;

    -- 3. Check Holiday
    SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = target_date) INTO is_holiday;
    IF is_holiday THEN
        RETURN;
    END IF;

    -- 4. Loop Active Employees
    FOR employee IN 
        SELECT u.id, p.join_date 
        FROM auth.users u
        JOIN public.profiles p ON u.id = p.user_id
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'karyawan'
    LOOP
        -- Check if employee had joined by this date
        -- If join_date is NULL, assume they joined long ago (or handle as valid)
        -- Prompt says "attendance_start_date" which maps to join_date
        IF employee.join_date IS NOT NULL AND employee.join_date <= target_date THEN
            
            -- Check if any attendance record exists for this user on this day
            IF NOT EXISTS (
                SELECT 1 FROM public.attendance 
                WHERE user_id = employee.id 
                AND clock_in::date = target_date
            ) THEN
                
                -- Check if on approved leave
                IF NOT EXISTS (
                    SELECT 1 FROM public.leave_requests
                    WHERE user_id = employee.id
                    AND status = 'approved'
                    AND target_date BETWEEN start_date AND end_date
                ) THEN
                    -- Insert Absent Record
                    INSERT INTO public.attendance (user_id, clock_in, status, notes)
                    VALUES (
                        employee.id, 
                        (target_date || ' 00:00:00')::timestamptz, -- Use start of day
                        'absent', 
                        'System Auto-Generated: Absent'
                    );
                END IF;

            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 4. Function to bulk process a range (e.g., month)
CREATE OR REPLACE FUNCTION public.sync_absence_data(start_date date, end_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    d date;
BEGIN
    d := start_date;
    WHILE d <= end_date LOOP
        PERFORM public.generate_absent_records(d);
        d := d + 1;
    END LOOP;
END;
$$;
