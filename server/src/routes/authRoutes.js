const router = require('express').Router();
const { register, verifyEmail, resendVerification, login, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  resendVerificationRules,
  verifyEmailRules,
  validate,
} = require('../middleware/validate');
const {
  authLoginLimiter,
  authAccountLoginLimiter,
  authEmailLimiter,
  authVerifyLimiter,
} = require('../middleware/rateLimiter');

router.post('/register', authEmailLimiter, registerRules, validate, register);
router.post('/verify-email', authVerifyLimiter, verifyEmailRules, validate, verifyEmail);
router.post('/resend-verification', authEmailLimiter, resendVerificationRules, validate, resendVerification);
router.post('/login', authLoginLimiter, authAccountLoginLimiter, loginRules, validate, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
