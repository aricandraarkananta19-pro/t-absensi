-- Migration: Create work_journals table for Work Journal Module
-- Created based on Architecture doc

BEGIN;

-- 1. Create work_journals table
CREATE TABLE IF NOT EXISTS public.work_journals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL, -- Optional link to specific attendance record
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    content TEXT NOT NULL, -- The actual journal entry
    category TEXT DEFAULT 'General', -- e.g., 'Development', 'Meeting', 'Support'
    duration INT DEFAULT 0, -- Time spent in minutes
    progress INT DEFAULT 100, -- Completion percentage (0-100)
    status TEXT DEFAULT 'completed', -- 'planned', 'in_progress', 'completed'
    ai_feedback JSONB DEFAULT NULL, -- To store AI suggestions or ratings later
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_work_journals_user_date ON public.work_journals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_journals_attendance ON public.work_journals(attendance_id);

-- 3. Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can View their own journals
CREATE POLICY "Users can view own journals" ON public.work_journals
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can Insert their own journals
CREATE POLICY "Users can insert own journals" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can Update their own journals
CREATE POLICY "Users can update own journals" ON public.work_journals
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Users can Delete their own journals
CREATE POLICY "Users can delete own journals" ON public.work_journals
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Admins and Managers can View ALL journals
CREATE POLICY "Admins and Managers can view all journals" ON public.work_journals
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- 5. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_work_journals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_journals_updated_at ON public.work_journals;
CREATE TRIGGER trigger_update_work_journals_updated_at
    BEFORE UPDATE ON public.work_journals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_work_journals_updated_at();

COMMIT;
