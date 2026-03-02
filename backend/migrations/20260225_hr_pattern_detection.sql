BEGIN;

-- Performance indexes for deterministic risk analytics
CREATE INDEX IF NOT EXISTS idx_complaints_created_at
  ON complaints (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_accused_created
  ON complaints (accused_employee_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_status_created
  ON complaints (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_anon_status
  ON complaints (anon_user_id, status);

CREATE INDEX IF NOT EXISTS idx_verdicts_complaint_verdict
  ON verdicts (complaint_id, verdict);

CREATE INDEX IF NOT EXISTS idx_evidence_files_complaint
  ON evidence_files (complaint_id);

CREATE INDEX IF NOT EXISTS idx_credibility_history_user_created
  ON credibility_history (anon_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_department_risk_metrics_dept_updated
  ON department_risk_metrics (department, last_updated DESC);

-- Optional pre-aggregation for weekly pattern trend charts
CREATE MATERIALIZED VIEW IF NOT EXISTS hr_pattern_weekly_mv AS
SELECT
  DATE_TRUNC('week', c.created_at)::date AS week_start,
  COUNT(*)::int AS complaints_count,
  ROUND(AVG(c.severity_score)::numeric, 2) AS avg_severity_score,
  ROUND(
    100.0 * SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END) / NULLIF(COUNT(v.id), 0),
    2
  ) AS guilty_verdict_rate
FROM complaints c
LEFT JOIN verdicts v
  ON v.complaint_id = c.id
GROUP BY DATE_TRUNC('week', c.created_at)::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_pattern_weekly_mv_week_start
  ON hr_pattern_weekly_mv (week_start);

COMMIT;
