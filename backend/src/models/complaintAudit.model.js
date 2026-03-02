const { query } = require('../config/db');

async function listComplaintAuditLogs({
  page = 1,
  limit = 10,
  search = '',
  actionType = '',
  hrId = '',
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const searchPattern = `%${normalizedSearch}%`;
  const normalizedActionType = String(actionType || '').trim().toUpperCase();
  const hasActionType = normalizedActionType.length > 0;
  const normalizedHrId = String(hrId || '').trim();
  const hasHrId = normalizedHrId.length > 0;

  const [countResult, rowsResult, actionRowsResult, hrRowsResult] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total
       FROM complaint_audit_logs l
       JOIN complaints c ON c.id = l.complaint_id
       JOIN hr_users h ON h.id = l.hr_id
       WHERE (
         $1::boolean = false
         OR c.complaint_code ILIKE $2
         OR l.action_type ILIKE $2
         OR h.name ILIKE $2
       )
       AND ($3::boolean = false OR l.action_type = $4)
       AND ($5::boolean = false OR l.hr_id::text = $6)`,
      [hasSearch, searchPattern, hasActionType, normalizedActionType, hasHrId, normalizedHrId]
    ),
    query(
      `SELECT
         l.id,
         l.complaint_id,
         c.complaint_code,
         l.hr_id,
         h.name AS hr_name,
         l.action_type,
         l.metadata,
         l.ip_address,
         l.created_at
       FROM complaint_audit_logs l
       JOIN complaints c ON c.id = l.complaint_id
       JOIN hr_users h ON h.id = l.hr_id
       WHERE (
         $1::boolean = false
         OR c.complaint_code ILIKE $2
         OR l.action_type ILIKE $2
         OR h.name ILIKE $2
       )
       AND ($3::boolean = false OR l.action_type = $4)
       AND ($5::boolean = false OR l.hr_id::text = $6)
       ORDER BY l.created_at DESC
       LIMIT $7 OFFSET $8`,
      [
        hasSearch,
        searchPattern,
        hasActionType,
        normalizedActionType,
        hasHrId,
        normalizedHrId,
        safeLimit,
        offset,
      ]
    ),
    query(
      `SELECT DISTINCT action_type
       FROM complaint_audit_logs
       ORDER BY action_type ASC`
    ),
    query(
      `SELECT DISTINCT l.hr_id, h.name AS hr_name
       FROM complaint_audit_logs l
       JOIN hr_users h ON h.id = l.hr_id
       ORDER BY h.name ASC`
    ),
  ]);

  const total = Number(countResult.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    rows: rowsResult.rows.map((row) => ({
      id: row.id,
      complaint_id: row.complaint_id,
      complaint_code: row.complaint_code,
      hr_id: row.hr_id,
      hr_name: row.hr_name,
      action_type: row.action_type,
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
      ip_address: row.ip_address || null,
      created_at: row.created_at,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: totalPages,
    },
    filters: {
      action_types: actionRowsResult.rows.map((row) => String(row.action_type)).filter(Boolean),
      hr_users: hrRowsResult.rows.map((row) => ({
        id: row.hr_id,
        name: row.hr_name,
      })),
    },
  };
}

module.exports = {
  listComplaintAuditLogs,
};
