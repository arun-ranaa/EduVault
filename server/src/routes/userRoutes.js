const router = require('express').Router();
const {
  getProfile,
  updateProfile,
  changePassword,
  getStorageInfo
} = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { passwordChangeLimiter } = require('../middleware/rateLimiter');
const {
  profileUpdateRules,
  changePasswordRules,
  validate
} = require('../middleware/validate');

// All user routes require authentication
router.use(authenticate);

router.get('/me', getProfile);
router.put('/me', profileUpdateRules, validate, updateProfile);
router.put('/me/password', passwordChangeLimiter, changePasswordRules, validate, changePassword);
router.get('/me/storage', getStorageInfo);

module.exports = router;
