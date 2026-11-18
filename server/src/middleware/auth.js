const jwt = require('jsonwebtoken');
const prisma = require('../config/database.js');
const config = require('../config/index.js');
const { AppError } = require('./errorHandler');

const authenticate = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // Verify token with explicit algorithm pinning
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });

    if (typeof decoded.id !== 'number' || !Number.isInteger(decoded.id)) {
      return next(new AppError('Invalid token payload. Please log in again.', 401));
    }

    // Find user
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!currentUser) {
      return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }

    if (currentUser.isActive === false) {
      return next(new AppError('Your account has been deactivated.', 403));
    }

    if (!currentUser.isEmailVerified) {
      return next(new AppError('Please verify your email address before accessing your account.', 403));
    }

    // Exact tokenVersion match instantly revokes sessions on logout, password change, or admin deactivation
    if (typeof decoded.tv !== 'number' || decoded.tv !== currentUser.tokenVersion) {
      return next(new AppError('Session is no longer valid. Please log in again.', 401));
    }

    // Attach user to request, excluding sensitive fields
    const { passwordHash, emailVerifyToken, emailVerifyExpiry, ...safeUser } = currentUser;
    req.user = safeUser;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
