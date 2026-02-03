-- Fix: Cleanly Apply Work Journal Schema & Policies
-- Drops existing policies to prevent "already exists" errors

BEGIN;

-- 1. Create table if not exists (Idempotent)
CREATE TABLE IF NOT EXISTS public.work_journals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    duration INT DEFAULT 0,
    progress INT DEFAULT 100,
    status TEXT DEFAULT 'completed',
    ai_feedback JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_work_journals_user_date ON public.work_journals(user_id, date);

-- 3. Enable RLS
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- 4. Drop ALL existing policies for this table to start fresh
DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view all journals" ON public.work_journals;

-- 5. Re-create Policies
CREATE POLICY "Users can view own journals" ON public.work_journals
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journals" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journals" ON public.work_journals
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journals" ON public.work_journals
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and Managers can view all journals" ON public.work_journals
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'manager'::public.app_role)
);

COMMIT;
