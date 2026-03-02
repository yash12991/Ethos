const { query } = require('../config/db');

async function ensureThreadForComplaint(complaintId) {
  const result = await query(
    `INSERT INTO chat_threads (complaint_id)
     VALUES ($1)
     ON CONFLICT (complaint_id)
     DO UPDATE SET complaint_id = EXCLUDED.complaint_id
     RETURNING id`,
    [complaintId]
  );

  return result.rows[0].id;
}

async function createMessage({ complaint_id, sender_type, message }) {
  const threadId = await ensureThreadForComplaint(complaint_id);
  const result = await query(
    `INSERT INTO chat_messages (thread_id, sender_type, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [threadId, sender_type, message]
  );

  return result.rows[0];
}

async function listMessages(complaintReference, user) {
  const isHr = ['hr', 'committee', 'admin'].includes(user.role);
  const result = await query(
    `SELECT cm.*, ct.complaint_id, c.complaint_code, c.status AS complaint_status
     FROM chat_messages cm
     JOIN chat_threads ct ON ct.id = cm.thread_id
     JOIN complaints c ON c.id = ct.complaint_id
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
       AND (
         ($2::boolean = true AND c.assigned_hr_id = $3)
         OR ($2::boolean = false AND c.anon_user_id = $3)
       )
     ORDER BY cm.created_at ASC`,
    [complaintReference, isHr, user.id]
  );

  return result.rows;
}

async function listThreadSummaries(user) {
  const isHr = ['hr', 'committee', 'admin'].includes(user.role);
  const result = await query(
    `SELECT
       ct.id AS thread_id,
       ct.complaint_id,
       c.complaint_code,
       c.status AS complaint_status,
       ct.created_at AS thread_created_at,
       lm.id AS last_message_id,
       lm.sender_type AS last_sender_type,
       lm.message AS last_message,
       lm.created_at AS last_message_at
     FROM chat_threads ct
     JOIN complaints c ON c.id = ct.complaint_id
     LEFT JOIN LATERAL (
       SELECT cm.id, cm.sender_type, cm.message, cm.created_at
       FROM chat_messages cm
       WHERE cm.thread_id = ct.id
       ORDER BY cm.created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE (
       ($1::boolean = true AND c.assigned_hr_id = $2)
       OR ($1::boolean = false AND c.anon_user_id = $2)
     )
     ORDER BY COALESCE(lm.created_at, ct.created_at) DESC`,
    [isHr, user.id]
  );

  return result.rows;
}

module.exports = {
  createMessage,
  listMessages,
  listThreadSummaries,
};
