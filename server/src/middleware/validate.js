const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0]?.msg || 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const registerRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isString().withMessage('Please provide a valid email')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Please provide a valid email')
    .isLength({ max: 255 }).withMessage('Email is too long'),
  body('password')
    .isString().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be between 6 and 128 characters')
];

const loginRules = [
  body('email')
    .isString().withMessage('Please provide a valid email')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isString().withMessage('Password is required')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Invalid password length')
];

const resendVerificationRules = [
  body('email')
    .isString().withMessage('Please provide a valid email')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Please provide a valid email')
];

const verifyEmailRules = [
  body('token')
    .isString().withMessage('Verification token is required')
    .trim()
    .isLength({ min: 32, max: 256 }).withMessage('Invalid verification token')
];

const resourceRules = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('resourceType')
    .notEmpty().withMessage('Resource type is required')
    .isIn(['NOTES', 'BOOK', 'QUESTION_PAPER', 'ASSIGNMENT', 'STUDY_MATERIAL', 'QUESTION_BANK', 'LAB_RESOURCE', 'OTHER']).withMessage('Invalid resource type'),
  body('subject').optional().isString().isLength({ max: 100 }),
  body('categoryId').optional().isInt({ min: 1 }).withMessage('Category ID must be a positive integer').toInt(),
  body('tags')
    .isArray({ min: 1, max: 15 }).withMessage('Tags must be an array with 1 to 15 items'),
  body('tags.*')
    .isString().withMessage('Tag must be a string')
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Each tag must be between 1 and 50 characters')
];

const vaultUploadRules = [
  body('fileName').isString().trim().notEmpty().withMessage('File name is required').isLength({ max: 255 }),
  body('fileSize').isInt({ gt: 0 }).withMessage('File size must be a positive integer').toInt(),
  body('folder').optional().isString().isLength({ max: 255 })
];

const profileUpdateRules = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
];

const changePasswordRules = [
  body('currentPassword')
    .isString().withMessage('Current password is required')
    .notEmpty().withMessage('Current password is required')
    .isLength({ max: 128 }),
  body('newPassword')
    .isString().withMessage('New password is required')
    .isLength({ min: 6, max: 128 }).withMessage('New password must be between 6 and 128 characters')
];

const categoryRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  resendVerificationRules,
  verifyEmailRules,
  resourceRules,
  vaultUploadRules,
  profileUpdateRules,
  changePasswordRules,
  categoryRules
};
