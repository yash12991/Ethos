const patternDetectionModel = require('../models/patternDetection.model');
const { logAuditEvent } = require('../services/audit.service');

const OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
let overviewCache = {
  expiresAt: 0,
  payload: null,
};

function isTransientDbError(err) {
  const message = String(err?.message || '');
  return err?.code === '57014'
    || err?.code === 'ECONNRESET'
    || /statement timeout|econnreset|read econnreset|connection terminated/i.test(message);
}

function fallbackOverview() {
  return {
    escalation_index: {
      current_count: 0,
      previous_count: 0,
      percentage_change: 0,
      trend: 'stable',
    },
    high_risk_accused_count: 0,
    targeting_alerts_count: 0,
    low_evidence_percentage: 0,
    low_evidence_trend: {
      current_ratio: 0,
      previous_ratio: 0,
      percentage_change: 0,
      trend: 'stable',
    },
    avg_resolution_time_hours: 0,
    active_under_review: 0,
  };
}

async function auditPatternAccess(req, action) {
  await logAuditEvent({
    actorUserId: req.user?.id || null,
    action,
    userType: 'hr',
    metadata: {
      route: req.originalUrl,
      method: req.method,
    },
  });
}

async function overview(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.overview.view');

    if (overviewCache.payload && Date.now() < overviewCache.expiresAt) {
      return res.json({ success: true, data: overviewCache.payload, cached: true });
    }

    const payload = await patternDetectionModel.getOverview();
    overviewCache = {
      payload,
      expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS,
    };

    return res.json({ success: true, data: payload, cached: false });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: fallbackOverview(), degraded: true });
    }
    return next(err);
  }
}

async function repeatOffenders(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.repeat_offenders.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const data = await patternDetectionModel.getRepeatOffenders(limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function targetingAlerts(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.targeting_alerts.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const data = await patternDetectionModel.getTargetingAlerts(limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function departmentRisk(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.department_risk.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 50);
    const data = await patternDetectionModel.getDepartmentRisk(limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function timeTrends(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.time_trends.view');
    const data = await patternDetectionModel.getTimeTrends();
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function credibilityRisk(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.credibility_risk.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const data = await patternDetectionModel.getSuspiciousComplainants(limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function insights(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.insights.view');
    const data = await patternDetectionModel.getInsightsBundle();
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({
        success: true,
        data: [{ severity: 'low', message: 'Pattern insights temporarily unavailable. Retrying with degraded mode.' }],
        degraded: true,
      });
    }
    return next(err);
  }
}

async function riskAcceleration(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.risk_acceleration.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const data = await patternDetectionModel.getRiskAcceleration(limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function accusedBreakdown(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.accused_breakdown.view');
    const data = await patternDetectionModel.getAccusedBreakdown(req.params.accusedHash);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({
        success: true,
        data: {
          accused_employee_hash: req.params.accusedHash,
          status_breakdown: {
            submitted: 0,
            under_review: 0,
            resolved: 0,
            rejected: 0,
          },
          weekly_timeline: [],
          no_evidence_ratio: 0,
        },
        degraded: true,
      });
    }
    return next(err);
  }
}

async function suspiciousClusters(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.suspicious_clusters.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const reviewStatus = req.query.review_status ? String(req.query.review_status) : null;
    const data = await patternDetectionModel.getSuspiciousClusters({ limit, reviewStatus });
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

async function accusedComplaints(req, res, next) {
  try {
    await auditPatternAccess(req, 'hr.pattern_detection.accused_complaints.view');
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const data = await patternDetectionModel.getAccusedComplaints(req.params.accusedHash, limit);
    return res.json({ success: true, data });
  } catch (err) {
    if (isTransientDbError(err)) {
      return res.json({ success: true, data: [], degraded: true });
    }
    return next(err);
  }
}

module.exports = {
  overview,
  repeatOffenders,
  targetingAlerts,
  departmentRisk,
  timeTrends,
  credibilityRisk,
  insights,
  riskAcceleration,
  accusedBreakdown,
  suspiciousClusters,
  accusedComplaints,
};
