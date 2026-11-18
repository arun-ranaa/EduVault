const router = require('express').Router();
const { register, verifyEmail, resendVerification, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules, validate } = require('../middleware/validate');
const { authLoginLimiter, authEmailLimiter } = require('../middleware/rateLimiter');

router.post('/register', authEmailLimiter, registerRules, validate, register);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authEmailLimiter, resendVerification);
router.post('/login', authLoginLimiter, loginRules, validate, login);
router.get('/me', authenticate, getMe);

module.exports = router;
