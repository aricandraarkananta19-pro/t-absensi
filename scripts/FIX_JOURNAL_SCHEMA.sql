-- ==============================================================================
-- FIX MISSING COLUMNS IN WORK_JOURNALS
-- ==============================================================================
-- Run this script in your Supabase SQL Editor if you want to restore the 'title' column
-- and ensure other fields exist.
-- ==============================================================================

BEGIN;

-- 1. Add 'title' column if it doesn't exist
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Add 'obstacles' column if it doesn't exist (used for Project Category in some views)
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS obstacles TEXT;

-- 3. Add 'verification_status' if missing (though unlikely given RLS policies)
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'submitted';

-- 4. Add 'work_result' and 'mood' if missing
ALTER TABLE public.work_journals 
ADD COLUMN IF NOT EXISTS work_result TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT '😊';

-- 5. Add comment for clarity
COMMENT ON COLUMN public.work_journals.title IS 'Short title/summary of the journal entry';

COMMIT;

-- Note:
-- After running this, you can revert the code changes in JurnalSaya.tsx to use the title column again
-- if you prefer storing it separately.
