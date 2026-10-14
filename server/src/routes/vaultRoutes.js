const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

router.use(authenticate);

router.get('/', vaultController.getVaultFiles);
router.get('/folders', vaultController.getVaultFolders);
router.get('/:id', vaultController.getVaultFileById);

router.post(
  '/presign',
  [
    body('fileName').notEmpty().withMessage('File name is required'),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
  ],
  validate,
  vaultController.createVaultPresign
);

router.post('/complete', vaultController.completeVaultUpload);
router.get('/:id/download', vaultController.getVaultDownloadUrl);
router.delete('/:id', vaultController.deleteVaultFile);

module.exports = router;
