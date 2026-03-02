const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { authRateLimit } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

router.post(
  '/register',
  authRateLimit,
  body('password').isString().isLength({ min: 8 }),
  body('alias').optional().isString().isLength({ min: 4, max: 24 }),
  validateRequest,
  authController.register
);

router.post(
  '/login',
  authRateLimit,
  body('alias').isString().notEmpty(),
  body('password').isString().notEmpty(),
  validateRequest,
  authController.login
);

router.post(
  '/hr/register',
  authRateLimit,
  body('name').isString().isLength({ min: 2, max: 120 }),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('role').isIn(['hr', 'committee', 'admin']),
  body('two_factor_enabled').optional().isBoolean(),
  validateRequest,
  authController.hrRegister
);

router.post(
  '/hr/login',
  authRateLimit,
  body('email').isEmail(),
  body('password').isString().notEmpty(),
  validateRequest,
  authController.hrLogin
);

router.post(
  '/hr/verify-otp',
  authRateLimit,
  body('challengeId').isUUID(),
  body('otp').isString().matches(/^\d{6}$/),
  validateRequest,
  authController.hrVerifyOtp
);

router.post('/refresh', authController.refresh);

router.get('/me', authMiddleware, authController.me);
router.post(
  '/change-password',
  authMiddleware,
  authRateLimit,
  body('currentPassword').isString().isLength({ min: 8 }),
  body('newPassword').isString().isLength({ min: 8 }),
  validateRequest,
  authController.changePassword
);
router.get('/alias-suggestions', authController.getAliasSuggestions);
router.get('/recovery-phrase', authController.getRecoveryPhrase);

module.exports = router;
