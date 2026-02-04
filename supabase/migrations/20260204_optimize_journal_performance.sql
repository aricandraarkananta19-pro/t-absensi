-- ============================================================================
-- PENGOPTIMALAN PERFORMA JURNAL KERJA (WORK JOURNAL OPTIMIZATION)
-- Date: 2026-02-04
-- Description: Menambahkan index dan fungsi helper untuk performa tinggi
-- ============================================================================

-- 1. INDEXING (CRITICAL FOR READ PERFORMANCE)
-- Mempercepat filter berdasarkan tanggal (paling sering digunakan)
CREATE INDEX IF NOT EXISTS idx_work_journals_date ON work_journals(date DESC);

-- Mempercepat filter berdasarkan user_id (untuk profile join & history)
CREATE INDEX IF NOT EXISTS idx_work_journals_user_id ON work_journals(user_id);

-- Mempercepat filter status (untuk tab 'Perlu Review', 'Revisi', dll)
CREATE INDEX IF NOT EXISTS idx_work_journals_status ON work_journals(verification_status);

-- Composite index untuk query umum: "Jurnal tanggal X dengan status Y"
CREATE INDEX IF NOT EXISTS idx_work_journals_date_status 
ON work_journals(date DESC, verification_status);


-- 2. HELPER FUNCTION UNTUK STATISTIK CEPAT
-- Menghindari client-side counting yang berat. Mengembalikan semua count dalam 1 request.
-- Usage: SELECT * FROM get_manager_journal_stats();

CREATE OR REPLACE FUNCTION get_manager_journal_stats()
RETURNS TABLE (
  total_entries BIGINT,
  pending_review BIGINT,
  need_revision BIGINT,
  approved BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_entries,
    COUNT(*) FILTER (WHERE verification_status = 'submitted')::BIGINT as pending_review,
    COUNT(*) FILTER (WHERE verification_status = 'need_revision')::BIGINT as need_revision,
    COUNT(*) FILTER (WHERE verification_status = 'approved')::BIGINT as approved
  FROM work_journals;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_manager_journal_stats() TO authenticated;

-- Summary for Weekly Chart (Graph)
-- Usage: SELECT * FROM get_weekly_journal_activity('2026-02-01', '2026-02-07');
CREATE OR REPLACE FUNCTION get_weekly_journal_activity(start_date DATE, end_date DATE)
RETURNS TABLE (
  activity_date DATE,
  entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date::DATE as activity_date,
    COUNT(*)::BIGINT as entry_count
  FROM work_journals
  WHERE date >= start_date AND date <= end_date
  GROUP BY date
  ORDER BY date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_weekly_journal_activity(date, date) TO authenticated;
