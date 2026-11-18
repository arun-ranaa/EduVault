const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadPresignLimiter, downloadLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');

router.use(authenticate);

router.get('/', vaultController.getVaultFiles);
router.get('/folders', vaultController.getVaultFolders);
router.get('/:id', vaultController.getVaultFileById);

router.post(
  '/presign',
  uploadPresignLimiter,
  [
    body('fileName').isString().trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('folder').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  ],
  validate,
  vaultController.createVaultPresign
);

router.post(
  '/complete',
  [
    body('fileName').isString().trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('s3Key').isString().trim().notEmpty().withMessage('s3Key is required').isLength({ max: 500 }),
    body('name').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
    body('folder').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 }),
  ],
  validate,
  vaultController.completeVaultUpload
);

router.get('/:id/download', downloadLimiter, vaultController.getVaultDownloadUrl);
router.delete('/:id', vaultController.deleteVaultFile);

module.exports = router;
