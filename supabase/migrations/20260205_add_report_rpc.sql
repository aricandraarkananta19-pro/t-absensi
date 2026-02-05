-- Migration: Add RPC for Attendance Reports

CREATE OR REPLACE FUNCTION get_attendance_report(
    p_start_date DATE,
    p_end_date DATE,
    p_department TEXT DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    department TEXT,
    present BIGINT,
    late BIGINT,
    absent BIGINT,
    leave BIGINT,
    details JSONB
) AS $$
DECLARE
    v_today DATE;
BEGIN
    -- Get Current Date in Jakarta
    v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::DATE;

    RETURN QUERY
    WITH 
    -- 1. Generate Date Series
    date_series AS (
        SELECT d::DATE as date_val
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
    ),
    -- 2. Get Eligible Employees
    employees AS (
        SELECT p.user_id, p.full_name, p.department, p.join_date
        FROM profiles p
        JOIN user_roles ur ON p.user_id = ur.user_id
        WHERE p.deleted_at IS NULL
        AND ur.role = 'karyawan'
        AND (p_department IS NULL OR p_department = 'all' OR p.department = p_department)
    ),
    -- 3. Pre-calculate data
    daily_data AS (
        SELECT 
            e.user_id,
            d.date_val,
            e.full_name,
            -- Logic ISODOW: 6=Sat, 7=Sun
            CASE 
                -- Pre-employment
                WHEN e.join_date IS NOT NULL AND d.date_val < e.join_date THEN 'future'
                -- Future date (strictly > today)
                WHEN d.date_val > v_today THEN 'future'
                -- Existing Attendance (Prioritize this over leave usually, or equivalent?)
                -- If someone clocks in on leave day, usually counts as present.
                WHEN a.id IS NOT NULL THEN COALESCE(a.status, 'present')
                -- Approved Leave
                WHEN l.id IS NOT NULL THEN 'leave'
                -- Weekend 
                WHEN EXTRACT(ISODOW FROM d.date_val) IN (6, 7) THEN 'weekend'
                -- Today with no record -> Future (Pending)
                WHEN d.date_val = v_today THEN 'future'
                -- Default Absent
                ELSE 'absent'
            END as status,
            a.clock_in,
            a.clock_out,
            COALESCE(a.notes, CASE WHEN l.id IS NOT NULL THEN 'Cuti: ' || l.leave_type ELSE NULL END) as notes
        FROM employees e
        CROSS JOIN date_series d
        LEFT JOIN attendance a ON e.user_id = a.user_id 
            -- Match date in Jakarta Time
            AND (a.clock_in AT TIME ZONE 'Asia/Jakarta')::DATE = d.date_val
            AND a.deleted_at IS NULL
        LEFT JOIN leave_requests l ON e.user_id = l.user_id 
            AND l.status = 'approved' 
            AND d.date_val BETWEEN l.start_date AND l.end_date
    )
    SELECT 
        e.user_id,
        e.full_name,
        e.department,
        COUNT(*) FILTER (WHERE dd.status IN ('present', 'late', 'early_leave')) as present,
        COUNT(*) FILTER (WHERE dd.status = 'late') as late,
        COUNT(*) FILTER (WHERE dd.status IN ('absent', 'alpha')) as absent,
        COUNT(*) FILTER (WHERE dd.status IN ('leave', 'permission', 'sick')) as leave,
        jsonb_agg(
            jsonb_build_object(
                'date', dd.date_val,
                'status', dd.status,
                'clockIn', dd.clock_in,
                'clockOut', dd.clock_out,
                'notes', dd.notes,
                'isWeekend', EXTRACT(ISODOW FROM dd.date_val) IN (6, 7)
            ) ORDER BY dd.date_val
        ) as details
    FROM employees e
    JOIN daily_data dd ON e.user_id = dd.user_id
    GROUP BY e.user_id, e.full_name, e.department;
END;
$$ LANGUAGE plpgsql;
