-- Add soft delete columns to work_journals if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_journals' AND column_name = 'deleted_at') THEN
        ALTER TABLE work_journals ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_journals' AND column_name = 'delete_reason') THEN
        ALTER TABLE work_journals ADD COLUMN delete_reason TEXT DEFAULT NULL;
    END IF;
END $$;
