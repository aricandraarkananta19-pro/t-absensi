-- Optimasi Stats Khusus Admin (Hari ini & Total Status)
CREATE OR REPLACE FUNCTION get_admin_journal_stats()
RETURNS TABLE (
  total_today BIGINT,
  avg_duration_today NUMERIC,
  pending_total BIGINT,
  need_revision_total BIGINT,
  approved_total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE date = CURRENT_DATE)::BIGINT as total_today,
    COALESCE(AVG(duration) FILTER (WHERE date = CURRENT_DATE), 0)::NUMERIC as avg_duration_today,
    COUNT(*) FILTER (WHERE verification_status = 'submitted' OR status = 'submitted')::BIGINT as pending_total,
    COUNT(*) FILTER (WHERE verification_status = 'need_revision' OR status = 'need_revision')::BIGINT as need_revision_total,
    COUNT(*) FILTER (WHERE verification_status = 'approved' OR status = 'approved')::BIGINT as approved_total
  FROM work_journals;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_journal_stats() TO authenticated;
