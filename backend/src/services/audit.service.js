const { query } = require('../config/db');
const logger = require('../utils/logger');

async function logAuditEvent({
  actorUserId,
  action,
  userType = 'system',
  entityType,
  entityId,
  metadata = {},
  ipHash = null,
}) {
  logger.info('Audit event', {
    actorUserId,
    userType,
    action,
    entityType,
    entityId,
    metadata,
  });

  try {
    await query(
      `INSERT INTO audit_logs (user_type, user_id, action, ip_hash)
       VALUES ($1, $2, $3, $4)`,
      [userType, actorUserId || null, action, ipHash]
    );
  } catch (err) {
    logger.error('Failed to persist audit log', { error: err.message });
  }
}

module.exports = {
  logAuditEvent,
};
