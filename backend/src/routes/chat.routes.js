const express = require('express');
const { body, param } = require('express-validator');
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/threads', chatController.listThreads);

router.post(
  '/:complaintId/request',
  param('complaintId').isString().notEmpty(),
  body('message').isString().isLength({ min: 1, max: 2000 }),
  validateRequest,
  chatController.initiateRequest
);

router.post(
  '/:complaintId/accept',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  chatController.acceptRequest
);

router.post(
  '/:complaintId/messages',
  param('complaintId').isString().notEmpty(),
  body('message').isString().isLength({ min: 1, max: 2000 }),
  validateRequest,
  chatController.postMessage
);

router.get(
  '/:complaintId/messages',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  chatController.getMessages
);

module.exports = router;
