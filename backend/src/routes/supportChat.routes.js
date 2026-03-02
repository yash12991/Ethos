const express = require('express');
const { body } = require('express-validator');
const supportChatController = require('../controllers/supportChat.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

// Support chat is protected (optional, but requested in plan)
router.use(authMiddleware);

router.post(
    '/',
    body('message').isString().notEmpty().isLength({ max: 2000 }),
    body('history').optional().isArray({ max: 20 }),
    body('history.*.role').optional().isIn(['user', 'bot']),
    body('history.*.content').optional().isString().isLength({ max: 10000 }),
    validateRequest,
    supportChatController.handleSupportChat
);

module.exports = router;
