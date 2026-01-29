
-- Create attendance_periods table
CREATE TABLE IF NOT EXISTS public.attendance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;

-- Create policies for attendance_periods
CREATE POLICY "Enable read access for authenticated users" 
ON public.attendance_periods FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable write access for admins only" 
ON public.attendance_periods FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Insert initial period starting today if none exists
INSERT INTO public.attendance_periods (start_date, is_active)
SELECT CURRENT_DATE, true
WHERE NOT EXISTS (SELECT 1 FROM public.attendance_periods WHERE is_active = true);
