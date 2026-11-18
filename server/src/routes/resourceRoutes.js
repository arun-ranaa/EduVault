const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { uploadPresignLimiter } = require('../middleware/rateLimiter');
const resourceController = require('../controllers/resourceController');
const downloadController = require('../controllers/downloadController');

const router = express.Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0]?.msg || 'Validation failed', errors: errors.array() });
    }
    next();
};

const presignRules = [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters'),
    body('fileName').trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('categoryId').isInt({ min: 1 }).withMessage('Category is required'),
    body('tags').isArray({ min: 1 }).withMessage('Tags must be an array with at least one item')
];

const completeRules = [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters'),
    body('fileName').trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('s3Key').trim().notEmpty().withMessage('s3Key is required').isLength({ max: 500 }),
    body('categoryId').isInt({ min: 1 }).withMessage('Category is required'),
    body('tags').isArray({ min: 1 }).withMessage('Tags must be an array with at least one item')
];

router.use(authenticate);

router.get('/', resourceController.getResources);
router.get('/categories', resourceController.getCategories);
router.get('/my', resourceController.getMyResources);
router.get('/:id', resourceController.getResourceById);
router.get('/:id/download', downloadController.getResourceDownloadUrl);

router.post('/presign', uploadPresignLimiter, presignRules, validate, resourceController.createResourcePresign);
router.post('/complete', completeRules, validate, resourceController.completeResourceUpload);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
