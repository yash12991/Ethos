const { query } = require('../config/db');

async function createEvidence({ complaint_id, file_url, file_hash_sha256, metadata }) {
  const result = await query(
    `INSERT INTO evidence_files (
      complaint_id,
      file_url,
      file_hash_sha256,
      metadata
    ) VALUES ($1,$2,$3,$4)
    RETURNING *`,
    [complaint_id, file_url, file_hash_sha256, metadata]
  );

  return result.rows[0];
}

async function listEvidenceForComplaint(complaintReference) {
  const result = await query(
    `SELECT ef.*
     FROM evidence_files ef
     JOIN complaints c ON c.id = ef.complaint_id
     WHERE (c.complaint_code = $1 OR c.id::text = $1)
     ORDER BY ef.uploaded_at DESC`,
    [complaintReference]
  );

  return result.rows;
}

async function countEvidenceByComplaintId(complaintId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM evidence_files
     WHERE complaint_id = $1`,
    [complaintId]
  );

  return result.rows[0]?.count || 0;
}

module.exports = {
  createEvidence,
  listEvidenceForComplaint,
  countEvidenceByComplaintId,
};
