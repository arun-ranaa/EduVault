const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { uploadPresignLimiter, downloadLimiter } = require('../middleware/rateLimiter');
const { RESOURCE_TYPES } = require('../utils/categoryHelper');
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
    body('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters'),
    body('fileName').isString().trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('categoryId').isInt({ min: 1 }).withMessage('Category is required'),
    body('resourceType').optional({ values: 'falsy' }).isIn(RESOURCE_TYPES).withMessage('Invalid resource type'),
    body('subject').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('semester').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
    body('tags').isArray({ min: 1, max: 15 }).withMessage('Tags must be an array with 1 to 15 items'),
    body('tags.*').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each tag must be 1 to 50 characters')
];

const completeRules = [
    body('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters'),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
    body('fileName').isString().trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
    body('s3Key').isString().trim().notEmpty().withMessage('s3Key is required').isLength({ max: 500 }),
    body('categoryId').isInt({ min: 1 }).withMessage('Category is required'),
    body('resourceType').optional({ values: 'falsy' }).isIn(RESOURCE_TYPES).withMessage('Invalid resource type'),
    body('subject').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('semester').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
    body('tags').isArray({ min: 1, max: 15 }).withMessage('Tags must be an array with 1 to 15 items'),
    body('tags.*').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each tag must be 1 to 50 characters')
];

router.use(authenticate);

router.get('/', resourceController.getResources);
router.get('/categories', resourceController.getCategories);
router.get('/my', resourceController.getMyResources);
router.get('/:id', resourceController.getResourceById);
router.get('/:id/download', downloadLimiter, downloadController.getResourceDownloadUrl);

router.post('/presign', uploadPresignLimiter, presignRules, validate, resourceController.createResourcePresign);
router.post('/complete', completeRules, validate, resourceController.completeResourceUpload);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
