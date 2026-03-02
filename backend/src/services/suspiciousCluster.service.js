const { query } = require('../config/db');
const logger = require('../utils/logger');

const SUSPICIOUS_SCORE_THRESHOLD = Number(process.env.SUSPICIOUS_CLUSTER_THRESHOLD || 70);
const MAX_CLUSTER_COMPLAINT_IDS = 100;

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function uniqStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((item) => String(item)))];
}

function deriveDiversityIndex({ totalComplaints, uniqueDeviceCount }) {
  if (totalComplaints <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((uniqueDeviceCount / totalComplaints) * 100)));
}

function deriveSuspicionScore({ totalComplaints, recentComplaints7d, uniqueReporters, uniqueDeviceCount }) {
  let score = 0;

  if (totalComplaints >= 3) score += 35;
  if (recentComplaints7d >= 2) score += 25;

  const lowDeviceDiversityThreshold = Math.max(1, Math.floor(totalComplaints / 2));
  if (uniqueDeviceCount <= lowDeviceDiversityThreshold) score += 20;
  if (uniqueReporters >= 3 && uniqueDeviceCount <= 2) score += 20;

  return Math.max(0, Math.min(100, score));
}

function deriveFlagLabel(score) {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return null;
}

function isMissingTableError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('relation') && message.includes('does not exist');
}

async function aggregateAccusedSignals(accusedEmployeeHash) {
  const result = await query(
    `SELECT
       COUNT(*)::int AS total_complaints,
       COUNT(*) FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days')::int AS recent_complaints_7d,
       COUNT(DISTINCT c.anon_user_id)::int AS unique_reporters,
       COUNT(DISTINCT cm.device_hash)::int AS unique_device_count,
       ARRAY_AGG(c.id ORDER BY c.created_at DESC) FILTER (WHERE c.id IS NOT NULL) AS complaint_ids
     FROM complaints c
     LEFT JOIN complaint_metadata cm
       ON cm.complaint_id = c.id
     WHERE c.accused_employee_hash = $1`,
    [accusedEmployeeHash]
  );

  const row = result.rows[0] || {};
  const complaintIds = uniqStrings(row.complaint_ids).slice(0, MAX_CLUSTER_COMPLAINT_IDS);

  return {
    totalComplaints: toInt(row.total_complaints),
    recentComplaints7d: toInt(row.recent_complaints_7d),
    uniqueReporters: toInt(row.unique_reporters),
    uniqueDeviceCount: toInt(row.unique_device_count),
    complaintIds,
  };
}

async function upsertComplaintMetadata({
  complaintId,
  deviceFingerprint,
  suspicionScore,
  diversityIndex,
  flaggedAs,
}) {
  await query(
    `INSERT INTO complaint_metadata (
       complaint_id,
       device_hash,
       cluster_suspicion_score,
       diversity_index,
       flagged_as
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (complaint_id)
     DO UPDATE SET
       device_hash = EXCLUDED.device_hash,
       cluster_suspicion_score = EXCLUDED.cluster_suspicion_score,
       diversity_index = EXCLUDED.diversity_index,
       flagged_as = EXCLUDED.flagged_as`,
    [complaintId, deviceFingerprint, suspicionScore, diversityIndex, flaggedAs]
  );
}

async function upsertSuspiciousCluster({
  accusedEmployeeHash,
  suspicionScore,
  diversityIndex,
  complaintIds,
  uniqueDeviceCount,
  similarityClusterCount,
}) {
  const existing = await query(
    `SELECT id, complaint_ids
     FROM suspicious_clusters
     WHERE accused_employee_hash = $1
       AND review_status IN ('pending', 'reviewed')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [accusedEmployeeHash]
  );

  const existingRow = existing.rows[0] || null;
  if (existingRow) {
    const mergedComplaintIds = uniqStrings([...(existingRow.complaint_ids || []), ...complaintIds]).slice(
      0,
      MAX_CLUSTER_COMPLAINT_IDS
    );

    await query(
      `UPDATE suspicious_clusters
       SET cluster_suspicion_score = GREATEST(cluster_suspicion_score, $2),
           diversity_index = $3,
           complaint_ids = $4::uuid[],
           unique_device_count = $5,
           similarity_cluster_count = $6,
           updated_at = NOW()
       WHERE id = $1`,
      [
        existingRow.id,
        suspicionScore,
        diversityIndex,
        mergedComplaintIds,
        uniqueDeviceCount,
        similarityClusterCount,
      ]
    );
    return;
  }

  await query(
    `INSERT INTO suspicious_clusters (
       accused_employee_hash,
       cluster_suspicion_score,
       diversity_index,
       complaint_ids,
       unique_device_count,
       similarity_cluster_count,
       review_status
     ) VALUES ($1, $2, $3, $4::uuid[], $5, $6, 'pending')`,
    [
      accusedEmployeeHash,
      suspicionScore,
      diversityIndex,
      complaintIds,
      uniqueDeviceCount,
      similarityClusterCount,
    ]
  );
}

async function evaluateAndPersistSuspiciousCluster({ complaintId, accusedEmployeeHash, deviceFingerprint }) {
  if (!complaintId || !accusedEmployeeHash || !deviceFingerprint) return;

  try {
    const signals = await aggregateAccusedSignals(accusedEmployeeHash);
    const suspicionScore = deriveSuspicionScore(signals);
    const diversityIndex = deriveDiversityIndex(signals);
    const flaggedAs = deriveFlagLabel(suspicionScore);

    await upsertComplaintMetadata({
      complaintId,
      deviceFingerprint,
      suspicionScore,
      diversityIndex,
      flaggedAs,
    });

    if (suspicionScore < SUSPICIOUS_SCORE_THRESHOLD) return;

    const similarityClusterCount = Math.max(signals.totalComplaints - signals.uniqueDeviceCount, 0);
    await upsertSuspiciousCluster({
      accusedEmployeeHash,
      suspicionScore,
      diversityIndex,
      complaintIds: signals.complaintIds,
      uniqueDeviceCount: signals.uniqueDeviceCount,
      similarityClusterCount,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      logger.warn('Suspicious cluster tables are not available; skipping persistence.', {
        accusedEmployeeHash,
      });
      return;
    }

    logger.error('Failed to evaluate/persist suspicious cluster.', {
      accusedEmployeeHash,
      message: err.message,
    });
  }
}

module.exports = {
  evaluateAndPersistSuspiciousCluster,
};
