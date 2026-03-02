const express = require('express');
const { body, param } = require('express-validator');
const hrController = require('../controllers/hr.controller');
const patternDetectionController = require('../controllers/patternDetection.controller');
const evidenceController = require('../controllers/evidence.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('hr', 'committee', 'admin'));

router.get('/queue', hrController.queue);
router.get('/history', hrController.history);
router.get('/logs', hrController.complaintAuditLogs);
router.get('/notifications', hrController.listNotifications);
router.get(
  '/notifications/:complaintId',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  hrController.notificationDetail
);
router.get(
  '/notifications/:complaintId/evidence',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  evidenceController.listEvidenceForNotificationReview
);
router.post(
  '/notifications/:complaintId/vote',
  param('complaintId').isString().notEmpty(),
  body('vote').isIn(['support', 'oppose']),
  validateRequest,
  hrController.castNotificationVote
);
router.get(
  '/cases/:complaintId',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  hrController.caseDetail
);
router.post(
  '/cases/:complaintId/accept',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  hrController.acceptCase
);
router.post(
  '/cases/:complaintId/decision',
  param('complaintId').isString().notEmpty(),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  validateRequest,
  hrController.submitInvestigatorDecision
);
router.get('/dashboard-overview', hrController.dashboardOverview);
router.get('/dashboard-department-risk', hrController.dashboardDepartmentRisk);
router.get('/accused-patterns', hrController.accusedPatterns);
router.get('/pattern-insights', hrController.patternInsights);
router.get('/pattern-detection/overview', patternDetectionController.overview);
router.get('/pattern-detection/repeat-offenders', patternDetectionController.repeatOffenders);
router.get('/pattern-detection/targeting-alerts', patternDetectionController.targetingAlerts);
router.get('/pattern-detection/department-risk', patternDetectionController.departmentRisk);
router.get('/pattern-detection/time-trends', patternDetectionController.timeTrends);
router.get('/pattern-detection/credibility-risk', patternDetectionController.credibilityRisk);
router.get('/pattern-detection/insights', patternDetectionController.insights);
router.get('/pattern-detection/risk-acceleration', patternDetectionController.riskAcceleration);
router.get('/pattern-detection/suspicious-clusters', patternDetectionController.suspiciousClusters);
router.get(
  '/pattern-detection/accused/:accusedHash/breakdown',
  param('accusedHash').isString().isLength({ min: 3, max: 255 }),
  validateRequest,
  patternDetectionController.accusedBreakdown
);
router.get(
  '/pattern-detection/accused/:accusedHash/complaints',
  param('accusedHash').isString().isLength({ min: 3, max: 255 }),
  validateRequest,
  patternDetectionController.accusedComplaints
);

router.put(
  '/verdict/:complaintId',
  param('complaintId').isString().notEmpty(),
  body('verdict').isIn(['guilty', 'not_guilty', 'insufficient_evidence']),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
  validateRequest,
  hrController.saveVerdict
);

router.get(
  '/verdict/:complaintId',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  hrController.getVerdict
);

module.exports = router;
