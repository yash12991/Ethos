const { query } = require('../config/db');

async function incrementComplaintCount(accusedEmployeeHash) {
  const result = await query(
    `INSERT INTO accused_profiles (accused_employee_hash, total_complaints)
     VALUES ($1, 1)
     ON CONFLICT (accused_employee_hash)
     DO UPDATE SET
       total_complaints = accused_profiles.total_complaints + 1,
       updated_at = NOW()
     RETURNING *`,
    [accusedEmployeeHash]
  );

  return result.rows[0];
}

async function incrementGuiltyCount(accusedEmployeeHash) {
  const result = await query(
    `UPDATE accused_profiles
     SET guilty_count = guilty_count + 1,
         updated_at = NOW()
     WHERE accused_employee_hash = $1
     RETURNING *`,
    [accusedEmployeeHash]
  );

  return result.rows[0] || null;
}

async function listAccusedPatterns() {
  const result = await query(
    `SELECT accused_employee_hash,
            total_complaints,
            guilty_count,
            credibility_score,
            risk_level,
            updated_at
     FROM accused_profiles
     ORDER BY total_complaints DESC, guilty_count DESC`
  );

  return result.rows;
}

async function getAccusedProfileCount() {
  const result = await query('SELECT COUNT(*)::int AS count FROM accused_profiles');
  return result.rows[0]?.count || 0;
}

async function getRiskDistribution() {
  const result = await query(
    `SELECT risk_level, COUNT(*)::int AS count
     FROM accused_profiles
     GROUP BY risk_level`
  );
  return result.rows;
}

async function getStatusFunnel() {
  const result = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM complaints
     GROUP BY status`
  );
  return result.rows;
}

async function getSeverityRiskMatrix() {
  const result = await query(
    `SELECT
       CASE
         WHEN c.severity_score >= 70 THEN 'high'
         WHEN c.severity_score >= 40 THEN 'medium'
         ELSE 'low'
       END AS severity_bucket,
       COALESCE(ap.risk_level, 'unknown') AS risk_level,
       COUNT(*)::int AS count
     FROM complaints c
     LEFT JOIN accused_profiles ap
       ON ap.accused_employee_hash = c.accused_employee_hash
     GROUP BY severity_bucket, risk_level`
  );
  return result.rows;
}

async function getAccusedConversion() {
  const result = await query(
    `SELECT
       c.accused_employee_hash,
       COUNT(*)::int AS total_complaints,
       COUNT(v.id)::int AS complaints_with_verdict,
       SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::int AS guilty_verdicts,
       ROUND(
         100.0 * SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)
         / NULLIF(COUNT(v.id), 0),
         2
       ) AS guilty_rate
     FROM complaints c
     LEFT JOIN verdicts v ON v.complaint_id = c.id
     GROUP BY c.accused_employee_hash
     ORDER BY total_complaints DESC, guilty_verdicts DESC`
  );
  return result.rows;
}

async function getMedianVerdictHours() {
  const result = await query(
    `SELECT
       ROUND(
         percentile_cont(0.5) WITHIN GROUP (
           ORDER BY EXTRACT(EPOCH FROM (v.decided_at - c.created_at)) / 3600.0
         )::numeric,
         2
       ) AS median_hours
     FROM verdicts v
     JOIN complaints c ON c.id = v.complaint_id`
  );
  return result.rows[0]?.median_hours || null;
}

async function getHighRiskWatchlist(limit = 15) {
  const result = await query(
    `SELECT
       c.id,
       c.complaint_code,
       c.accused_employee_hash,
       c.severity_score,
       c.status,
       c.created_at,
       ap.risk_level,
       ap.total_complaints,
       ap.guilty_count
     FROM complaints c
     JOIN accused_profiles ap ON ap.accused_employee_hash = c.accused_employee_hash
     WHERE ap.risk_level = 'high'
       AND c.severity_score >= 70
       AND c.status IN ('submitted', 'under_review')
     ORDER BY c.severity_score DESC, c.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getPatternAlertStats() {
  const [highRiskOpen, repeatNoVerdict, highGuiltyRate] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM complaints c
       JOIN accused_profiles ap ON ap.accused_employee_hash = c.accused_employee_hash
       WHERE ap.risk_level = 'high'
         AND c.status IN ('submitted', 'under_review')`
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT c.accused_employee_hash
         FROM complaints c
         LEFT JOIN verdicts v ON v.complaint_id = c.id
         GROUP BY c.accused_employee_hash
         HAVING COUNT(*) >= 3 AND COUNT(v.id) = 0
       ) t`
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT c.accused_employee_hash,
                COUNT(v.id) AS verdict_count,
                SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::float
                  / NULLIF(COUNT(v.id), 0)::float AS guilty_rate
         FROM complaints c
         LEFT JOIN verdicts v ON v.complaint_id = c.id
         GROUP BY c.accused_employee_hash
         HAVING COUNT(v.id) >= 2
            AND (SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::float
                  / NULLIF(COUNT(v.id), 0)::float) > 0.5
       ) t`
    ),
  ]);

  return {
    high_risk_open_count: highRiskOpen.rows[0]?.count || 0,
    repeat_without_verdict_count: repeatNoVerdict.rows[0]?.count || 0,
    high_guilty_rate_count: highGuiltyRate.rows[0]?.count || 0,
  };
}

module.exports = {
  incrementComplaintCount,
  incrementGuiltyCount,
  listAccusedPatterns,
  getAccusedProfileCount,
  getRiskDistribution,
  getStatusFunnel,
  getSeverityRiskMatrix,
  getAccusedConversion,
  getMedianVerdictHours,
  getHighRiskWatchlist,
  getPatternAlertStats,
};
