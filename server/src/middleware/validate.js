const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const registerRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const loginRules = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const resourceRules = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .trim()
    .isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('resourceType')
    .notEmpty().withMessage('Resource type is required')
    .isIn(['NOTES', 'BOOK', 'QUESTION_PAPER', 'ASSIGNMENT', 'STUDY_MATERIAL', 'QUESTION_BANK', 'LAB_RESOURCE', 'OTHER']).withMessage('Invalid resource type'),
  body('subject').optional().isString(),
  body('categoryId').optional().isInt().withMessage('Category ID must be an integer').toInt(),
  body('tags')
    .isArray({ min: 1 }).withMessage('Tags must be an array with at least one item'),
  body('tags.*')
    .isString().withMessage('Tag must be a string')
    .trim()
    .notEmpty().withMessage('Tag cannot be empty')
];

const vaultUploadRules = [
  body('fileName').notEmpty().withMessage('File name is required'),
  body('fileSize').isInt({ gt: 0 }).withMessage('File size must be a positive integer').toInt(),
  body('folder').optional().isString()
];

const profileUpdateRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

const categoryRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  resourceRules,
  vaultUploadRules,
  profileUpdateRules,
  changePasswordRules,
  categoryRules
};
