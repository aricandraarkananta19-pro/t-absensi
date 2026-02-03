-- 1. Schema Improvements
-- Add Department, Manager Link, and Submission Timestamp
ALTER TABLE public.work_journals
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 1.1 Backfill Existing Data (Crucial for Visibility)
DO $$
BEGIN
    UPDATE public.work_journals wj
    SET
        department = p.department,
        manager_id = (
            SELECT ur.user_id
            FROM public.profiles mgr_p
            JOIN public.user_roles ur ON ur.user_id = mgr_p.user_id
            WHERE mgr_p.department = p.department
            AND ur.role = 'manager'
            LIMIT 1
        )
    FROM public.profiles p
    WHERE wj.user_id = p.user_id
    AND (wj.department IS NULL);
END $$;

-- 2. Trigger Function to Automate Fields
CREATE OR REPLACE FUNCTION public.handle_journal_meta_updates()
RETURNS TRIGGER AS $$
DECLARE
    emp_department TEXT;
    mgr_id UUID;
BEGIN
    -- Get the author's department
    SELECT department INTO emp_department
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    -- Set the department on the journal (Snapshot)
    NEW.department := emp_department;

    -- If status changes to submitted, set timestamp
    IF (OLD.verification_status IS DISTINCT FROM 'submitted' AND NEW.verification_status = 'submitted') THEN
        NEW.submitted_at := now();
    END IF;

    -- Try to assign a Manager automatically based on Department
    -- We look for a user who has 'manager' role in the same department
    -- Exclude the user themselves (if they are a manager)
    SELECT p.user_id INTO mgr_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.department = emp_department
    AND ur.role = 'manager'
    AND p.user_id != NEW.user_id
    LIMIT 1;

    NEW.manager_id := mgr_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register Trigger
DROP TRIGGER IF EXISTS trigger_journal_meta_update ON public.work_journals;
CREATE TRIGGER trigger_journal_meta_update
    BEFORE INSERT OR UPDATE ON public.work_journals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_journal_meta_updates();

-- 4. Optimized RLS Policies (Replaces previous patches)
ALTER TABLE public.work_journals ENABLE ROW LEVEL SECURITY;

-- Clear old policies to avoid conflicts
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;

-- VIEW POLICY
-- 1. Author can always see their own
-- 2. Admin can see ALL
-- 3. Manager can see journals where they are assigned AS manager_id OR same Department
CREATE POLICY "View Journals Enhanced" ON public.work_journals
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() -- Author
    OR
    public.has_role(auth.uid(), 'admin') -- Admin
    OR
    (
        public.has_role(auth.uid(), 'manager') 
        AND (
            manager_id = auth.uid() -- Assigned Manager
            OR
            department = (SELECT department FROM public.profiles WHERE user_id = auth.uid()) -- Department Manager fallback
        )
        AND verification_status != 'draft' -- Managers don't see drafts
    )
);

-- UPDATE POLICY
CREATE POLICY "Update Journals Enhanced" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() -- Author
    OR
    public.has_role(auth.uid(), 'admin')
    OR
    (
         public.has_role(auth.uid(), 'manager') 
         AND (
            manager_id = auth.uid() OR 
            department = (SELECT department FROM public.profiles WHERE user_id = auth.uid())
         )
    )
);

-- INSERT POLICY
CREATE POLICY "Insert Journals Enhanced" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- DELETE POLICY (Only Author, Only Draft)
CREATE POLICY "Delete Journals Enhanced" ON public.work_journals
FOR DELETE TO authenticated
USING (
    user_id = auth.uid() 
    AND verification_status = 'draft'
);
