const { query, sql } = require('../config/db');

const ELIGIBLE_HR_ROLES = ['hr', 'committee', 'admin'];

async function createComplaint(payload) {
  const result = await query(
    `INSERT INTO complaints (
      complaint_code,
      anon_user_id,
      accused_employee_hash,
      incident_date,
      location,
      description,
      status,
      severity_score
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [
      payload.complaint_code,
      payload.anon_user_id,
      payload.accused_employee_hash,
      payload.incident_date,
      payload.location,
      payload.description,
      payload.status,
      payload.severity_score,
    ]
  );

  return result.rows[0];
}

async function listForReporter(anonUserId) {
  const result = await query(
    `SELECT * FROM complaints
     WHERE anon_user_id = $1
     ORDER BY created_at DESC`,
    [anonUserId]
  );

  return result.rows;
}

async function listForHr() {
  const result = await query('SELECT * FROM complaints ORDER BY created_at DESC');
  return result.rows;
}

async function listForHrQueue() {
  const result = await query(
    `SELECT
      c.*,
      hu.name AS assigned_hr_name,
      au.credibility_score,
      COALESCE(c.workflow_status::text, CASE
        WHEN c.status = 'under_review' THEN 'under_review'
        WHEN c.status = 'resolved' THEN 'resolved'
        WHEN c.status = 'rejected' THEN 'rejected'
        WHEN c.assigned_hr_id IS NOT NULL THEN 'in_progress'
        ELSE 'open'
      END) AS workflow_status_resolved
     FROM complaints c
     LEFT JOIN hr_users hu ON hu.id = c.assigned_hr_id
     LEFT JOIN anonymous_users au ON au.id = c.anon_user_id
     WHERE c.status NOT IN ('resolved', 'rejected')
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

async function listResolvedHistoryForHr(hrUserId) {
  const result = await query(
    `SELECT
      c.*,
      hu.name AS assigned_hr_name,
      au.credibility_score,
      COALESCE(c.workflow_status::text, CASE
        WHEN c.status = 'under_review' THEN 'under_review'
        WHEN c.status = 'resolved' THEN 'resolved'
        WHEN c.status = 'rejected' THEN 'rejected'
        WHEN c.assigned_hr_id IS NOT NULL THEN 'in_progress'
        ELSE 'open'
      END) AS workflow_status_resolved
     FROM complaints c
     LEFT JOIN hr_users hu ON hu.id = c.assigned_hr_id
     LEFT JOIN anonymous_users au ON au.id = c.anon_user_id
     WHERE c.assigned_hr_id = $1
       AND c.status IN ('resolved', 'rejected')
     ORDER BY c.updated_at DESC, c.created_at DESC`,
    [hrUserId]
  );

  return result.rows;
}

async function listForHrDepartmentRisk() {
  const result = await query(
    `SELECT location, severity_score
     FROM complaints
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function getHrDashboardSummary() {
  const [metricsResult, weeklyTrendResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS total_today,
         COUNT(*) FILTER (
           WHERE created_at >= (CURRENT_DATE - INTERVAL '1 day')
             AND created_at < CURRENT_DATE
         )::int AS total_yesterday,
         COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))::int AS total_month,
         COUNT(*) FILTER (WHERE status = 'submitted')::int AS under_hr_review,
         COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_committee_review,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_cases,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_cases,
         COUNT(*) FILTER (
           WHERE severity_score >= 70
             AND status NOT IN ('resolved', 'rejected')
         )::int AS high_risk_cases,
         COUNT(*) FILTER (
           WHERE status NOT IN ('resolved', 'rejected')
             AND created_at < (NOW() - INTERVAL '7 days')
         )::int AS stale_cases
       FROM complaints`
    ),
    query(
      `SELECT
         gs.day::date AS day,
         COALESCE(c.count, 0)::int AS count
       FROM GENERATE_SERIES(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS gs(day)
       LEFT JOIN (
         SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM complaints
         WHERE created_at >= (CURRENT_DATE - INTERVAL '6 days')
         GROUP BY DATE(created_at)
       ) c ON c.day = gs.day::date
       ORDER BY gs.day ASC`
    ),
  ]);

  return {
    metrics: metricsResult.rows[0] || null,
    weeklyTrend: weeklyTrendResult.rows || [],
  };
}

async function findByReference(reference) {
  const result = await query(
    `SELECT
      c.*,
      hu.name AS assigned_hr_name,
      COALESCE(c.workflow_status::text, CASE
        WHEN c.status = 'under_review' THEN 'under_review'
        WHEN c.status = 'resolved' THEN 'resolved'
        WHEN c.status = 'rejected' THEN 'rejected'
        WHEN c.assigned_hr_id IS NOT NULL THEN 'in_progress'
        ELSE 'open'
      END) AS workflow_status_resolved
     FROM complaints c
     LEFT JOIN hr_users hu ON hu.id = c.assigned_hr_id
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
     LIMIT 1`,
    [reference]
  );

  return result.rows[0] || null;
}

async function findByReferenceForUser(reference, user) {
  const isHr = ['hr', 'committee', 'admin'].includes(user.role);
  const result = await query(
    `SELECT
      c.*,
      hu.name AS assigned_hr_name,
      COALESCE(c.workflow_status::text, CASE
        WHEN c.status = 'under_review' THEN 'under_review'
        WHEN c.status = 'resolved' THEN 'resolved'
        WHEN c.status = 'rejected' THEN 'rejected'
        WHEN c.assigned_hr_id IS NOT NULL THEN 'in_progress'
        ELSE 'open'
      END) AS workflow_status_resolved
     FROM complaints c
     LEFT JOIN hr_users hu ON hu.id = c.assigned_hr_id
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND ($2::boolean = true OR c.anon_user_id = $3)
     LIMIT 1`,
    [reference, isHr, user.id]
  );

  return result.rows[0] || null;
}

async function updateStatusByHr(reference, status, rejectionType = null) {
  const result = await query(
    `UPDATE complaints
     SET status = $2,
         rejection_type = $3,
         updated_at = NOW()
     WHERE complaint_code = $1 OR id::text = $1
     RETURNING *`,
    [reference, status, rejectionType]
  );

  return result.rows[0] || null;
}

async function acceptCase(reference, hrUserId) {
  const result = await query(
    `UPDATE complaints c
     SET
       assigned_hr_id = $2,
       accepted_at = NOW(),
       workflow_status = 'in_progress',
       status = 'submitted',
       updated_at = NOW()
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND c.assigned_hr_id IS NULL
       AND COALESCE(c.workflow_status::text, 'open') IN ('open', 'reopened')
       AND NOT EXISTS (
         SELECT 1
         FROM complaint_reaccept_blocks b
         WHERE b.complaint_code = c.complaint_code
           AND b.hr_user_id = $2
       )
     RETURNING c.*`,
    [reference, hrUserId]
  );

  return result.rows[0] || null;
}

async function submitInvestigatorDecision(reference, investigatorHrId, notes = null) {
  const result = await query(
    `UPDATE complaints c
     SET
       investigator_decision = NULL,
       investigator_decision_notes = $3,
       investigator_decision_by = $2,
       investigator_decision_at = NOW(),
       workflow_status = 'under_review',
       updated_at = NOW()
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND c.assigned_hr_id = $2
       AND COALESCE(c.workflow_status::text, 'open') = 'in_progress'
       AND c.status IN ('resolved', 'rejected')
     RETURNING c.*`,
    [reference, investigatorHrId, notes]
  );

  if (!result.rows[0]) return null;

  await query('DELETE FROM committee_votes WHERE complaint_code = $1', [result.rows[0].complaint_code]);
  return result.rows[0];
}

async function castCommitteeVote(reference, voterHrId, vote) {
  return sql.begin(async (tx) => {
    const complaintRows = await tx.unsafe(
      `SELECT *
       FROM complaints
       WHERE (complaint_code = $1 OR id::text = $1)
       FOR UPDATE`,
      [reference]
    );
    const complaint = complaintRows[0] || null;
    if (!complaint) return null;

    if (String(complaint.assigned_hr_id) === String(voterHrId)) {
      return { error: 'Assigned investigator cannot vote' };
    }

    if (String(complaint.workflow_status || (complaint.status === 'under_review' ? 'under_review' : 'open')) !== 'under_review') {
      return { error: 'Voting is only allowed when case is under review' };
    }

    await tx.unsafe(
      `INSERT INTO committee_votes (complaint_code, voter_hr_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (complaint_code, voter_hr_id)
       DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW()`,
      [complaint.complaint_code, voterHrId, vote]
    );

    const eligibleRows = await tx.unsafe(
      `SELECT COUNT(*)::int AS count
       FROM hr_users
       WHERE role::text = ANY($1::text[])
         AND id <> $2`,
      [ELIGIBLE_HR_ROLES, complaint.assigned_hr_id]
    );
    const eligibleCount = Number(eligibleRows[0]?.count || 0);

    const tallyRows = await tx.unsafe(
      `SELECT
         COUNT(*) FILTER (WHERE vote = 'support')::int AS support_count,
         COUNT(*) FILTER (WHERE vote = 'oppose')::int AS oppose_count
       FROM committee_votes
       WHERE complaint_code = $1`,
      [complaint.complaint_code]
    );
    const supportCount = Number(tallyRows[0]?.support_count || 0);
    const opposeCount = Number(tallyRows[0]?.oppose_count || 0);
    const threshold = eligibleCount > 0 ? Math.ceil((2 * eligibleCount) / 3) : 0;

    if (!['resolved', 'rejected'].includes(String(complaint.status))) {
      return { error: 'Case status must be resolved or rejected before committee review' };
    }

    let finalized = null;
    if (threshold > 0 && supportCount >= threshold) {
      const updatedRows = await tx.unsafe(
        `UPDATE complaints
         SET
           workflow_status = $2,
           status = $3,
           updated_at = NOW()
         WHERE complaint_code = $1
         RETURNING *`,
        [
          complaint.complaint_code,
          complaint.status === 'resolved' ? 'resolved_accepted' : 'resolved_rejected',
          complaint.status,
        ]
      );
      finalized = updatedRows[0] || null;
    } else if (threshold > 0 && opposeCount >= threshold) {
      const updatedRows = await tx.unsafe(
        `UPDATE complaints
         SET
           workflow_status = 'reopened',
           status = 'submitted',
           assigned_hr_id = NULL,
           accepted_at = NULL,
           investigator_decision = NULL,
           investigator_decision_notes = NULL,
           investigator_decision_by = NULL,
           investigator_decision_at = NULL,
           updated_at = NOW()
         WHERE complaint_code = $1
         RETURNING *`,
        [complaint.complaint_code]
      );
      await tx.unsafe(
        `INSERT INTO complaint_reaccept_blocks (complaint_code, hr_user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [complaint.complaint_code, complaint.assigned_hr_id]
      );
      await tx.unsafe('DELETE FROM committee_votes WHERE complaint_code = $1', [complaint.complaint_code]);
      finalized = updatedRows[0] || null;
    }

    return {
      complaint_code: complaint.complaint_code,
      eligible_count: eligibleCount,
      support_count: supportCount,
      oppose_count: opposeCount,
      threshold,
      finalized,
    };
  });
}

async function listCommitteeNotifications(hrUserId) {
  const result = await query(
    `SELECT
      c.id,
      c.complaint_code,
      c.workflow_status,
      c.status,
      c.assigned_hr_id,
      c.investigator_decision_notes,
      c.investigator_decision_at,
      c.updated_at,
      hu.name AS assigned_hr_name,
      v.vote AS my_vote,
      v.updated_at AS my_vote_updated_at
     FROM complaints c
     JOIN hr_users hu ON hu.id = c.assigned_hr_id
     LEFT JOIN committee_votes v
       ON v.complaint_code = c.complaint_code
      AND v.voter_hr_id = $1
     WHERE COALESCE(c.workflow_status::text, CASE WHEN c.status = 'under_review' THEN 'under_review' ELSE 'open' END) = 'under_review'
       AND c.assigned_hr_id <> $1
     ORDER BY c.investigator_decision_at DESC NULLS LAST, c.updated_at DESC`,
    [hrUserId]
  );

  return result.rows;
}

async function findNotificationCase(reference, hrUserId) {
  const result = await query(
    `SELECT
      c.*,
      hu.name AS assigned_hr_name,
      v.vote AS my_vote,
      v.updated_at AS my_vote_updated_at
     FROM complaints c
     JOIN hr_users hu ON hu.id = c.assigned_hr_id
     LEFT JOIN committee_votes v
       ON v.complaint_code = c.complaint_code
      AND v.voter_hr_id = $2
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND COALESCE(c.workflow_status::text, CASE WHEN c.status = 'under_review' THEN 'under_review' ELSE 'open' END) = 'under_review'
       AND c.assigned_hr_id <> $2
     LIMIT 1`,
    [reference, hrUserId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createComplaint,
  listForReporter,
  listForHr,
  listForHrQueue,
  listResolvedHistoryForHr,
  listForHrDepartmentRisk,
  getHrDashboardSummary,
  findByReference,
  findByReferenceForUser,
  updateStatusByHr,
  acceptCase,
  submitInvestigatorDecision,
  castCommitteeVote,
  listCommitteeNotifications,
  findNotificationCase,
};
