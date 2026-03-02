const complaintModel = require('../models/complaint.model');
const verdictModel = require('../models/verdict.model');
const accusedModel = require('../models/accused.model');
const complaintAuditModel = require('../models/complaintAudit.model');
const { decryptFields } = require('../services/encryption.service');
const { logAuditEvent } = require('../services/audit.service');
const { logComplaintAction } = require('../services/complaintAudit.service');
const { ApiError } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');
const {
  canViewFullComplaint,
  canSubmitInvestigatorDecision,
  canVoteOnCase,
  resolveWorkflowStatus,
} = require('../services/caseAccess.service');

function priorityLabel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function safeLocation(value) {
  return value && String(value).trim().length > 0 ? String(value) : 'Unassigned';
}

function hrAliasName(name, id) {
  if (name) return String(name);
  return `HR_${String(id || '').slice(0, 6)}`;
}

function toQueueStatusLabel(complaint) {
  const workflowStatus = resolveWorkflowStatus(complaint);
  if (workflowStatus === 'open') return 'OPEN';
  if (workflowStatus === 'in_progress') return `IN_PROGRESS by ${hrAliasName(complaint.assigned_hr_name, complaint.assigned_hr_id)}`;
  if (workflowStatus === 'under_review') return 'UNDER_REVIEW';
  if (workflowStatus === 'resolved_accepted' || workflowStatus === 'resolved') return 'RESOLVED';
  if (workflowStatus === 'resolved_rejected' || workflowStatus === 'rejected') return 'REJECTED';
  if (workflowStatus === 'reopened') return 'REOPENED';
  return workflowStatus.toUpperCase();
}

function toLimitedCaseView(complaint) {
  return {
    complaint_code: complaint.complaint_code,
    status: complaint.status,
    workflow_status: resolveWorkflowStatus(complaint),
    status_label: toQueueStatusLabel(complaint),
    assigned_hr: complaint.assigned_hr_id
      ? {
        id: complaint.assigned_hr_id,
        name: hrAliasName(complaint.assigned_hr_name, complaint.assigned_hr_id),
      }
      : null,
  };
}

async function queue(req, res, next) {
  try {
    const complaints = await complaintModel.listForHrQueue();
    const data = complaints.map((item) => {
      const decrypted = decryptFields(item, ['description']);
      return {
        id: item.id,
        complaint_code: item.complaint_code,
        accused_employee_hash: item.accused_employee_hash || null,
        location: null,
        description: null,
        severity_score: Number(item.severity_score) || 0,
        credibility_score: Number(item.credibility_score) || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        incident_summary: String(decrypted.description || '').slice(0, 240),
        incident_date: item.incident_date || null,
        status: item.status,
        workflow_status: resolveWorkflowStatus(item),
        status_label: toQueueStatusLabel(item),
        assigned_hr: item.assigned_hr_id
          ? {
            id: item.assigned_hr_id,
            name: hrAliasName(item.assigned_hr_name, item.assigned_hr_id),
          }
          : null,
        can_accept: !item.assigned_hr_id && ['open', 'reopened'].includes(resolveWorkflowStatus(item)),
        can_view: Boolean(item.assigned_hr_id) && String(item.assigned_hr_id) === String(req.user.id),
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const complaints = await complaintModel.listResolvedHistoryForHr(req.user.id);
    const data = complaints.map((item) => {
      const decrypted = decryptFields(item, ['description']);
      return {
        id: item.id,
        complaint_code: item.complaint_code,
        accused_employee_hash: item.accused_employee_hash || null,
        location: null,
        description: null,
        severity_score: Number(item.severity_score) || 0,
        credibility_score: Number(item.credibility_score) || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        incident_summary: String(decrypted.description || '').slice(0, 240),
        incident_date: item.incident_date || null,
        status: item.status,
        workflow_status: resolveWorkflowStatus(item),
        status_label: toQueueStatusLabel(item),
        assigned_hr: item.assigned_hr_id
          ? {
            id: item.assigned_hr_id,
            name: hrAliasName(item.assigned_hr_name, item.assigned_hr_id),
          }
          : null,
        can_accept: false,
        can_view: String(item.assigned_hr_id) === String(req.user.id),
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function listNotifications(req, res, next) {
  try {
    const rows = await complaintModel.listCommitteeNotifications(req.user.id);
    const data = rows.map((item) => ({
      complaint_code: item.complaint_code,
      workflow_status: resolveWorkflowStatus(item),
      status: item.status,
      investigator_decision_notes: item.investigator_decision_notes || null,
      investigator_decision_at: item.investigator_decision_at || null,
      assigned_hr: {
        id: item.assigned_hr_id,
        name: hrAliasName(item.assigned_hr_name, item.assigned_hr_id),
      },
      my_vote: item.my_vote || null,
      my_vote_updated_at: item.my_vote_updated_at || null,
      updated_at: item.updated_at,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function notificationDetail(req, res, next) {
  try {
    const complaint = await complaintModel.findNotificationCase(req.params.complaintId, req.user.id);
    if (!complaint) {
      throw new ApiError(404, 'Notification case not found or not available for voting');
    }

    const decrypted = decryptFields(complaint, ['description', 'location']);
    const { anon_user_id, ...rest } = decrypted;

    try {
      await logComplaintAction({
        complaintId: complaint.id,
        hrId: req.user.id,
        actionType: 'VOTE_VIEWED',
        metadata: {},
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write vote-viewed audit log', {
        complaintId: complaint.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({
      success: true,
      data: {
        ...rest,
        workflow_status: resolveWorkflowStatus(complaint),
        assigned_hr: {
          id: complaint.assigned_hr_id,
          name: hrAliasName(complaint.assigned_hr_name, complaint.assigned_hr_id),
        },
        my_vote: complaint.my_vote || null,
        my_vote_updated_at: complaint.my_vote_updated_at || null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function castNotificationVote(req, res, next) {
  return castCommitteeVote(req, res, next);
}

async function caseDetail(req, res, next) {
  try {
    const complaint = await complaintModel.findByReference(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (!canViewFullComplaint(complaint, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted to assigned investigator or review committee phase',
        data: toLimitedCaseView(complaint),
      });
    }

    const decrypted = decryptFields(complaint, ['description', 'location']);
    const { anon_user_id, ...rest } = decrypted;

    try {
      await logComplaintAction({
        complaintId: complaint.id,
        hrId: req.user.id,
        actionType: 'DETAILS_VIEWED',
        metadata: {},
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write details-viewed audit log', {
        complaintId: complaint.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({
      success: true,
      data: {
        ...rest,
        workflow_status: resolveWorkflowStatus(complaint),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function acceptCase(req, res, next) {
  try {
    const accepted = await complaintModel.acceptCase(req.params.complaintId, req.user.id);
    if (!accepted) {
      throw new ApiError(409, 'Case is already assigned or cannot be accepted by this HR');
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'hr.case.accept',
      userType: 'hr',
      metadata: { complaintCode: accepted.complaint_code },
    });

    try {
      await logComplaintAction({
        complaintId: accepted.id,
        hrId: req.user.id,
        actionType: 'CASE_ACCEPTED',
        metadata: {},
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write case-accepted audit log', {
        complaintId: accepted.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({
      success: true,
      data: {
        complaint_code: accepted.complaint_code,
        workflow_status: resolveWorkflowStatus(accepted),
        assigned_hr_id: accepted.assigned_hr_id,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function submitInvestigatorDecision(req, res, next) {
  try {
    const complaint = await complaintModel.findByReference(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    if (!canSubmitInvestigatorDecision(complaint, req.user)) {
      throw new ApiError(403, 'Only assigned investigator can submit decision for in-progress cases');
    }

    const updated = await complaintModel.submitInvestigatorDecision(
      req.params.complaintId,
      req.user.id,
      req.body.notes || null
    );
    if (!updated) {
      throw new ApiError(409, 'Unable to submit decision in current case state');
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'hr.case.decision.submit',
      userType: 'hr',
      metadata: { complaintCode: updated.complaint_code, status: updated.status },
    });

    try {
      await logComplaintAction({
        complaintId: updated.id,
        hrId: req.user.id,
        actionType: 'DECISION_SUBMITTED',
        metadata: {
          decision: updated.status,
        },
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write decision-submitted audit log', {
        complaintId: updated.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({
      success: true,
      data: {
        complaint_code: updated.complaint_code,
        workflow_status: resolveWorkflowStatus(updated),
        status: updated.status,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function castCommitteeVote(req, res, next) {
  try {
    const complaint = await complaintModel.findByReference(req.params.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    if (!canVoteOnCase(complaint, req.user)) {
      throw new ApiError(403, 'Only non-assigned HR can vote during committee review');
    }

    const outcome = await complaintModel.castCommitteeVote(
      req.params.complaintId,
      req.user.id,
      req.body.vote
    );
    if (!outcome) {
      throw new ApiError(404, 'Complaint not found');
    }
    if (outcome.error) {
      throw new ApiError(400, outcome.error);
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'hr.case.vote.cast',
      userType: 'hr',
      metadata: {
        complaintCode: outcome.complaint_code,
        vote: req.body.vote,
        finalized: Boolean(outcome.finalized),
      },
    });

    try {
      await logComplaintAction({
        complaintId: complaint.id,
        hrId: req.user.id,
        actionType: 'VOTE_CAST',
        metadata: {
          vote: req.body.vote,
        },
        ipAddress: req.ip || null,
      });
    } catch (logErr) {
      logger.warn('Failed to write vote-cast audit log', {
        complaintId: complaint.id,
        hrId: req.user.id,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    return res.json({
      success: true,
      data: {
        complaint_code: outcome.complaint_code,
        vote_tally: {
          eligible_count: outcome.eligible_count,
          support_count: outcome.support_count,
          oppose_count: outcome.oppose_count,
          threshold: outcome.threshold,
        },
        finalized: outcome.finalized
          ? {
            workflow_status: resolveWorkflowStatus(outcome.finalized),
            status: outcome.finalized.status,
          }
          : null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function dashboardOverview(req, res, next) {
  try {
    const [summary, profileCount, alertStats] = await Promise.all([
      complaintModel.getHrDashboardSummary(),
      accusedModel.getAccusedProfileCount(),
      accusedModel.getPatternAlertStats(),
    ]);

    const metrics = summary.metrics || {
      total_today: 0,
      total_yesterday: 0,
      total_month: 0,
      under_hr_review: 0,
      under_committee_review: 0,
      resolved_cases: 0,
      rejected_cases: 0,
      high_risk_cases: 0,
      stale_cases: 0,
    };

    const weeklyTrend = (summary.weeklyTrend || []).map((row) => Number(row.count) || 0);
    const statusFunnel = {
      submitted: Number(metrics.under_hr_review) || 0,
      under_review: Number(metrics.under_committee_review) || 0,
      resolved: Number(metrics.resolved_cases) || 0,
      rejected: Number(metrics.rejected_cases) || 0,
    };

    const alerts = [
      {
        type: 'high_risk_open',
        label: 'High risk with open complaints',
        count: Number(alertStats.high_risk_open_count) || 0,
      },
      {
        type: 'repeat_no_verdict',
        label: 'Repeat accused profiles without verdict',
        count: Number(alertStats.repeat_without_verdict_count) || 0,
      },
      {
        type: 'high_guilty_rate',
        label: 'Accused profiles with >50% guilty rate',
        count: Number(alertStats.high_guilty_rate_count) || 0,
      },
    ];

    return res.json({
      success: true,
      data: {
        total_today: Number(metrics.total_today) || 0,
        total_yesterday: Number(metrics.total_yesterday) || 0,
        total_month: Number(metrics.total_month) || 0,
        under_hr_review: statusFunnel.submitted,
        under_committee_review: statusFunnel.under_review,
        active_cases: statusFunnel.submitted + statusFunnel.under_review,
        closed_cases: statusFunnel.resolved + statusFunnel.rejected,
        high_risk_cases: Number(metrics.high_risk_cases) || 0,
        stale_cases: Number(metrics.stale_cases) || 0,
        status_funnel: statusFunnel,
        weekly_trend: weeklyTrend,
        pattern_profile_count: Number(profileCount) || 0,
        alerts,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function dashboardDepartmentRisk(req, res, next) {
  try {
    const rows = await complaintModel.listForHrDepartmentRisk();
    const map = new Map();

    for (const item of rows) {
      const decrypted = decryptFields(item, ['location']);
      const key = safeLocation(decrypted.location);
      const existing = map.get(key) || { high: 0, medium: 0, low: 0 };
      const priority = priorityLabel(Number(item.severity_score) || 0);
      existing[priority] += 1;
      map.set(key, existing);
    }

    const data = Array.from(map.entries())
      .map(([name, levels]) => ({
        name,
        high: levels.high,
        medium: levels.medium,
        low: levels.low,
        total: levels.high + levels.medium + levels.low,
      }))
      .sort((a, b) => b.high * 3 + b.medium * 2 + b.low - (a.high * 3 + a.medium * 2 + a.low))
      .slice(0, 5);

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function saveVerdict(req, res, next) {
  try {
    const { complaintId } = req.params;
    const complaint = await complaintModel.findByReferenceForUser(complaintId, req.user);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const verdict = await verdictModel.upsertVerdict({
      complaint_id: complaint.id,
      verdict: req.body.verdict,
      notes: req.body.notes || null,
      decided_by: req.user.id,
    });

    if (req.body.verdict === 'guilty') {
      await accusedModel.incrementGuiltyCount(complaint.accused_employee_hash);
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'hr.verdict.upsert',
      userType: 'hr',
      metadata: { complaintCode: complaint.complaint_code, verdict: req.body.verdict },
    });

    return res.json({ success: true, data: verdict });
  } catch (err) {
    return next(err);
  }
}

async function getVerdict(req, res, next) {
  try {
    const verdict = await verdictModel.getVerdictByComplaint(req.params.complaintId, req.user);
    if (!verdict) return res.status(404).json({ success: false, message: 'Verdict not found' });

    return res.json({ success: true, data: verdict });
  } catch (err) {
    return next(err);
  }
}

async function accusedPatterns(req, res, next) {
  try {
    const list = await accusedModel.listAccusedPatterns();
    return res.json({ success: true, data: list });
  } catch (err) {
    return next(err);
  }
}

async function patternInsights(req, res, next) {
  try {
    const results = await Promise.allSettled([
      accusedModel.getRiskDistribution(),
      accusedModel.getStatusFunnel(),
      accusedModel.getSeverityRiskMatrix(),
      accusedModel.getAccusedConversion(),
      accusedModel.getMedianVerdictHours(),
      accusedModel.getHighRiskWatchlist(),
      accusedModel.getPatternAlertStats(),
    ]);

    const getArray = (index) =>
      results[index].status === 'fulfilled' && Array.isArray(results[index].value)
        ? results[index].value
        : [];
    const getValue = (index, fallback = null) =>
      results[index].status === 'fulfilled' ? results[index].value : fallback;

    const riskDistributionRows = getArray(0);
    const statusFunnelRows = getArray(1);
    const severityRiskMatrixRows = getArray(2);
    const accusedConversionRows = getArray(3);
    const medianVerdictHours = getValue(4, null);
    const watchlistRows = getArray(5);
    const alertStats = getValue(6, {
      high_risk_open_count: 0,
      repeat_without_verdict_count: 0,
      high_guilty_rate_count: 0,
    });

    const risk_distribution = {
      low: 0,
      medium: 0,
      high: 0,
    };
    for (const row of riskDistributionRows) {
      if (row.risk_level in risk_distribution) {
        risk_distribution[row.risk_level] = row.count;
      }
    }

    const status_funnel = {
      submitted: 0,
      under_review: 0,
      resolved: 0,
      rejected: 0,
    };
    for (const row of statusFunnelRows) {
      if (row.status in status_funnel) {
        status_funnel[row.status] = row.count;
      }
    }

    const severity_risk_matrix = severityRiskMatrixRows.map((row) => ({
      severity_bucket: row.severity_bucket,
      risk_level: row.risk_level,
      count: row.count,
    }));

    const accused_conversion = accusedConversionRows.map((row) => ({
      accused_employee_hash: row.accused_employee_hash,
      total_complaints: row.total_complaints,
      complaints_with_verdict: row.complaints_with_verdict,
      guilty_verdicts: row.guilty_verdicts,
      guilty_rate: row.guilty_rate === null ? null : Number(row.guilty_rate),
    }));

    const alerts = [
      {
        type: 'high_risk_open',
        label: 'High risk with open complaints',
        count: Number(alertStats.high_risk_open_count) || 0,
      },
      {
        type: 'repeat_no_verdict',
        label: 'Repeat accused profiles without verdict',
        count: Number(alertStats.repeat_without_verdict_count) || 0,
      },
      {
        type: 'high_guilty_rate',
        label: 'Accused profiles with >50% guilty rate',
        count: Number(alertStats.high_guilty_rate_count) || 0,
      },
    ];

    return res.json({
      success: true,
      data: {
        risk_distribution,
        status_funnel,
        severity_risk_matrix,
        accused_conversion,
        median_verdict_hours: medianVerdictHours === null ? null : Number(medianVerdictHours),
        watchlist: watchlistRows,
        alerts,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function complaintAuditLogs(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search ? String(req.query.search) : '';
    const actionType = req.query.action_type ? String(req.query.action_type) : '';
    const rawHrId = req.query.hr_id ? String(req.query.hr_id) : '';
    const hrId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawHrId)
      ? rawHrId
      : '';

    const data = await complaintAuditModel.listComplaintAuditLogs({
      page,
      limit,
      search,
      actionType,
      hrId,
    });
    return res.json({
      success: true,
      data: data.rows,
      pagination: data.pagination,
      filters: data.filters,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  queue,
  history,
  caseDetail,
  acceptCase,
  submitInvestigatorDecision,
  castCommitteeVote,
  listNotifications,
  notificationDetail,
  castNotificationVote,
  dashboardOverview,
  dashboardDepartmentRisk,
  saveVerdict,
  getVerdict,
  accusedPatterns,
  patternInsights,
  complaintAuditLogs,
};
