const { query } = require('../config/db');

const NUMBER_FALLBACK = 0;

function toNumber(value, fallback = NUMBER_FALLBACK) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRounded(value, decimals = 2) {
  const parsed = toNumber(value, 0);
  return Number(parsed.toFixed(decimals));
}

function deriveTrend(percentageChange, threshold = 5) {
  if (percentageChange > threshold) return 'increasing';
  if (percentageChange < -threshold) return 'decreasing';
  return 'stable';
}

function settledValue(result, fallback) {
  return result && result.status === 'fulfilled' ? result.value : fallback;
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function resolveDepartmentRiskColumns() {
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'department_risk_metrics'`
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  const pick = (...candidates) => candidates.find((name) => columns.has(name)) || null;

  return {
    department: pick('department', 'department_name', 'dept', 'dept_name', 'department_id'),
    riskScore: pick('risk_score', 'score', 'risk', 'department_risk_score'),
    lastUpdated: pick('last_updated', 'updated_at', 'snapshot_at', 'created_at'),
  };
}

async function resolveAccusedProfileColumns() {
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'accused_profiles'`
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  const pick = (...candidates) => candidates.find((name) => columns.has(name)) || null;

  return {
    accusedHash: pick('accused_employee_hash', 'employee_ref', 'accused_hash'),
    totalComplaints: pick('total_complaints', 'complaint_count'),
    guiltyCount: pick('guilty_count'),
    riskLevel: pick('risk_level'),
  };
}

async function getEscalationIndex() {
  const result = await query(
    `SELECT
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS current_count,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '60 days'
                AND created_at < NOW() - INTERVAL '30 days'
                THEN 1 ELSE 0 END)::int AS previous_count
     FROM complaints`
  );

  const row = result.rows[0] || {};
  const current = toNumber(row.current_count, 0);
  const previous = toNumber(row.previous_count, 0);
  const percentageChange = previous === 0
    ? (current > 0 ? 100 : 0)
    : ((current - previous) / previous) * 100;

  return {
    current_count: current,
    previous_count: previous,
    percentage_change: toRounded(percentageChange),
    trend: deriveTrend(percentageChange),
  };
}

async function getRepeatOffenders(limit = 10) {
  let result;
  try {
    const cols = await resolveAccusedProfileColumns();
    if (cols.accusedHash && cols.totalComplaints && cols.guiltyCount && cols.riskLevel) {
      const accusedHashCol = quoteIdentifier(cols.accusedHash);
      const totalComplaintsCol = quoteIdentifier(cols.totalComplaints);
      const guiltyCountCol = quoteIdentifier(cols.guiltyCount);
      const riskLevelCol = quoteIdentifier(cols.riskLevel);

      result = await query(
        `WITH recurrence AS (
          SELECT
            accused_employee_hash,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (created_at - prev_created_at)) / 86400.0)::numeric,
              2
            ) AS recurrence_interval_days
          FROM (
            SELECT
              accused_employee_hash,
              created_at,
              LAG(created_at) OVER (
                PARTITION BY accused_employee_hash
                ORDER BY created_at
              ) AS prev_created_at
            FROM complaints
          ) staged
          WHERE prev_created_at IS NOT NULL
          GROUP BY accused_employee_hash
        )
        SELECT
          ${accusedHashCol}::text AS accused_employee_hash,
          ${totalComplaintsCol}::int AS total_complaints,
          ${guiltyCountCol}::int AS guilty_count,
          ${riskLevelCol}::text AS risk_level,
          COALESCE(r.recurrence_interval_days, NULL) AS recurrence_interval
        FROM accused_profiles ap
        LEFT JOIN recurrence r
          ON r.accused_employee_hash = ${accusedHashCol}::text
        WHERE ${totalComplaintsCol} >= 2
          AND (${guiltyCountCol} >= 1 OR ${riskLevelCol} = 'high')
        ORDER BY ${totalComplaintsCol} DESC, ${guiltyCountCol} DESC
        LIMIT $1`,
        [limit]
      );
    } else {
      throw new Error('accused_profiles fields unavailable');
    }
  } catch (err) {
    result = await query(
      `WITH recurrence AS (
        SELECT
          accused_employee_hash,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (created_at - prev_created_at)) / 86400.0)::numeric,
            2
          ) AS recurrence_interval_days
        FROM (
          SELECT
            accused_employee_hash,
            created_at,
            LAG(created_at) OVER (
              PARTITION BY accused_employee_hash
              ORDER BY created_at
            ) AS prev_created_at
          FROM complaints
        ) staged
        WHERE prev_created_at IS NOT NULL
        GROUP BY accused_employee_hash
      ),
      rollup AS (
        SELECT
          c.accused_employee_hash,
          COUNT(*)::int AS total_complaints,
          SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::int AS guilty_count
        FROM complaints c
        LEFT JOIN verdicts v
          ON v.complaint_id = c.id
        GROUP BY c.accused_employee_hash
      )
      SELECT
        r.accused_employee_hash,
        r.total_complaints,
        r.guilty_count,
        CASE
          WHEN r.guilty_count >= 2 OR r.total_complaints >= 5 THEN 'high'
          WHEN r.guilty_count >= 1 OR r.total_complaints >= 3 THEN 'medium'
          ELSE 'low'
        END AS risk_level,
        COALESCE(rec.recurrence_interval_days, NULL) AS recurrence_interval
      FROM rollup r
      LEFT JOIN recurrence rec
        ON rec.accused_employee_hash = r.accused_employee_hash
      WHERE r.total_complaints >= 2
        AND (r.guilty_count >= 1 OR r.total_complaints >= 4)
      ORDER BY r.total_complaints DESC, r.guilty_count DESC
      LIMIT $1`,
      [limit]
    );
  }

  return result.rows.map((row) => ({
    accused_employee_hash: row.accused_employee_hash,
    total_complaints: toNumber(row.total_complaints),
    guilty_count: toNumber(row.guilty_count),
    risk_level: row.risk_level,
    recurrence_interval: row.recurrence_interval === null ? null : toRounded(row.recurrence_interval),
  }));
}

async function getTargetingAlerts(limit = 25) {
  const result = await query(
    `WITH verdict_rollup AS (
      SELECT
        c.accused_employee_hash,
        SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::int AS guilty_count
      FROM complaints c
      LEFT JOIN verdicts v
        ON v.complaint_id = c.id
      GROUP BY c.accused_employee_hash
    )
    SELECT
      c.accused_employee_hash,
      COUNT(*)::int AS complaint_count,
      ROUND(AVG(au.credibility_score)::numeric, 2) AS avg_credibility
    FROM complaints c
    JOIN anonymous_users au
      ON au.id = c.anon_user_id
    JOIN verdict_rollup vr
      ON vr.accused_employee_hash = c.accused_employee_hash
    GROUP BY c.accused_employee_hash, vr.guilty_count
    HAVING COUNT(*) >= 3
      AND COALESCE(vr.guilty_count, 0) = 0
      AND AVG(au.credibility_score) < 60
    ORDER BY complaint_count DESC, avg_credibility ASC
    LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => {
    const complaintCount = toNumber(row.complaint_count);
    const avgCredibility = toRounded(row.avg_credibility);
    const alertLevel = complaintCount >= 5 || avgCredibility < 45 ? 'high' : 'medium';

    return {
      accused_employee_hash: row.accused_employee_hash,
      complaint_count: complaintCount,
      avg_credibility: avgCredibility,
      alert_level: alertLevel,
    };
  });
}

async function getLowEvidenceRatio() {
  const result = await query(
    `WITH complaint_evidence AS (
      SELECT
        c.id,
        c.created_at,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM evidence_files ef
            WHERE ef.complaint_id = c.id
          ) THEN 1
          ELSE 0
        END AS has_evidence
      FROM complaints c
    )
    SELECT
      ROUND(
        100.0 * SUM(CASE WHEN has_evidence = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        2
      ) AS no_evidence_percentage,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS current_total,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' AND has_evidence = 0 THEN 1 ELSE 0 END)::int AS current_no_evidence,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '60 days'
                AND created_at < NOW() - INTERVAL '30 days'
                THEN 1 ELSE 0 END)::int AS previous_total,
      SUM(CASE WHEN created_at >= NOW() - INTERVAL '60 days'
                AND created_at < NOW() - INTERVAL '30 days'
                AND has_evidence = 0 THEN 1 ELSE 0 END)::int AS previous_no_evidence
    FROM complaint_evidence`
  );

  const row = result.rows[0] || {};
  const noEvidencePercentage = toRounded(row.no_evidence_percentage || 0);
  const currentTotal = toNumber(row.current_total);
  const currentNoEvidence = toNumber(row.current_no_evidence);
  const previousTotal = toNumber(row.previous_total);
  const previousNoEvidence = toNumber(row.previous_no_evidence);

  const currentRatio = currentTotal === 0 ? 0 : (currentNoEvidence / currentTotal) * 100;
  const previousRatio = previousTotal === 0 ? 0 : (previousNoEvidence / previousTotal) * 100;
  const ratioChange = currentRatio - previousRatio;

  return {
    no_evidence_percentage: noEvidencePercentage,
    trend_last_30_days: {
      current_ratio: toRounded(currentRatio),
      previous_ratio: toRounded(previousRatio),
      percentage_change: toRounded(ratioChange),
      trend: deriveTrend(ratioChange, 3),
    },
  };
}

async function getDepartmentRisk(limit = 5) {
  try {
    const cols = await resolveDepartmentRiskColumns();
    if (!cols.department || !cols.riskScore || !cols.lastUpdated) {
      return [];
    }

    const departmentCol = quoteIdentifier(cols.department);
    const riskScoreCol = quoteIdentifier(cols.riskScore);
    const lastUpdatedCol = quoteIdentifier(cols.lastUpdated);

    const result = await query(
      `WITH normalized AS (
        SELECT
          ${departmentCol}::text AS department,
          CASE
            WHEN ${riskScoreCol}::text ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN ${riskScoreCol}::numeric
            ELSE NULL
          END AS risk_score,
          ${lastUpdatedCol} AS last_updated
        FROM department_risk_metrics
      ),
      ranked AS (
        SELECT
          department,
          risk_score,
          last_updated,
          LAG(risk_score) OVER (
            PARTITION BY department
            ORDER BY last_updated DESC
          ) AS previous_risk_score,
          ROW_NUMBER() OVER (
            PARTITION BY department
            ORDER BY last_updated DESC
          ) AS rn
        FROM normalized
        WHERE department IS NOT NULL
          AND risk_score IS NOT NULL
          AND last_updated IS NOT NULL
      )
      SELECT
        department,
        risk_score,
        last_updated,
        previous_risk_score,
        ROUND(
          100.0 * (risk_score - previous_risk_score) / NULLIF(previous_risk_score, 0),
          2
        ) AS risk_change_percentage
      FROM ranked
      WHERE rn = 1
      ORDER BY risk_score DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => {
      const riskChange = row.risk_change_percentage === null ? 0 : toRounded(row.risk_change_percentage);
      const escalationFlag = row.previous_risk_score !== null && riskChange > 20;

      return {
        department: row.department,
        risk_score: toRounded(row.risk_score),
        previous_risk_score: row.previous_risk_score === null ? null : toRounded(row.previous_risk_score),
        risk_change_percentage: riskChange,
        escalation_flag: escalationFlag,
        last_updated: row.last_updated,
      };
    });
  } catch (err) {
    return [];
  }
}

async function getTimeTrends() {
  let result;
  try {
    result = await query(
      `WITH weekly_series AS (
        SELECT GENERATE_SERIES(
          DATE_TRUNC('week', NOW()) - INTERVAL '11 weeks',
          DATE_TRUNC('week', NOW()),
          INTERVAL '1 week'
        )::date AS week_start
      )
      SELECT
        ws.week_start,
        COALESCE(mv.complaints_count, 0) AS complaints_count,
        COALESCE(mv.avg_severity_score, 0) AS avg_severity_score,
        COALESCE(mv.guilty_verdict_rate, 0) AS guilty_verdict_rate
      FROM weekly_series ws
      LEFT JOIN hr_pattern_weekly_mv mv
        ON mv.week_start = ws.week_start
      ORDER BY ws.week_start ASC`
    );
  } catch (err) {
    result = await query(
      `WITH weekly_agg AS (
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
        WHERE c.created_at >= DATE_TRUNC('week', NOW()) - INTERVAL '11 weeks'
        GROUP BY week_start
      ),
      weekly_series AS (
        SELECT GENERATE_SERIES(
          DATE_TRUNC('week', NOW()) - INTERVAL '11 weeks',
          DATE_TRUNC('week', NOW()),
          INTERVAL '1 week'
        )::date AS week_start
      )
      SELECT
        ws.week_start,
        COALESCE(wa.complaints_count, 0) AS complaints_count,
        COALESCE(wa.avg_severity_score, 0) AS avg_severity_score,
        COALESCE(wa.guilty_verdict_rate, 0) AS guilty_verdict_rate
      FROM weekly_series ws
      LEFT JOIN weekly_agg wa
        ON wa.week_start = ws.week_start
      ORDER BY ws.week_start ASC`
    );
  }

  return result.rows.map((row) => ({
    week_start: row.week_start,
    complaints_count: toNumber(row.complaints_count),
    avg_severity_score: toRounded(row.avg_severity_score),
    guilty_verdict_rate: toRounded(row.guilty_verdict_rate),
  }));
}

async function getSuspiciousComplainants(limit = 20) {
  const riskyResult = await query(
    `SELECT
      c.anon_user_id,
      au.credibility_score,
      COUNT(*)::int AS total_complaints,
      ROUND(
        100.0 * SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        2
      ) AS rejected_ratio
    FROM complaints c
    JOIN anonymous_users au
      ON au.id = c.anon_user_id
    GROUP BY c.anon_user_id, au.credibility_score
    HAVING au.credibility_score < 60
       AND COUNT(*) >= 3
       AND (SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float) > 0.5
    ORDER BY rejected_ratio DESC, total_complaints DESC
    LIMIT $1`,
    [limit]
  );

  const riskyUsers = riskyResult.rows.map((row) => ({
    anon_user_id: row.anon_user_id,
    credibility_score: toRounded(row.credibility_score),
    total_complaints: toNumber(row.total_complaints),
    rejected_ratio: toRounded(row.rejected_ratio),
    credibility_trend: [],
  }));

  if (riskyUsers.length === 0) return riskyUsers;

  const userIds = riskyUsers.map((row) => row.anon_user_id);
  let trendRows = [];
  try {
    const trendResult = await query(
      `SELECT
        anon_user_id,
        credibility_score,
        created_at
      FROM credibility_history
      WHERE anon_user_id::text = ANY($1::text[])
      ORDER BY created_at DESC`,
      [userIds]
    );
    trendRows = trendResult.rows;
  } catch (err) {
    trendRows = [];
  }

  const trendMap = new Map();
  for (const row of trendRows) {
    if (!trendMap.has(row.anon_user_id)) {
      trendMap.set(row.anon_user_id, []);
    }
    const points = trendMap.get(row.anon_user_id);
    if (points.length < 8) {
      points.push({
        credibility_score: toRounded(row.credibility_score),
        created_at: row.created_at,
      });
    }
  }

  return riskyUsers.map((row) => ({
    ...row,
    credibility_trend: (trendMap.get(row.anon_user_id) || []).reverse(),
  }));
}

async function getRiskAcceleration(limit = 25) {
  const result = await query(
    `SELECT
      accused_employee_hash,
      COUNT(*)::int AS recent_complaint_count
    FROM complaints
    WHERE created_at >= NOW() - INTERVAL '14 days'
    GROUP BY accused_employee_hash
    HAVING COUNT(*) >= 2
    ORDER BY recent_complaint_count DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    accused_employee_hash: row.accused_employee_hash,
    recent_complaint_count: toNumber(row.recent_complaint_count),
    time_window_days: 14,
  }));
}

async function getOverview() {
  const settled = await Promise.allSettled([
    getEscalationIndex(),
    query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT
           c.accused_employee_hash,
           COUNT(*)::int AS total_complaints,
           SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::int AS guilty_count
         FROM complaints c
         LEFT JOIN verdicts v
           ON v.complaint_id = c.id
         GROUP BY c.accused_employee_hash
         HAVING COUNT(*) >= 2
           AND (SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END) >= 1 OR COUNT(*) >= 4)
       ) high_risk`
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT c.accused_employee_hash
         FROM complaints c
         JOIN anonymous_users au
           ON au.id = c.anon_user_id
         JOIN accused_profiles ap
           ON ap.accused_employee_hash = c.accused_employee_hash
         GROUP BY c.accused_employee_hash, ap.guilty_count
         HAVING COUNT(*) >= 3
            AND ap.guilty_count = 0
            AND AVG(au.credibility_score) < 60
       ) t`
    ),
    getLowEvidenceRatio(),
    query(`SELECT COUNT(*)::int AS count FROM complaints WHERE status = 'under_review'`),
    query(
      `SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0)::numeric,
        2
      ) AS avg_resolution_hours
      FROM complaints
      WHERE status IN ('resolved', 'rejected')`
    ),
  ]);

  const escalationIndex = settledValue(settled[0], {
    current_count: 0,
    previous_count: 0,
    percentage_change: 0,
    trend: 'stable',
  });
  const highRiskAccusedCount = toNumber(settledValue(settled[1], { rows: [{ count: 0 }] }).rows?.[0]?.count || 0);
  const targetingAlertsCount = toNumber(settledValue(settled[2], { rows: [{ count: 0 }] }).rows?.[0]?.count || 0);
  const lowEvidence = settledValue(settled[3], {
    no_evidence_percentage: 0,
    trend_last_30_days: {
      current_ratio: 0,
      previous_ratio: 0,
      percentage_change: 0,
      trend: 'stable',
    },
  });
  const activeUnderReview = settledValue(settled[4], { rows: [{ count: 0 }] });
  const avgResolution = settledValue(settled[5], { rows: [{ avg_resolution_hours: 0 }] });

  return {
    escalation_index: escalationIndex,
    high_risk_accused_count: highRiskAccusedCount,
    targeting_alerts_count: targetingAlertsCount,
    low_evidence_percentage: lowEvidence.no_evidence_percentage,
    low_evidence_trend: lowEvidence.trend_last_30_days,
    avg_resolution_time_hours: toRounded(avgResolution.rows[0]?.avg_resolution_hours || 0),
    active_under_review: toNumber(activeUnderReview.rows[0]?.count || 0),
  };
}

function buildInsights({
  escalationIndex,
  departmentRisk,
  repeatOffenders,
  targetingAlerts,
  riskAcceleration,
  lowEvidence,
}) {
  const insights = [];

  if (escalationIndex.percentage_change > 25) {
    insights.push({
      severity: 'high',
      message: 'Complaint volume increased significantly in the last 30 days.',
    });
  }

  const escalatedDepartment = departmentRisk.find((row) => row.escalation_flag);
  if (escalatedDepartment) {
    insights.push({
      severity: 'high',
      message: `Department ${escalatedDepartment.department} shows elevated risk growth.`,
    });
  }

  const fastRecurrence = repeatOffenders.find(
    (row) => row.recurrence_interval !== null && row.recurrence_interval <= 14
  );
  if (fastRecurrence) {
    insights.push({
      severity: 'medium',
      message: 'Behavioral escalation pattern detected from decreasing complaint intervals.',
    });
  }

  if (targetingAlerts.some((row) => row.alert_level === 'high')) {
    insights.push({
      severity: 'high',
      message: 'Possible coordinated targeting behavior detected.',
    });
  }

  if (riskAcceleration.length > 0) {
    insights.push({
      severity: 'medium',
      message: 'Risk acceleration detected with rapid repeat complaints in 14-day windows.',
    });
  }

  if (lowEvidence.no_evidence_percentage >= 60) {
    insights.push({
      severity: 'medium',
      message: 'Evidence quality decline detected: a high share of complaints are missing evidence files.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      severity: 'low',
      message: 'No critical escalation signals detected in current observation window.',
    });
  }

  return insights;
}

async function getInsightsBundle() {
  const settled = await Promise.allSettled([
    getEscalationIndex(),
    getRepeatOffenders(10),
    getTargetingAlerts(25),
    getDepartmentRisk(5),
    getRiskAcceleration(25),
    getLowEvidenceRatio(),
  ]);

  const escalationIndex = settledValue(settled[0], {
    current_count: 0,
    previous_count: 0,
    percentage_change: 0,
    trend: 'stable',
  });
  const repeatOffenders = settledValue(settled[1], []);
  const targetingAlerts = settledValue(settled[2], []);
  const departmentRisk = settledValue(settled[3], []);
  const riskAcceleration = settledValue(settled[4], []);
  const lowEvidence = settledValue(settled[5], {
    no_evidence_percentage: 0,
    trend_last_30_days: {
      current_ratio: 0,
      previous_ratio: 0,
      percentage_change: 0,
      trend: 'stable',
    },
  });

  return buildInsights({
    escalationIndex,
    departmentRisk,
    repeatOffenders,
    targetingAlerts,
    riskAcceleration,
    lowEvidence,
  });
}

async function getAccusedBreakdown(accusedEmployeeHash) {
  const [statusRows, weeklyRows, evidenceRow] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM complaints
       WHERE accused_employee_hash = $1
       GROUP BY status`,
      [accusedEmployeeHash]
    ),
    query(
      `WITH weekly_agg AS (
        SELECT
          DATE_TRUNC('week', c.created_at) AS week_start,
          COUNT(*)::int AS complaint_count,
          ROUND(AVG(c.severity_score)::numeric, 2) AS avg_severity
        FROM complaints c
        WHERE c.accused_employee_hash = $1
          AND c.created_at >= DATE_TRUNC('week', NOW()) - INTERVAL '7 weeks'
        GROUP BY week_start
      ),
      weekly_series AS (
        SELECT GENERATE_SERIES(
          DATE_TRUNC('week', NOW()) - INTERVAL '7 weeks',
          DATE_TRUNC('week', NOW()),
          INTERVAL '1 week'
        ) AS week_start
      )
      SELECT
        ws.week_start::date AS week_start,
        COALESCE(wa.complaint_count, 0) AS complaint_count,
        COALESCE(wa.avg_severity, 0) AS avg_severity
      FROM weekly_series ws
      LEFT JOIN weekly_agg wa
        ON wa.week_start = ws.week_start
      ORDER BY ws.week_start`,
      [accusedEmployeeHash]
    ),
    query(
      `SELECT
        COUNT(*)::int AS total_complaints,
        SUM(CASE WHEN evidence_count = 0 THEN 1 ELSE 0 END)::int AS no_evidence_complaints
      FROM (
        SELECT
          c.id,
          COUNT(ef.id)::int AS evidence_count
        FROM complaints c
        LEFT JOIN evidence_files ef
          ON ef.complaint_id = c.id
        WHERE c.accused_employee_hash = $1
        GROUP BY c.id
      ) staged`,
      [accusedEmployeeHash]
    ),
  ]);

  const statusMap = {
    submitted: 0,
    under_review: 0,
    resolved: 0,
    rejected: 0,
  };

  for (const row of statusRows.rows) {
    if (row.status in statusMap) {
      statusMap[row.status] = toNumber(row.count);
    }
  }

  const totalComplaints = toNumber(evidenceRow.rows[0]?.total_complaints, 0);
  const noEvidenceComplaints = toNumber(evidenceRow.rows[0]?.no_evidence_complaints, 0);

  return {
    accused_employee_hash: accusedEmployeeHash,
    status_breakdown: statusMap,
    weekly_timeline: weeklyRows.rows.map((row) => ({
      week_start: row.week_start,
      complaint_count: toNumber(row.complaint_count, 0),
      avg_severity: toRounded(row.avg_severity || 0),
    })),
    no_evidence_ratio: totalComplaints === 0 ? 0 : toRounded((noEvidenceComplaints / totalComplaints) * 100),
  };
}

async function getSuspiciousClusters({ limit = 25, reviewStatus = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeStatus = reviewStatus ? String(reviewStatus).trim().toLowerCase() : null;
  const allowedStatus = safeStatus && ['pending', 'reviewed', 'dismissed'].includes(safeStatus)
    ? safeStatus
    : null;

  try {
    const result = await query(
      `SELECT
         id,
         accused_employee_hash,
         cluster_suspicion_score,
         diversity_index,
         complaint_ids,
         unique_device_count,
         similarity_cluster_count,
         review_status,
         created_at,
         updated_at
       FROM suspicious_clusters
       WHERE ($1::text IS NULL OR review_status = $1)
       ORDER BY cluster_suspicion_score DESC, updated_at DESC
       LIMIT $2`,
      [allowedStatus, safeLimit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      accused_employee_hash: row.accused_employee_hash,
      cluster_suspicion_score: toNumber(row.cluster_suspicion_score),
      diversity_index: toNumber(row.diversity_index),
      complaint_ids: Array.isArray(row.complaint_ids) ? row.complaint_ids : [],
      unique_device_count: toNumber(row.unique_device_count),
      similarity_cluster_count: toNumber(row.similarity_cluster_count),
      review_status: row.review_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    const message = String(err?.message || '').toLowerCase();
    const isMissingRelation = message.includes('relation') && message.includes('does not exist');
    if (isMissingRelation) {
      return [];
    }
    throw err;
  }
}

async function getAccusedComplaints(accusedEmployeeHash, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const result = await query(
    `SELECT
       c.id,
       c.complaint_code,
       c.status,
       c.severity_score,
       c.incident_date,
       c.created_at,
       c.updated_at,
       COUNT(ef.id)::int AS evidence_count,
       v.verdict,
       v.decided_at
     FROM complaints c
     LEFT JOIN evidence_files ef
       ON ef.complaint_id = c.id
     LEFT JOIN verdicts v
       ON v.complaint_id = c.id
     WHERE c.accused_employee_hash = $1
     GROUP BY c.id, v.verdict, v.decided_at
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [accusedEmployeeHash, safeLimit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    complaint_code: row.complaint_code,
    status: row.status,
    severity_score: toRounded(row.severity_score),
    incident_date: row.incident_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    evidence_count: toNumber(row.evidence_count),
    verdict: row.verdict || null,
    decided_at: row.decided_at || null,
  }));
}

module.exports = {
  getEscalationIndex,
  getRepeatOffenders,
  getTargetingAlerts,
  getLowEvidenceRatio,
  getDepartmentRisk,
  getTimeTrends,
  getSuspiciousComplainants,
  getRiskAcceleration,
  getOverview,
  getInsightsBundle,
  getAccusedBreakdown,
  getSuspiciousClusters,
  getAccusedComplaints,
};
