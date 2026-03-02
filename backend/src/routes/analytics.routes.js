const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('hr', 'admin'));

router.get('/summary', analyticsController.summary);

module.exports = router;
