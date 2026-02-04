-- ============================================================================
-- Work Journal UI Redesign - Database Enhancement
-- Version: 2.1
-- Date: 2026-02-04
-- Description: Add work_result, obstacles, and mood fields for enhanced journal entries
-- ============================================================================

-- Add new columns to work_journals table
ALTER TABLE work_journals 
ADD COLUMN IF NOT EXISTS work_result TEXT CHECK (work_result IN ('completed', 'progress', 'pending')),
ADD COLUMN IF NOT EXISTS obstacles TEXT,
ADD COLUMN IF NOT EXISTS mood TEXT CHECK (mood IN ('😊', '😐', '😣')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add comment for clarity
COMMENT ON COLUMN work_journals.work_result IS 'Work completion status: completed, progress, pending';
COMMENT ON COLUMN work_journals.obstacles IS 'Any obstacles or challenges faced during work';
COMMENT ON COLUMN work_journals.mood IS 'Employee work mood indicator: 😊 (good), 😐 (neutral), 😣 (difficult)';
COMMENT ON COLUMN work_journals.updated_at IS 'Timestamp when journal was last updated';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_journal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_journal_timestamp ON work_journals;
CREATE TRIGGER trigger_update_work_journal_timestamp
    BEFORE UPDATE ON work_journals
    FOR EACH ROW
    EXECUTE FUNCTION update_work_journal_updated_at();

-- ============================================================================
-- Enhanced Journal Activity Log for Audit Trail
-- ============================================================================

-- Ensure journal_activity_log exists with proper structure
CREATE TABLE IF NOT EXISTS journal_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES work_journals(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'submitted', 'approved', 'revision_requested', 'revision_submitted')),
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    previous_status TEXT,
    new_status TEXT,
    previous_content TEXT,
    new_content TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_activity_log_journal_id ON journal_activity_log(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_activity_log_performed_by ON journal_activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_journal_activity_log_created_at ON journal_activity_log(created_at DESC);

-- ============================================================================
-- Automatic Audit Logging Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION log_journal_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type TEXT;
    v_notes TEXT DEFAULT NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        
        INSERT INTO journal_activity_log (
            journal_id, action, performed_by, 
            new_status, new_content, created_at
        ) VALUES (
            NEW.id, action_type, NEW.user_id,
            NEW.verification_status, NEW.content, now()
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine action type based on status change
        IF OLD.verification_status != NEW.verification_status THEN
            CASE NEW.verification_status
                WHEN 'submitted' THEN
                    IF OLD.verification_status = 'need_revision' THEN
                        action_type := 'revision_submitted';
                    ELSE
                        action_type := 'submitted';
                    END IF;
                WHEN 'approved' THEN
                    action_type := 'approved';
                WHEN 'need_revision' THEN
                    action_type := 'revision_requested';
                    v_notes := NEW.manager_notes;
                ELSE
                    action_type := 'updated';
            END CASE;
        ELSE
            action_type := 'updated';
        END IF;
        
        INSERT INTO journal_activity_log (
            journal_id, action, performed_by,
            previous_status, new_status,
            previous_content, new_content,
            notes, created_at
        ) VALUES (
            NEW.id, action_type, auth.uid(),
            OLD.verification_status, NEW.verification_status,
            CASE WHEN OLD.content != NEW.content THEN OLD.content ELSE NULL END,
            CASE WHEN OLD.content != NEW.content THEN NEW.content ELSE NULL END,
            v_notes, now()
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO journal_activity_log (
            journal_id, action, performed_by,
            previous_status, previous_content, created_at
        ) VALUES (
            OLD.id, 'deleted', auth.uid(),
            OLD.verification_status, OLD.content, now()
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_log_journal_changes ON work_journals;
CREATE TRIGGER trigger_log_journal_changes
    AFTER INSERT OR UPDATE OR DELETE ON work_journals
    FOR EACH ROW
    EXECUTE FUNCTION log_journal_changes();

-- ============================================================================
-- RLS Policies for Journal Activity Log
-- ============================================================================

ALTER TABLE journal_activity_log ENABLE ROW LEVEL SECURITY;

-- Employees can see activity log for their own journals
DROP POLICY IF EXISTS "employees_view_own_journal_activity" ON journal_activity_log;
CREATE POLICY "employees_view_own_journal_activity" ON journal_activity_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM work_journals wj 
            WHERE wj.id = journal_activity_log.journal_id 
            AND wj.user_id = auth.uid()
        )
    );

-- Managers can see activity log for their team's journals
DROP POLICY IF EXISTS "managers_view_team_journal_activity" ON journal_activity_log;
CREATE POLICY "managers_view_team_journal_activity" ON journal_activity_log
    FOR SELECT
    USING (
        public.has_role(auth.uid(), 'manager'::public.app_role)
    );

-- Admins can see all activity logs
DROP POLICY IF EXISTS "admins_view_all_journal_activity" ON journal_activity_log;
CREATE POLICY "admins_view_all_journal_activity" ON journal_activity_log
    FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- ============================================================================
-- Summary
-- ============================================================================
-- New fields added to work_journals:
--   - work_result: 'completed', 'progress', 'pending'
--   - obstacles: Free text for challenges/notes
--   - mood: '😊', '😐', '😣' (work mood indicator)
--   - updated_at: Auto-updated timestamp
--
-- Enhanced audit logging:
--   - All create/update/delete actions logged
--   - Previous and new values stored
--   - RLS policies for role-based access
-- ============================================================================
