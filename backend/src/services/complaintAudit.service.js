const { query } = require('../config/db');

const DETAILS_VIEWED_DEDUP_MINUTES = 15;

function toSafeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

async function shouldWriteDetailsViewedLog({ complaintId, hrId }) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM complaint_audit_logs
     WHERE complaint_id = $1
       AND hr_id = $2
       AND action_type = 'DETAILS_VIEWED'
       AND created_at > NOW() - INTERVAL '${DETAILS_VIEWED_DEDUP_MINUTES} minutes'`,
    [complaintId, hrId]
  );

  return Number(result.rows[0]?.count || 0) === 0;
}

async function logComplaintAction({
  complaintId,
  hrId,
  actionType,
  metadata = {},
  ipAddress,
}) {
  if (!complaintId || !hrId || !actionType) {
    throw new Error('complaintId, hrId, and actionType are required for complaint audit logging');
  }

  if (actionType === 'DETAILS_VIEWED') {
    const shouldLog = await shouldWriteDetailsViewedLog({ complaintId, hrId });
    if (!shouldLog) return null;
  }

  const result = await query(
    `INSERT INTO complaint_audit_logs (complaint_id, hr_id, action_type, metadata, ip_address)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [complaintId, hrId, actionType, JSON.stringify(toSafeMetadata(metadata)), ipAddress || null]
  );

  return result.rows[0] || null;
}

module.exports = {
  logComplaintAction,
};
