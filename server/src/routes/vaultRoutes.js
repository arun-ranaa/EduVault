const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadPresignLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');

router.use(authenticate);

router.get('/', vaultController.getVaultFiles);
router.get('/folders', vaultController.getVaultFolders);
router.get('/:id', vaultController.getVaultFileById);

router.post(
  '/presign',
  uploadPresignLimiter,
  [
    body('fileName').trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
  ],
  validate,
  vaultController.createVaultPresign
);

router.post(
  '/complete',
  [
    body('fileName').trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('s3Key').trim().notEmpty().withMessage('s3Key is required').isLength({ max: 500 }),
  ],
  validate,
  vaultController.completeVaultUpload
);

router.get('/:id/download', vaultController.getVaultDownloadUrl);
router.delete('/:id', vaultController.deleteVaultFile);

module.exports = router;
