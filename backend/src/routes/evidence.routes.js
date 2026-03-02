const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');
const evidenceController = require('../controllers/evidence.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { uploadRateLimit } = require('../middlewares/rateLimit.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();
const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'audio/mpeg',
      'video/mp4',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    return cb(null, true);
  },
});

router.use(authMiddleware);

router.post(
  '/:complaintId',
  uploadRateLimit,
  param('complaintId').isString().notEmpty(),
  body('notes').optional().isString().isLength({ max: 500 }),
  validateRequest,
  upload.single('file'),
  evidenceController.uploadEvidence
);

router.get(
  '/:complaintId',
  param('complaintId').isString().notEmpty(),
  validateRequest,
  evidenceController.listEvidence
);

module.exports = router;
