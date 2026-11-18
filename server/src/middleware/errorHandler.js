const config = require('../config/index');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;

  // Prisma Errors (MySQL meta.target is a string; Postgres is an array)
  if (err.code === 'P2002') {
    const rawTarget = err.meta?.target;
    const target = Array.isArray(rawTarget)
      ? rawTarget.join(', ')
      : (typeof rawTarget === 'string' && rawTarget ? rawTarget : 'field');
    error = new AppError(`Duplicate field value: ${target}. Please use another value!`, 409);
  }
  if (err.code === 'P2025') {
    error = new AppError('Record not found', 404);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again!', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired! Please log in again.', 401);
  }

  // Development vs Production response
  if (config.nodeEnv === 'development') {
    console.error('ERROR 💥', err);
    res.status(error.statusCode).json({
      success: false,
      status: error.status,
      message: error.message,
      error: err,
      stack: err.stack
    });
  } else {
    // Production
    if (error.isOperational) {
      res.status(error.statusCode).json({
        success: false,
        status: error.status,
        message: error.message
      });
    } else {
      // Programming or other unknown error: don't leak error details
      console.error('ERROR 💥', err);
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went very wrong!'
      });
    }
  }
};

module.exports = {
  AppError,
  errorHandler
};
