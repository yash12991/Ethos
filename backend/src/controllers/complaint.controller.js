const complaintModel = require('../models/complaint.model');
const accusedModel = require('../models/accused.model');
const generateComplaintId = require('../utils/generateComplaintId');
const { encryptFields, decryptFields } = require('../services/encryption.service');
const { scoreCredibility } = require('../services/credibility.service');
const { logAuditEvent } = require('../services/audit.service');
const { logComplaintAction } = require('../services/complaintAudit.service');
const { ApiError } = require('../middlewares/error.middleware');
const { canViewFullComplaint, resolveWorkflowStatus } = require('../services/caseAccess.service');
const logger = require('../utils/logger');

const STRONG_EVIDENCE_MIN_FILES = 2;
const { evaluateAndPersistSuspiciousCluster } = require('../services/suspiciousCluster.service');

function toUserType(role) {
  return role === 'reporter' ? 'anon' : 'hr';
}

function sanitizeForReporter(complaint) {
  const { rejection_type, ...rest } = complaint;
  const workflowStatus = resolveWorkflowStatus(complaint);
  const displayStatus =
    workflowStatus === 'resolved' || workflowStatus === 'resolved_accepted'
      ? 'resolved'
      : workflowStatus === 'rejected' || workflowStatus === 'resolved_rejected'
        ? 'rejected'
        : 'pending';
  return { ...rest, display_status: displayStatus };
}

function sanitizeForRestrictedHr(complaint) {
  return {
    complaint_code: complaint.complaint_code,
    status: complaint.status,
    workflow_status: resolveWorkflowStatus(complaint),
    assigned_hr_id: complaint.assigned_hr_id || null,
    assigned_hr_name: complaint.assigned_hr_name || null,
    updated_at: complaint.updated_at,
  };
}

function normalizeRejectionType(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

async function createComplaint(req, res, next) {
  try {
    const payload = req.body;

    const credibility = scoreCredibility({
      description: payload.description,
      evidenceCount: Number(payload.evidence_count || 0),
      hasWitness: Boolean(payload.has_witness),
    });

    const encryptedPayload = encryptFields(payload, ['description', 'location']);

    const complaint = await complaintModel.createComplaint({
      complaint_code: generateComplaintId(),
      anon_user_id: req.user.id,
      accused_employee_hash: payload.accused_employee_hash,
      incident_date: payload.incident_date,
      location: encryptedPayload.location || null,
      description: encryptedPayload.description,
      status: 'submitted',
      severity_score: credibility.score,
    });

    await accusedModel.incrementComplaintCount(payload.accused_employee_hash);

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'complaint.create',
      userType: 'anon',
      metadata: { complaintCode: complaint.complaint_code },
    });

    return res.status(201).json({
      success: true,
      data: complaint,
    });
  } catch (err) {
    return next(err);
  }
}

async function listComplaints(req, res, next) {
  try {
    const rows = req.user.role === 'reporter'
      ? await complaintModel.listForReporter(req.user.id)
      : await complaintModel.listForHr();

    const decryptedRows = rows.map((item) => decryptFields(item, ['description', 'location']));
    const responseRows = req.user.role === 'reporter'
      ? decryptedRows.map(sanitizeForReporter)
      : decryptedRows.map((item) => (canViewFullComplaint(item, req.user) ? item : sanitizeForRestrictedHr(item)));
    return res.json({ success: true, data: responseRows });
  } catch (err) {
    return next(err);
  }
}

async function getComplaint(req, res, next) {
  try {
    const complaint = await complaintModel.findByReferenceForUser(req.params.complaintId, req.user);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const decrypted = decryptFields(complaint, ['description', 'location']);
    let responseData;
    if (req.user.role === 'reporter') {
      responseData = sanitizeForReporter(decrypted);
    } else if (canViewFullComplaint(decrypted, req.user)) {
      responseData = decrypted;
    } else {
      responseData = sanitizeForRestrictedHr(decrypted);
    }

    if (['hr', 'committee', 'admin'].includes(req.user.role) && canViewFullComplaint(complaint, req.user)) {
      try {
        await logComplaintAction({
          complaintId: complaint.id,
          hrId: req.user.id,
          actionType: 'DETAILS_VIEWED',
          metadata: {},
          ipAddress: req.ip || null,
        });
      } catch (logErr) {
        logger.warn('Failed to write complaint details-viewed audit log', {
          complaintId: complaint.id,
          hrId: req.user.id,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    }

    return res.json({ success: true, data: decrypted });
  } catch (err) {
    return next(err);
  }
}

async function updateComplaintStatus(req, res, next) {
  try {
    const complaint = await complaintModel.findByReferenceForUser(req.params.complaintId, req.user);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    if (['hr', 'committee', 'admin'].includes(req.user.role)
      && complaint.assigned_hr_id
      && String(complaint.assigned_hr_id) !== String(req.user.id)) {
      throw new ApiError(403, 'Only assigned investigator can update this case status');
    }

    const nextStatus = req.body.status;
    const normalizedRejectionType = normalizeRejectionType(req.body.rejection_type);
    const allowedRejectionTypes = ['insufficient', 'false', 'malicious'];
    if (normalizedRejectionType && !allowedRejectionTypes.includes(normalizedRejectionType)) {
      throw new ApiError(400, 'Invalid rejection_type value');
    }
    if (nextStatus === 'rejected' && !normalizedRejectionType) {
      throw new ApiError(400, 'rejection_type is required when status is rejected');
    }

    const updated = await complaintModel.updateStatusByHr(
      req.params.complaintId,
      nextStatus,
      nextStatus === 'rejected' ? normalizedRejectionType : null
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'complaint.status.update',
      userType: toUserType(req.user.role),
      metadata: { complaintCode: updated.complaint_code, status: nextStatus },
    });

    try {
      await logComplaintAction({
        complaintId: complaint.id,
        hrId: req.user.id,
        actionType: 'STATUS_UPDATED',
        metadata: {
          old_status: complaint.status,
          new_status: updated.status,
        },
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write complaint status-updated audit log', {
        complaintId: complaint.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  getComplaint,
  updateComplaintStatus,
};
