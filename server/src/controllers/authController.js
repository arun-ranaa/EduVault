const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database.js');
const config = require('../config/index.js');
const { AppError } = require('../middleware/errorHandler');
const { getUserStorageUsage } = require('../utils/storageHelper');
const { sendVerificationEmail } = require('../utils/emailHelper');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return next(new AppError('Email is already in use', 409));
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate email verification token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerifyToken,
        emailVerifyExpiry
      }
    });

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, name, emailVerifyToken).catch((err) => {
      console.error('Failed to send verification email:', err.message);
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: newUser.id,
        action: 'USER_REGISTERED',
        details: `User ${newUser.name} registered`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account before logging in.',
      emailSent: true
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return next(new AppError('Verification token is required', 400));
    }

    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token }
    });

    if (!user) {
      return next(new AppError('Invalid or expired verification link', 400));
    }

    if (user.emailVerifyExpiry < new Date()) {
      return next(new AppError('Verification link has expired. Please register again.', 400));
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified. You can log in.'
      });
    }

    // Mark as verified and clear the token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal whether email exists
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, a verification link has been sent.'
      });
    }

    if (user.isEmailVerified) {
      return next(new AppError('This email is already verified.', 400));
    }

    // Generate a fresh token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken, emailVerifyExpiry }
    });

    sendVerificationEmail(email, user.name, emailVerifyToken).catch((err) => {
      console.error('Failed to resend verification email:', err.message);
    });

    res.status(200).json({
      success: true,
      message: 'If that email is registered, a verification link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if user is active
    if (user.isActive === false) {
      return next(new AppError('Your account has been deactivated.', 403));
    }

    // Block unverified users
    if (!user.isEmailVerified) {
      return next(new AppError('Please verify your email address before logging in. Check your inbox for the verification link.', 403));
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: `User ${user.name} logged in`
      }
    });

    // Generate token
    const token = generateToken(user);
    const usage = await getUserStorageUsage(user.id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageQuota: Number(user.storageQuota),
        storageUsed: usage.totalBytes,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    const [dbUser, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id }
      }),
      getUserStorageUsage(user.id)
    ]);

    if (!dbUser) {
      return next(new AppError('User not found', 404));
    }

    const { passwordHash, emailVerifyToken, emailVerifyExpiry, ...userWithoutSensitive } = dbUser;

    res.status(200).json({
      success: true,
      user: {
        ...userWithoutSensitive,
        storageQuota: Number(dbUser.storageQuota),
        storageUsed: usage.totalBytes
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  getMe
};
