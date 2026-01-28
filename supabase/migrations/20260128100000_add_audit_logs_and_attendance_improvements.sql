-- Migration: Add audit_logs table, work_hours column, and unique constraint for attendance
-- Created: 2026-01-28

-- ============ 1. ADD work_hours COLUMN TO attendance ============
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS work_hours NUMERIC(10, 2) DEFAULT NULL;

-- Add latitude/longitude columns if they don't exist
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS clock_in_lat DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS clock_in_lng DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS clock_out_lat DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS clock_out_lng DOUBLE PRECISION DEFAULT NULL;

-- ============ 2. ADD UNIQUE CONSTRAINT FOR user_id + date ============
-- First, create a function to extract date from clock_in timestamp
CREATE OR REPLACE FUNCTION public.get_attendance_date(clock_in_time TIMESTAMPTZ)
RETURNS DATE AS $$
BEGIN
  RETURN (clock_in_time AT TIME ZONE 'Asia/Jakarta')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a unique index on user_id and the date portion of clock_in
-- This prevents duplicate attendance records for the same user on the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date_unique 
ON public.attendance (user_id, public.get_attendance_date(clock_in));

-- ============ 3. CREATE audit_logs TABLE ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    old_data JSONB,
    new_data JSONB,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_table ON public.audit_logs (target_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ 4. RLS POLICIES FOR audit_logs ============
-- Only admins can view all audit logs
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can insert audit logs (or via service role)
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Service role bypass for Edge Functions
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (true);

-- Managers can view audit logs for their actions only
CREATE POLICY "Managers can view own audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'manager'::public.app_role) 
  AND user_id = auth.uid()
);

-- ============ 5. FUNCTION TO CALCULATE work_hours ON clock_out ============
CREATE OR REPLACE FUNCTION public.calculate_work_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate work hours when clock_out is set
  IF NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL THEN
    NEW.work_hours := ROUND(
      EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate work_hours
DROP TRIGGER IF EXISTS trigger_calculate_work_hours ON public.attendance;
CREATE TRIGGER trigger_calculate_work_hours
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_work_hours();

-- ============ 6. FUNCTION TO LOG AUDIT ACTIONS ============
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_user_id UUID,
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data, description)
  VALUES (p_user_id, p_action, p_target_table, p_target_id, p_old_data, p_new_data, p_description)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ 7. UPDATE attendance TRIGGER FOR updated_at ============
-- Ensure updated_at is always set on any update
DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.audit_logs IS 'Stores audit trail for admin and manager actions';
COMMENT ON COLUMN public.attendance.work_hours IS 'Automatically calculated work duration in hours';
