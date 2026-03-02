const { query } = require('../config/db');

async function upsertVerdict({ complaint_id, verdict, notes, decided_by }) {
  const result = await query(
    `INSERT INTO verdicts (complaint_id, verdict, notes, decided_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (complaint_id)
     DO UPDATE SET
       verdict = EXCLUDED.verdict,
       notes = EXCLUDED.notes,
       decided_by = EXCLUDED.decided_by,
       decided_at = NOW()
     RETURNING *`,
    [complaint_id, verdict, notes, decided_by]
  );

  return result.rows[0];
}

async function getVerdictByComplaint(reference, user) {
  const isHr = ['hr', 'committee', 'admin'].includes(user.role);
  const result = await query(
    `SELECT v.*
     FROM verdicts v
     JOIN complaints c ON c.id = v.complaint_id
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND ($2::boolean = true OR c.anon_user_id = $3)
     LIMIT 1`,
    [reference, isHr, user.id]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertVerdict,
  getVerdictByComplaint,
};
