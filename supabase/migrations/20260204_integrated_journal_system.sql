-- ==============================================================================
-- INTEGRATED WORK JOURNAL SYSTEM - Complete Implementation
-- ==============================================================================
-- This migration ensures the work journal system is fully connected,
-- with proper status tracking, activity logging, and role-based access.
-- ==============================================================================

-- 1. ENSURE SCHEMA COMPLETENESS
-- ==============================================================================

-- Add missing columns if they don't exist
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(user_id);

-- Standardize status values (ensure consistency)
-- Acceptable values: 'draft', 'submitted', 'need_revision', 'approved'
UPDATE public.work_journals 
SET verification_status = 'need_revision' 
WHERE verification_status = 'rejected';

-- 2. CREATE ACTIVITY LOG TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.journal_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_id UUID NOT NULL REFERENCES public.work_journals(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'submitted', 'approved', 'revision_requested', 'edited', 'deleted'
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    previous_status TEXT,
    new_status TEXT,
    notes TEXT, -- For manager notes during revision
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_journal_activity_journal_id ON public.journal_activity_log(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_activity_created_at ON public.journal_activity_log(created_at);

-- Enable RLS on Activity Log
ALTER TABLE public.journal_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow re-running
DROP POLICY IF EXISTS "View Journal Activity" ON public.journal_activity_log;
DROP POLICY IF EXISTS "Insert Journal Activity" ON public.journal_activity_log;

-- Activity log visible to Admin, Manager, and the journal author
CREATE POLICY "View Journal Activity" ON public.journal_activity_log
FOR SELECT TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR performed_by = auth.uid()
    OR journal_id IN (SELECT id FROM public.work_journals WHERE user_id = auth.uid())
);

-- Authenticated users can insert (system will handle authorization)
CREATE POLICY "Insert Journal Activity" ON public.journal_activity_log
FOR INSERT TO authenticated
WITH CHECK (true);


-- 3. TRIGGER: AUTO-LOG STATUS CHANGES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_journal_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log only if verification_status changed
    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
        INSERT INTO public.journal_activity_log (
            journal_id,
            action,
            performed_by,
            previous_status,
            new_status,
            notes
        ) VALUES (
            NEW.id,
            CASE NEW.verification_status
                WHEN 'submitted' THEN 'submitted'
                WHEN 'approved' THEN 'approved'
                WHEN 'need_revision' THEN 'revision_requested'
                ELSE 'status_changed'
            END,
            auth.uid(),
            OLD.verification_status,
            NEW.verification_status,
            NEW.manager_notes
        );
        
        -- Set timestamps
        IF NEW.verification_status = 'submitted' AND OLD.verification_status = 'draft' THEN
            NEW.submitted_at := now();
        END IF;
        
        IF NEW.verification_status = 'approved' THEN
            NEW.approved_at := now();
            NEW.approved_by := auth.uid();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_journal_status ON public.work_journals;
CREATE TRIGGER trigger_log_journal_status
    BEFORE UPDATE ON public.work_journals
    FOR EACH ROW
    EXECUTE FUNCTION public.log_journal_status_change();


-- 4. TRIGGER: LOG JOURNAL CREATION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_journal_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.journal_activity_log (
        journal_id,
        action,
        performed_by,
        previous_status,
        new_status,
        notes
    ) VALUES (
        NEW.id,
        'created',
        auth.uid(),
        NULL,
        NEW.verification_status,
        NULL
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_journal_creation ON public.work_journals;
CREATE TRIGGER trigger_log_journal_creation
    AFTER INSERT ON public.work_journals
    FOR EACH ROW
    EXECUTE FUNCTION public.log_journal_creation();


-- 5. OPTIMIZED RLS POLICIES (Clean Slate)
-- ==============================================================================

-- Clear ALL existing policies
DROP POLICY IF EXISTS "View Journals" ON public.work_journals;
DROP POLICY IF EXISTS "View Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Insert Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Update Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals" ON public.work_journals;
DROP POLICY IF EXISTS "Delete Journals Enhanced" ON public.work_journals;
DROP POLICY IF EXISTS "Users can view own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can insert own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can update own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Users can delete own journals" ON public.work_journals;
DROP POLICY IF EXISTS "Admins and Managers can view all journals" ON public.work_journals;
-- Also drop our new policy names to allow re-running
DROP POLICY IF EXISTS "journal_select_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_insert_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_update_policy" ON public.work_journals;
DROP POLICY IF EXISTS "journal_delete_policy" ON public.work_journals;

-- VIEW POLICY
-- Employee: See own journals (all statuses)
-- Manager: See non-draft journals from their department
-- Admin: See all non-draft journals
CREATE POLICY "journal_select_policy" ON public.work_journals
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()  -- Author sees own
    OR (
        public.has_role(auth.uid(), 'admin')
        AND verification_status != 'draft'  -- Admin sees all except drafts
    )
    OR (
        public.has_role(auth.uid(), 'manager')
        AND verification_status != 'draft'  -- Manager sees non-drafts
        AND (
            manager_id = auth.uid()  -- Assigned to this manager
            OR department = (SELECT department FROM public.profiles WHERE user_id = auth.uid())
        )
    )
);

-- INSERT POLICY
-- Only the authenticated user can create journals for themselves
CREATE POLICY "journal_insert_policy" ON public.work_journals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE POLICY
-- Employee: Can update own if DRAFT or NEED_REVISION
-- Manager/Admin: Can update to approve/request revision
CREATE POLICY "journal_update_policy" ON public.work_journals
FOR UPDATE TO authenticated
USING (
    (user_id = auth.uid() AND verification_status IN ('draft', 'need_revision'))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
);

-- DELETE POLICY
-- Employee: Can delete own DRAFT or SUBMITTED journals
-- Admin: Can delete any (for cleanup)
CREATE POLICY "journal_delete_policy" ON public.work_journals
FOR DELETE TO authenticated
USING (
    (user_id = auth.uid() AND verification_status IN ('draft', 'submitted'))
    OR public.has_role(auth.uid(), 'admin')
);


-- 6. BACKFILL: Assign Department & Manager to Existing Journals
-- ==============================================================================

DO $$
BEGIN
    -- Backfill department from author's profile
    UPDATE public.work_journals wj
    SET department = p.department
    FROM public.profiles p
    WHERE wj.user_id = p.user_id
    AND wj.department IS NULL;
    
    -- Backfill manager_id by finding a manager in the same department
    UPDATE public.work_journals wj
    SET manager_id = (
        SELECT ur.user_id
        FROM public.user_roles ur
        JOIN public.profiles mp ON mp.user_id = ur.user_id
        WHERE ur.role = 'manager'
        AND mp.department = wj.department
        LIMIT 1
    )
    WHERE wj.manager_id IS NULL
    AND wj.department IS NOT NULL;
END $$;


-- 7. INDEXES FOR PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_work_journals_user ON public.work_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_work_journals_date ON public.work_journals(date);
CREATE INDEX IF NOT EXISTS idx_work_journals_status ON public.work_journals(verification_status);
CREATE INDEX IF NOT EXISTS idx_work_journals_department ON public.work_journals(department);
CREATE INDEX IF NOT EXISTS idx_work_journals_manager ON public.work_journals(manager_id);


-- 8. GRANT PERMISSIONS
-- ==============================================================================

GRANT ALL ON public.work_journals TO authenticated;
GRANT ALL ON public.work_journals TO service_role;
GRANT ALL ON public.journal_activity_log TO authenticated;
GRANT ALL ON public.journal_activity_log TO service_role;
