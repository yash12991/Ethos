const express = require('express');
const { body, param } = require('express-validator');
const complaintController = require('../controllers/complaint.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { complaintRateLimit } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/',
  complaintRateLimit,
  requireRole('reporter', 'admin'),
  body('accused_employee_hash').isString().isLength({ min: 6, max: 255 }),
  body('description').isString().isLength({ min: 20 }),
  body('incident_date').optional({ values: 'falsy' }).isISO8601(),
  body('location').optional({ values: 'falsy' }).isString().isLength({ min: 2, max: 300 }),
  body('evidence_count').optional().isInt({ min: 0 }),
  body('has_witness').optional().isBoolean(),
  validateRequest,
  complaintController.createComplaint
);

router.get('/', complaintController.listComplaints);

router.get(
  '/:complaintId',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  complaintController.getComplaint
);

router.patch(
  '/:complaintId/status',
  requireRole('hr', 'committee', 'admin'),
  param('complaintId').isString().notEmpty(),
  body('status').isIn(['submitted', 'under_review', 'resolved', 'rejected']),
  validateRequest,
  complaintController.updateComplaintStatus
);

module.exports = router;
