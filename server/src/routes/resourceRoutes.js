const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');
const downloadController = require('../controllers/downloadController');

const router = express.Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const presignRules = [
    body('title').notEmpty().withMessage('Title is required'),
    body('fileName').notEmpty().withMessage('File name is required'),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('resourceType').isIn(['NOTES', 'BOOK', 'QUESTION_PAPER', 'ASSIGNMENT', 'STUDY_MATERIAL', 'QUESTION_BANK', 'LAB_RESOURCE', 'OTHER']).withMessage('Invalid resource type'),
    body('tags').isArray({ min: 1 }).withMessage('Tags must be an array with at least one item')
];

router.use(authenticate);

router.get('/', resourceController.getResources);
router.get('/my', resourceController.getMyResources);
router.get('/:id', resourceController.getResourceById);
router.get('/:id/download', downloadController.getResourceDownloadUrl);

router.post('/presign', presignRules, validate, resourceController.createResourcePresign);
router.post('/complete', resourceController.completeResourceUpload);
router.delete('/:id', resourceController.deleteResource);

module.exports = router;
